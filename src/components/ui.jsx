import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

/* ------------------------------ formatting ------------------------------ */

export const fmtNum = (n, dp = 0) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

/** "3 days ago" style label for activity feeds. */
export function fmtAgo(d) {
  if (!d) return '';
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(d);
}

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

/** Quantity still sitting in the store, computed the same way the API does. */
export const availableOf = (item) => Math.max(0, (item?.quantity || 0) - (item?.issuedQuantity || 0));

export const isLow = (item) =>
  (item?.reorderLevel || 0) > 0 && availableOf(item) <= item.reorderLevel;

/* -------------------------------- badges -------------------------------- */

export const STATUS_TONE = {
  Available: 'green',
  'Partially Issued': 'blue',
  'Fully Issued': 'amber',
  'Not Available': 'red',
  'In Transit': 'navy',
  'Written Off': 'grey',
};

export const STATUSES = ['Available', 'Partially Issued', 'Fully Issued', 'Not Available', 'In Transit', 'Written Off'];

export const CONDITION_TONE = {
  New: 'green',
  Good: 'green',
  Used: 'blue',
  'Needs Repair': 'amber',
  'Under Repair': 'amber',
  Damaged: 'red',
  Scrap: 'grey',
};

export const TYPE_TONE = {
  ISSUE: 'red',
  RECEIVE: 'green',
  RETURN: 'blue',
  TRANSFER: 'navy',
  SCRAP: 'grey',
  ADJUST: 'amber',
};

export const Badge = ({ tone = 'grey', children, dot = false }) => (
  <span className={`badge ${tone}${dot ? ' dot' : ''}`}>{children}</span>
);

/* -------------------------------- modal --------------------------------- */

export function Modal({ open, title, subtitle, onClose, children, footer, width = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${width}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', tone = 'red', busy, onConfirm, onClose }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width="narrow"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={`btn btn-${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--grey-600)' }}>{message}</p>
    </Modal>
  );
}

/* ------------------------------ small pieces ----------------------------- */

export const Loading = ({ label = 'Loading…' }) => (
  <div className="loading-page">
    <span className="spinner dark" />
    <span>{label}</span>
  </div>
);

export const Empty = ({ icon = 'inbox', title, message, action }) => (
  <div className="empty">
    <Icon name={icon} size={42} strokeWidth={1.5} />
    <h4>{title}</h4>
    {message ? <p>{message}</p> : null}
    {action}
  </div>
);

export function Pagination({ page, pages, total, limit, onPage, onLimit }) {
  if (!total) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="pagination">
      <span className="info">
        Showing <b>{from}</b>–<b>{to}</b> of <b>{fmtNum(total)}</b>
      </span>
      {onLimit ? (
        <select className="select" style={{ width: 92 }} value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
          {[10, 25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      ) : null}
      <button className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <Icon name="chevron-left" size={15} />
      </button>
      <span className="small nowrap" style={{ padding: '0 4px' }}>
        Page {page} / {pages}
      </span>
      <button className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <Icon name="chevron-right" size={15} />
      </button>
    </div>
  );
}

export function StatCard({ label, value, sub, tone = '', icon }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="label">
        {icon ? <Icon name={icon} size={13} /> : null}
        {label}
      </div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
      {icon ? <Icon name={icon} size={78} strokeWidth={1.2} className="ghost" /> : null}
    </div>
  );
}

/** Close-on-outside-click wrapper used by the topbar menu. */
export function Dropdown({ trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open ? (
        <div className="menu" style={align === 'left' ? { left: 0, right: 'auto' } : undefined} onClick={() => setOpen(false)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
