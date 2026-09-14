/**
 * Where the API lives, read once from the build environment.
 *
 * - Local dev: VITE_API_URL is unset, so every call stays relative (`/api`) and
 *   Vite's proxy forwards it to localhost:5000.
 * - Production (Vercel): VITE_API_URL is the Render backend, e.g.
 *   https://si-inventory-backend.onrender.com — calls and the live-update socket
 *   go straight there.
 */
const trimSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

/** Backend origin with no trailing slash; '' means "same origin as this page". */
export const API_ORIGIN = trimSlash(import.meta.env.VITE_API_URL);

/** Base for every REST call. */
export const API_BASE = `${API_ORIGIN}/api`;

/**
 * The public address of this frontend, used for the store QR code. Falls back to
 * whatever address the admin opened the dashboard on — correct on the production
 * domain, but set VITE_PUBLIC_URL so a preview deployment never prints a poster
 * pointing at a throwaway URL.
 */
export const PUBLIC_APP_URL = trimSlash(import.meta.env.VITE_PUBLIC_URL) || window.location.origin;
