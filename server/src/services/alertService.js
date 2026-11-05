import { env } from '../config/env.js';
import { Alert } from '../models/Alert.js';
import { User } from '../models/User.js';
import { emit } from './socket.js';
import { sendEmail, sendSms } from './notify.js';
import { serializeOwner, serializePublic } from '../utils/serialize.js';

export const trackUrl = (token) => `${env.clientUrl}/track/${token}`;

// Tell everyone who watches this alert that something changed.
export function broadcastChange(alert) {
  emit(`user:${alert.user}`, 'alert:updated', serializeOwner(alert));
  emit(`track:${alert.trackingToken}`, 'alert:updated', serializePublic(alert));
  emit('admins', 'alert:changed', { id: alert.id });
  for (const uid of alert.contactUserIds || []) emit(`user:${uid}`, 'incoming:refresh', {});
}

function buildMessages(user, alert) {
  const link = trackUrl(alert.trackingToken);
  const loc = alert.location?.lat != null ? `\nLast known location: https://www.google.com/maps?q=${alert.location.lat},${alert.location.lng}` : '';
  const custom = user.settings?.customMessage ? `\n"${user.settings.customMessage}"` : '';
  const time = new Date(alert.triggeredAt).toUTCString();
  return {
    subject: `${user.name} needs help (Silent SOS)`,
    email:
      `${user.name} sent a silent request for help at ${time}.${custom}${loc}\n\n` +
      `Follow their live location and let them know you are responding:\n${link}\n\n` +
      `If you believe they are in immediate danger, contact your local emergency services.`,
    sms: `Silent SOS: ${user.name} needs help.${custom} Live location: ${link}${loc}`.slice(0, 600),
  };
}

// Runs after the HTTP response has been sent so the trigger itself stays fast.
export async function dispatchNotifications(alertId) {
  const alert = await Alert.findById(alertId);
  if (!alert) return;
  const user = await User.findById(alert.user);
  if (!user) return;

  const contacts = user.emergencyContacts;
  const emails = contacts.map((c) => c.email).filter(Boolean);
  const phones = contacts.map((c) => c.phone).filter(Boolean);

  // 1) In-app alerts for contacts who also have an account.
  const contactUsers =
    emails.length || phones.length
      ? await User.find({ _id: { $ne: user._id }, $or: [{ email: { $in: emails } }, { phone: { $in: phones } }] }).select('name')
      : [];
  if (contactUsers.length) {
    await Alert.updateOne({ _id: alert._id }, { $set: { contactUserIds: contactUsers.map((u) => u._id) } });
    contactUsers.forEach((u) => emit(`user:${u.id}`, 'incoming:refresh', {}));
  }

  // 2) SMS and email, in parallel.
  const msg = buildMessages(user, alert);
  const jobs = [];
  for (const c of contacts) {
    if (c.phone && c.channels?.sms !== false) {
      jobs.push({ contactName: c.name, channel: 'sms', to: c.phone, run: () => sendSms({ to: c.phone, body: msg.sms }) });
    }
    if (c.email && c.channels?.email !== false) {
      jobs.push({
        contactName: c.name,
        channel: 'email',
        to: c.email,
        run: () => sendEmail({ to: c.email, subject: msg.subject, text: msg.email }),
      });
    }
  }

  const results = await Promise.all(
    jobs.map(async (j) => {
      const base = { contactName: j.contactName, channel: j.channel, to: j.to, at: new Date() };
      try {
        const r = await j.run();
        return { ...base, status: r.status };
      } catch (err) {
        return { ...base, status: 'failed', error: String(err.message || err).slice(0, 200) };
      }
    })
  );
  contactUsers.forEach((u) => results.push({ contactName: u.name, channel: 'in-app', to: '', status: 'sent', at: new Date() }));

  const okCount = results.filter((r) => r.status !== 'failed').length;
  const failedCount = results.length - okCount;
  const set = {};
  if (okCount > 0) set.deliveryTimeMs = Date.now() - new Date(alert.triggeredAt).getTime();

  let message;
  if (results.length === 0) message = 'No trusted contacts to notify. Add contacts so someone receives your next request.';
  else message = `${okCount} of ${results.length} notifications delivered${failedCount ? `, ${failedCount} failed` : ''}`;

  const updated = await Alert.findByIdAndUpdate(
    alert._id,
    {
      $set: set,
      $push: {
        notifications: { $each: results },
        logs: { event: results.length ? 'notified' : 'no_contacts', message, by: 'system' },
      },
    },
    { new: true }
  );
  if (updated) broadcastChange(updated);
}

export async function acknowledgeAlert(alert, { name, via }) {
  const now = new Date();
  const updated = await Alert.findOneAndUpdate(
    { _id: alert._id, status: 'sent' },
    {
      $set: {
        status: 'acknowledged',
        acknowledgedAt: now,
        acknowledgedBy: { name, via },
        responseTimeMs: now.getTime() - new Date(alert.triggeredAt).getTime(),
      },
      $push: { logs: { event: 'acknowledged', message: `Acknowledged by ${name} (${via})`, by: name, at: now } },
    },
    { new: true }
  );
  if (updated) {
    broadcastChange(updated);
    return updated;
  }
  // Already acknowledged by someone else: record that another person is responding too.
  const again = await Alert.findOneAndUpdate(
    { _id: alert._id, status: 'acknowledged' },
    { $push: { logs: { event: 'acknowledged', message: `${name} is also responding (${via})`, by: name, at: now } } },
    { new: true }
  );
  if (again) broadcastChange(again);
  return again || (await Alert.findById(alert._id));
}

export async function resolveAlert(alert, { name, via }) {
  const now = new Date();
  const updated = await Alert.findOneAndUpdate(
    { _id: alert._id, isActive: true },
    {
      $set: { status: 'resolved', isActive: false, resolvedAt: now, resolvedBy: { name, via } },
      $push: { logs: { event: 'resolved', message: via === 'owner' ? `Marked safe by ${name}` : `Resolved by ${name} (${via})`, by: name, at: now } },
    },
    { new: true }
  );
  if (updated) broadcastChange(updated);
  return updated || (await Alert.findById(alert._id));
}
