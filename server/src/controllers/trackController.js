import { Alert } from '../models/Alert.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { cleanStr } from '../utils/validate.js';
import { serializePublic } from '../utils/serialize.js';
import { acknowledgeAlert } from '../services/alertService.js';

const LINK_TTL_AFTER_RESOLVE_MS = 24 * 60 * 60 * 1000;

async function findByToken(token) {
  const alert = await Alert.findOne({ trackingToken: String(token) });
  if (!alert) throw new HttpError(404, 'This link is not valid.');
  if (alert.status === 'resolved' && alert.resolvedAt && Date.now() - alert.resolvedAt.getTime() > LINK_TTL_AFTER_RESOLVE_MS) {
    throw new HttpError(410, 'This request has ended and the link has expired.');
  }
  return alert;
}

export const getTracked = asyncHandler(async (req, res) => {
  const alert = await findByToken(req.params.token);
  res.json({ alert: serializePublic(alert) });
});

export const acknowledge = asyncHandler(async (req, res) => {
  const alert = await findByToken(req.params.token);
  if (alert.status === 'resolved') throw new HttpError(409, 'This request has already ended.');
  const name = cleanStr(req.body?.name, 60) || 'A trusted contact';
  const updated = await acknowledgeAlert(alert, { name, via: 'link' });
  res.json({ alert: serializePublic(updated) });
});
