import axios from 'axios';

/**
 * A bare axios instance for the QR self-service screens. Deliberately separate
 * from `api/client.js`: it sends no token, and a 401 here must never bounce a
 * visitor to the login page — nobody scanning the store QR code has an account.
 */
const publicApi = axios.create({
  baseURL: '/api/public',
  headers: { 'Content-Type': 'application/json' },
});

publicApi.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      (error.code === 'ERR_NETWORK'
        ? 'Cannot reach the store system. Check your connection, or see the store keeper.'
        : error.message);
    return Promise.reject(new Error(message));
  }
);

export default publicApi;
