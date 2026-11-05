import { Alert } from '../models/Alert.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { serializeAdmin } from '../utils/serialize.js';
import { acknowledgeAlert, resolveAlert } from '../services/alertService.js';

export const listAlerts = asyncHandler(async (req, res) => {
  const filter = String(req.query.filter || 'active');
  const query = {};
  if (filter === 'active') query.isActive = true;
  else if (['sent', 'acknowledged', 'resolved'].includes(filter)) query.status = filter;

  const alerts = await Alert.find(query)
    .sort({ triggeredAt: -1 })
    .limit(Math.min(Number(req.query.limit) || 100, 300))
    .populate('user', 'name email phone');
  res.json({ alerts: alerts.map(serializeAdmin) });
});

async function load(id) {
  const alert = await Alert.findById(id).populate('user', 'name email phone');
  if (!alert) throw new HttpError(404, 'Alert not found.');
  return alert;
}

export const acknowledge = asyncHandler(async (req, res) => {
  const alert = await load(req.params.id);
  if (alert.status === 'resolved') throw new HttpError(409, 'This alert has already ended.');
  await acknowledgeAlert(alert, { name: req.user.name, via: 'admin' });
  res.json({ alert: serializeAdmin(await load(req.params.id)) });
});

export const resolve = asyncHandler(async (req, res) => {
  const alert = await load(req.params.id);
  await resolveAlert(alert, { name: req.user.name, via: 'admin' });
  res.json({ alert: serializeAdmin(await load(req.params.id)) });
});

export const stats = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [[totals], daily, activeAlerts, totalUsers] = await Promise.all([
    Alert.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $gt: ['$deliveryTimeMs', 0] }, 1, 0] } },
          acknowledged: { $sum: { $cond: [{ $gt: ['$acknowledgedAt', null] }, 1, 0] } },
          avgDeliveryMs: { $avg: '$deliveryTimeMs' },
          avgResponseMs: { $avg: '$responseTimeMs' },
          avgRating: { $avg: '$feedbackRating' },
          ratingCount: { $sum: { $cond: [{ $gt: ['$feedbackRating', 0] }, 1, 0] } },
        },
      },
    ]),
    Alert.aggregate([
      { $match: { triggeredAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$triggeredAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Alert.countDocuments({ isActive: true }),
    User.countDocuments(),
  ]);

  const t = totals || { total: 0, delivered: 0, acknowledged: 0 };
  const round = (n) => (n == null ? null : Math.round(n));
  res.json({
    stats: {
      totalAlerts: t.total,
      activeAlerts,
      deliveredAlerts: t.delivered,
      deliveryRate: t.total ? t.delivered / t.total : null,
      avgDeliveryMs: round(t.avgDeliveryMs),
      acknowledgedAlerts: t.acknowledged,
      acknowledgmentRate: t.total ? t.acknowledged / t.total : null,
      avgResponseMs: round(t.avgResponseMs),
      avgRating: t.avgRating == null ? null : Math.round(t.avgRating * 10) / 10,
      ratingCount: t.ratingCount || 0,
      totalUsers,
      processUptimeSeconds: Math.round(process.uptime()),
      startedAt: env.startedAt.toISOString(),
      daily: daily.map((d) => ({ date: d._id, count: d.count })),
    },
  });
});
