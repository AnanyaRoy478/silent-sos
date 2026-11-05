import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';
import * as contacts from '../controllers/contactController.js';
import * as alerts from '../controllers/alertController.js';
import * as track from '../controllers/trackController.js';
import * as admin from '../controllers/adminController.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again in a few minutes.' },
});

// Limits repeated triggers per account so notifications cannot be used for spam.
const triggerLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Try again in a few minutes.' },
});

router.get('/health', (req, res) =>
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()), db: mongoose.connection.readyState === 1 })
);

// Auth
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.get('/auth/me', requireAuth, auth.me);
router.put('/auth/me', requireAuth, auth.updateMe);

// Trusted contacts
router.get('/contacts', requireAuth, contacts.list);
router.post('/contacts', requireAuth, contacts.add);
router.put('/contacts/:id', requireAuth, contacts.update);
router.delete('/contacts/:id', requireAuth, contacts.remove);

// Alerts (owner)
router.post('/alerts', requireAuth, triggerLimiter, alerts.trigger);
router.get('/alerts', requireAuth, alerts.listMine);
router.get('/alerts/active', requireAuth, alerts.getActive);
router.get('/alerts/incoming', requireAuth, alerts.incoming);
router.post('/alerts/:id/acknowledge', requireAuth, alerts.acknowledgeIncoming);
router.get('/alerts/:id', requireAuth, alerts.getOne);
router.post('/alerts/:id/location', requireAuth, alerts.updateLocation);
router.post('/alerts/:id/resolve', requireAuth, alerts.resolve);
router.post('/alerts/:id/feedback', requireAuth, alerts.feedback);

// Public live tracking for trusted contacts (token in the link is the credential)
router.get('/track/:token', track.getTracked);
router.post('/track/:token/acknowledge', track.acknowledge);

// Admin & monitoring
router.get('/admin/stats', requireAuth, requireAdmin, admin.stats);
router.get('/admin/alerts', requireAuth, requireAdmin, admin.listAlerts);
router.post('/admin/alerts/:id/acknowledge', requireAuth, requireAdmin, admin.acknowledge);
router.post('/admin/alerts/:id/resolve', requireAuth, requireAdmin, admin.resolve);

export default router;
