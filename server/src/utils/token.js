import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (user) => jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);
// 192 bits of randomness; used in the public live-tracking link.
export const newTrackingToken = () => crypto.randomBytes(24).toString('base64url');
