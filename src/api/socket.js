import { io } from 'socket.io-client';
import { API_ORIGIN } from './config.js';

/**
 * The single Socket.IO connection used for live updates. In dev it goes through
 * this page's origin (Vite proxies /socket.io); in production it connects
 * straight to the backend named by VITE_API_URL.
 */
let socket = null;

export function connectSocket(token) {
  disconnectSocket();
  const options = { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] };
  socket = API_ORIGIN ? io(API_ORIGIN, options) : io(options);
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Sent with every API call so the server can tell this tab apart from others. */
export const getSocketId = () => (socket?.connected ? socket.id : null);
