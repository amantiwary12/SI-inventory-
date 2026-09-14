import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { TOKEN_KEY } from '../api/client.js';
import { connectSocket, disconnectSocket } from '../api/socket.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const SocketContext = createContext(null);

const LABELS = {
  items: 'a material',
  transactions: 'an issue / receive entry',
  masters: 'a master list entry',
  fields: 'a custom field',
  modules: 'a sidebar module',
  users: 'a user account',
  // Nobody is signed in behind a QR scan, so it arrives as a whole-app refresh.
  '*': 'material at the QR counter',
};

const describe = (c) => `${c.by?.name || 'Someone'} ${c.action} ${LABELS[c.entity] || 'something'}.`;

/**
 * Keeps one live connection open while someone is signed in. When anyone adds,
 * edits or deletes anything, every page listening for that kind of data refreshes.
 */
export function SocketProvider({ children }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const listeners = useRef(new Set());
  const [connected, setConnected] = useState(false);
  const userId = user?.id;

  const notify = useCallback((change) => listeners.current.forEach((fn) => fn(change)), []);

  useEffect(() => {
    if (!userId) return undefined;

    const socket = connectSocket(localStorage.getItem(TOKEN_KEY));
    let wasConnected = false;

    socket.on('connect', () => {
      setConnected(true);
      // After a drop (e.g. the API restarted) we may have missed changes — refresh everything.
      if (wasConnected) notify({ entity: '*', action: 'reconnected' });
      wasConnected = true;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));

    socket.on('data:changed', (change) => {
      // This tab made the change and has already refreshed itself.
      if (change.origin && change.origin === socket.id) return;

      if (change.by?.id !== String(userId)) toast.info('Live update', describe(change));

      // An admin changed my own account (role, department, deactivation…).
      if (change.entity === 'users' && change.id === String(userId)) {
        api.get('/auth/me').then(({ data }) => setUser(data.user)).catch(() => {});
      }

      notify(change);
    });

    return () => {
      disconnectSocket();
      setConnected(false);
    };
  }, [userId, notify, setUser, toast]);

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside SocketProvider');
  return ctx;
};

/**
 * Re-run `onChange` whenever someone else changes one of `entities`
 * ('items', 'transactions', 'masters', 'fields', 'modules', 'users', or '*').
 * Bursts of changes are collapsed into a single refresh.
 */
export function useLiveUpdates(entities, onChange) {
  const { subscribe } = useSocket();
  const callback = useRef(onChange);
  callback.current = onChange;
  const key = entities.join(',');

  useEffect(() => {
    const wanted = key.split(',');
    let timer;
    const unsubscribe = subscribe((change) => {
      if (change.entity !== '*' && !wanted.includes('*') && !wanted.includes(change.entity)) return;
      clearTimeout(timer);
      timer = setTimeout(() => callback.current(change), 300);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [subscribe, key]);
}
