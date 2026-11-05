import { io } from 'socket.io-client';

// auth: { token } for signed-in users, { trackToken } for public tracking links.
export function openSocket(auth) {
  const url = import.meta.env.VITE_SOCKET_URL;
  const options = { auth, transports: ['websocket', 'polling'] };
  return url ? io(url, options) : io(options);
}
