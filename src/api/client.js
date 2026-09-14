import axios from 'axios';
import { API_BASE } from './config.js';
import { getSocketId } from './socket.js';

export const TOKEN_KEY = 'si_inventory_token';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Lets the server skip echoing a live update back to the tab that caused it.
  const socketId = getSocketId();
  if (socketId) config.headers['X-Socket-Id'] = socketId;
  return config;
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Worth retrying: a dev-server restart drops connections for a second or two, and
 * a hosted backend that has gone idle answers 502/503/504 while it wakes up.
 */
const isTransient = (error) =>
  error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || [502, 503, 504].includes(error.response?.status);

// 1s, 2s, 3s, 4s — about ten seconds in all, enough to ride out a backend waking up.
const MAX_RETRIES = 4;
const RETRY_DELAY = 1000;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;

    // Retry read-only calls only: replaying a POST could double-record a movement.
    const method = (config.method || 'get').toLowerCase();
    if (isTransient(error) && method === 'get') {
      config.__retryCount = (config.__retryCount || 0) + 1;
      if (config.__retryCount <= MAX_RETRIES) {
        await sleep(RETRY_DELAY * config.__retryCount);
        return api(config);
      }
    }

    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK'
        ? import.meta.env.DEV
          ? 'Cannot reach the API server. Start it with: cd server && npm run dev'
          : 'Cannot reach the server right now. It may be starting up — please try again in a moment.'
        : error.message);

    // An expired or revoked token should drop the session, but never on the
    // login screen itself, where a 401 just means "wrong password".
    if (status === 401 && !config.url?.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
    }

    return Promise.reject(new Error(message));
  }
);

/** Trigger a browser download for one of the CSV export endpoints. */
export async function downloadCSV(path, params, filename) {
  const res = await api.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default api;
