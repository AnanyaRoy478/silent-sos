import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

export const notFound = (req, res, next) => next(new HttpError(404, 'Not found.'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(' ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier.';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That value is already in use.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  }

  if (status >= 500) {
    console.error(err);
    if (env.isProd) message = 'Something went wrong on our side.';
  }
  res.status(status).json({ message });
}
