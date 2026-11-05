import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../utils/token.js';

let io = null;

// Rooms:
//   user:<id>       the signed-in person (own alert updates, incoming alert refreshes)
//   admins          signed-in admins
//   track:<token>   anyone holding a live-tracking link
export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.corsOrigins } });

  io.on('connection', (socket) => {
    const { token, trackToken } = socket.handshake.auth || {};
    try {
      if (token) {
        const payload = verifyToken(token);
        socket.join(`user:${payload.sub}`);
        if (payload.role === 'admin') socket.join('admins');
      }
      if (typeof trackToken === 'string' && trackToken.length >= 16 && trackToken.length <= 100) {
        socket.join(`track:${trackToken}`);
      }
    } catch {
      socket.disconnect(true);
    }
  });

  return io;
}

export const emit = (room, event, payload) => {
  if (io) io.to(room).emit(event, payload);
};
