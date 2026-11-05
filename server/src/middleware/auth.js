import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/HttpError.js';
import { verifyToken } from '../utils/token.js';
import { User } from '../models/User.js';

export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Sign in to continue.');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new HttpError(401, 'This account no longer exists.');
  req.user = user;
  next();
});

export const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Admin access is required.'));
