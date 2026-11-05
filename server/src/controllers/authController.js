import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { signToken } from '../utils/token.js';
import { cleanStr, isEmail, isPhone, normalizePhone, PHONE_HINT } from '../utils/validate.js';

export const register = asyncHandler(async (req, res) => {
  const name = cleanStr(req.body.name, 80);
  const email = cleanStr(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const phone = normalizePhone(req.body.phone);

  if (!name) throw new HttpError(400, 'Enter your name.');
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'Use a password between 8 and 128 characters.');
  if (phone && !isPhone(phone)) throw new HttpError(400, PHONE_HINT);
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists.');

  const user = await User.create({ name, email, phone, passwordHash: await User.hash(password) });
  res.status(201).json({ token: signToken(user), user: user.toClient() });
});

export const login = asyncHandler(async (req, res) => {
  const email = cleanStr(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await user.verifyPassword(password))) throw new HttpError(401, 'Incorrect email or password.');
  res.json({ token: signToken(user), user: user.toClient() });
});

export const me = (req, res) => res.json({ user: req.user.toClient() });

export const updateMe = asyncHandler(async (req, res) => {
  const user = req.user;
  const { name, phone, settings, currentPassword, newPassword } = req.body;

  if (name !== undefined) {
    const n = cleanStr(name, 80);
    if (!n) throw new HttpError(400, 'Enter your name.');
    user.name = n;
  }
  if (phone !== undefined) {
    const p = normalizePhone(phone);
    if (p && !isPhone(p)) throw new HttpError(400, PHONE_HINT);
    user.phone = p;
  }
  if (settings && typeof settings === 'object') {
    if (['hold', 'tap'].includes(settings.triggerMode)) user.settings.triggerMode = settings.triggerMode;
    if (typeof settings.stealthMode === 'boolean') user.settings.stealthMode = settings.stealthMode;
    if (typeof settings.haptic === 'boolean') user.settings.haptic = settings.haptic;
    if (typeof settings.customMessage === 'string') user.settings.customMessage = cleanStr(settings.customMessage, 200);
  }
  if (newPassword) {
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      throw new HttpError(400, 'Use a new password between 8 and 128 characters.');
    }
    const full = await User.findById(user._id).select('+passwordHash');
    if (!(await full.verifyPassword(String(currentPassword || '')))) throw new HttpError(400, 'Your current password is incorrect.');
    user.passwordHash = await User.hash(newPassword);
  }

  await user.save();
  res.json({ user: user.toClient() });
});
