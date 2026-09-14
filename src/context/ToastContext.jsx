import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, title, message, ttl = 4500) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((t) => [...t, { id, type, title, message }]);
      if (ttl) setTimeout(() => dismiss(id), ttl);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message, 7000),
      info: (title, message) => push('info', title, message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role="status">
            <Icon
              name={t.type === 'success' ? 'check-circle' : t.type === 'error' ? 'alert' : 'info'}
              size={17}
              style={{
                color: t.type === 'success' ? 'var(--green-600)' : t.type === 'error' ? 'var(--red-600)' : 'var(--blue-600)',
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <b>{t.title}</b>
              {t.message ? <span>{t.message}</span> : null}
            </div>
            <button className="x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
