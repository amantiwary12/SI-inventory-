import { io } from 'socket.io-client';

/**
 * The single Socket.IO connection used for live updates. It goes through the
 * same origin as the API (Vite proxies /socket.io to the server in dev).
 */
let socket = null;

export function connectSocket(token) {
  disconnectSocket();
  socket = io({ path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Sent with every API call so the server can tell this tab apart from others. */
export const getSocketId = () => (socket?.connected ? socket.id : null);
