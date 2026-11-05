import { Alert } from '../models/Alert.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { newTrackingToken } from '../utils/token.js';
import { parseLocation } from '../utils/validate.js';
import { serializeIncoming, serializeLocation, serializeOwner } from '../utils/serialize.js';
import { emit } from '../services/socket.js';
import { acknowledgeAlert, dispatchNotifications, resolveAlert } from '../services/alertService.js';

// POST /api/alerts  - the silent SOS trigger. Responds first, notifies afterwards.
export const trigger = asyncHandler(async (req, res) => {
  const user = req.user;

  const open = await Alert.findOne({ user: user._id, isActive: true });
  if (open) return res.json({ alert: serializeOwner(open), existing: true });

  const location = parseLocation(req.body?.location);
  const source = ['hold', 'tap', 'keyboard'].includes(req.body?.source) ? req.body.source : 'hold';
  const now = new Date();

  let alert;
  try {
    alert = await Alert.create({
      user: user._id,
      userName: user.name,
      trackingToken: newTrackingToken(),
      triggeredAt: now,
      triggerSource: source,
      ...(location && { location: { ...location, updatedAt: now }, path: [{ ...location, at: now }] }),
      logs: [{ event: 'triggered', message: 'Silent SOS triggered', by: user.name, at: now }],
    });
  } catch (err) {
    if (err.code === 11000) {
      // Two triggers raced each other: return the one that won.
      const existing = await Alert.findOne({ user: user._id, isActive: true });
      if (existing) return res.json({ alert: serializeOwner(existing), existing: true });
    }
    throw err;
  }

  res.status(201).json({ alert: serializeOwner(alert) });

  emit('admins', 'alert:changed', { id: alert.id });
  dispatchNotifications(alert._id).catch((e) => console.error('Notification dispatch failed:', e));
});

export const getActive = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({ user: req.user._id, isActive: true });
  res.json({ alert: alert ? serializeOwner(alert) : null });
});

export const listMine = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const alerts = await Alert.find({ user: req.user._id }).sort({ triggeredAt: -1 }).limit(limit);
  res.json({ alerts: alerts.map((a) => serializeOwner(a, { withPath: false })) });
});

export const getOne = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user._id });
  if (!alert) throw new HttpError(404, 'Alert not found.');
  res.json({ alert: serializeOwner(alert) });
});

export const updateLocation = asyncHandler(async (req, res) => {
  const location = parseLocation(req.body);
  if (!location) throw new HttpError(400, 'Invalid location.');
  const now = new Date();

  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, isActive: true },
    {
      $set: { location: { ...location, updatedAt: now } },
      $push: { path: { $each: [{ ...location, at: now }], $slice: -500 } },
    },
    { new: true, projection: { trackingToken: 1, location: 1 } }
  );
  if (!alert) throw new HttpError(404, 'No open alert found.');

  const payload = { id: alert.id, location: serializeLocation(alert.location) };
  emit(`track:${alert.trackingToken}`, 'alert:location', payload);
  emit(`user:${req.user.id}`, 'alert:location', payload);
  emit('admins', 'alert:location', payload);
  res.json({ ok: true });
});

export const resolve = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, user: req.user._id });
  if (!alert) throw new HttpError(404, 'Alert not found.');
  const updated = await resolveAlert(alert, { name: req.user.name, via: 'owner' });
  res.json({ alert: serializeOwner(updated) });
});

export const feedback = asyncHandler(async (req, res) => {
  const rating = Number(req.body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Choose a rating from 1 to 5.');
  const alert = await Alert.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, status: 'resolved' },
    { $set: { feedbackRating: rating } },
    { new: true }
  );
  if (!alert) throw new HttpError(404, 'Only ended alerts can be rated.');
  res.json({ alert: serializeOwner(alert) });
});

// Alerts raised by people who listed me as a trusted contact (matched by email or phone).
export const incoming = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const alerts = await Alert.find({ contactUserIds: req.user._id, triggeredAt: { $gte: since } })
    .sort({ triggeredAt: -1 })
    .limit(50);
  res.json({ alerts: alerts.map(serializeIncoming) });
});

// In-app acknowledgement by a signed-in contact.
export const acknowledgeIncoming = asyncHandler(async (req, res) => {
  const alert = await Alert.findOne({ _id: req.params.id, contactUserIds: req.user._id });
  if (!alert) throw new HttpError(404, 'Alert not found.');
  if (alert.status === 'resolved') throw new HttpError(409, 'This alert has already ended.');
  const updated = await acknowledgeAlert(alert, { name: req.user.name, via: 'in-app' });
  res.json({ alert: serializeIncoming(updated) });
});
