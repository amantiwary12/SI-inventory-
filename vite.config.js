import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5000';

/**
 * The API restarting (nodemon / --watch) briefly refuses connections.
 * Left alone, the proxy prints a stack trace and the browser sees a
 * dead request. Answer with a normal JSON error instead so the UI can
 * show a sensible message and retry.
 */
const quietProxyErrors = (proxy) => {
  proxy.on('error', (err, _req, res) => {
    const restarting = ['ECONNREFUSED', 'ECONNRESET', 'EPIPE'].includes(err.code);

    console.warn(
      restarting
        ? `[proxy] API not reachable on ${API_TARGET} (${err.code}) — is it running? \`cd server && npm run dev\``
        : `[proxy] ${err.message}`
    );

    // `res` is a raw socket for websocket upgrades, not a response.
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          message: restarting
            ? 'The API server is not responding. If it is restarting, this will clear in a moment — otherwise start it with: cd server && npm run dev'
            : `Could not reach the API server: ${err.message}`,
        })
      );
    } else if (res && typeof res.destroy === 'function') {
      res.destroy();
    }
  });
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, configure: quietProxyErrors },
      // Live updates (Socket.IO) — websocket upgrade plus the polling fallback.
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true, configure: quietProxyErrors },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { react: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
});
