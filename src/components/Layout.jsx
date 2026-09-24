import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Dropdown, initials } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useLiveUpdates, useSocket } from '../context/SocketContext.jsx';
import api from '../api/client.js';

const TITLES = {
  '/': ['Overview', 'Item counts, low quantity alerts and the latest updates'],
  '/inventory': ['Inventory List', 'Every material held by R&D'],
  '/transactions': ['Issue & Receive', 'Record and trace every update'],
  '/returns': ['Pending Returns', 'Material issued out and not yet returned'],
  '/self-service': ['QR Self-Service', 'The store QR code, and what people took by scanning it'],
  '/reports': ['Reports', 'Movement log, department usage and exports'],
  '/masters': ['Master Lists', 'Categories, locations, departments, vendors and units'],
  '/users': ['Users & Roles', 'Team access and the audit trail'],
  '/settings': ['Settings', 'Profile, password and module switches'],
};

export const Brand = ({ compact = false }) => (
  <>
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
    {compact ? null : (
      <div className="brand-text">
        <b>
          R&D <i>INVENTORY</i>
        </b>
        <span>RESEARCH &amp; DEVELOPMENT</span>
      </div>
    )}
  </>
);

export default function Layout() {
  const { user, logout, isManager } = useAuth();
  const { modules } = useMeta();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState({ lowQuantity: 0, overdue: 0 });

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setOpen(false), [location.pathname]);

  const { connected } = useSocket();

  const loadAlerts = useCallback(() => {
    api
      .get('/dashboard/summary')
      .then(({ data }) => setAlerts({ lowQuantity: data.totals.lowQuantityCount, overdue: data.totals.overdueCount }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [location.pathname, loadAlerts]);

  useLiveUpdates(['items', 'transactions'], loadAlerts);

  const [title, subtitle] = TITLES[location.pathname] ||
    (location.pathname.startsWith('/inventory/') ? ['Item Details', 'Full record and movement history'] : ['R&D Inventory', '']);

  const nav = modules.filter((m) => m.enabled);

  const badgeFor = (key) => {
    if (key === 'inventory' && alerts.lowQuantity) return alerts.lowQuantity;
    if (key === 'returns' && alerts.overdue) return alerts.overdue;
    return null;
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
        </div>

        <nav className="sidebar-nav">
          <div className="nav-label">MAIN MENU</div>
          {nav.map((m) =>
            m.externalUrl ? (
              <a key={m.key} className="nav-item" href={m.externalUrl} target="_blank" rel="noreferrer" title={m.description}>
                <Icon name={m.icon} size={17} />
                {m.label}
                <Icon name="external-link" size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />
              </a>
            ) : (
              <NavLink
                key={m.key}
                to={m.path || '/'}
                end={m.path === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                title={m.description}
              >
                <Icon name={m.icon} size={17} />
                {m.label}
                {badgeFor(m.key) ? <span className="nav-badge">{badgeFor(m.key)}</span> : null}
              </NavLink>
            )
          )}
        </nav>

        <div className="sidebar-foot">
          R&amp;D
          <br />
          Inventory Dashboard
        </div>
      </aside>

      <div className={`scrim${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            <Icon name="menu" size={22} />
          </button>

          <div style={{ minWidth: 0 }}>
            <h1>{title}</h1>
            {subtitle ? <div className="crumb">{subtitle}</div> : null}
          </div>

          <div className="topbar-spacer" />

          <span
            title={connected ? 'Live — changes made by anyone appear here instantly' : 'Live updates reconnecting…'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginRight: 12,
              fontSize: 12,
              fontWeight: 600,
              color: connected ? 'var(--green-600)' : 'var(--grey-400)',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 0, background: 'currentColor' }} />
            {connected ? 'Live' : 'Offline'}
          </span>

          <Dropdown
            trigger={
              <button className="user-chip">
                <span className="avatar">{user?.avatar?.url ? <img src={user.avatar.url} alt="" /> : initials(user?.name)}</span>
                <span className="who">
                  <b>{user?.name}</b>
                  <span>{user?.role}</span>
                </span>
                <Icon name="chevron-down" size={14} style={{ color: 'var(--grey-400)' }} />
              </button>
            }
          >
            <button onClick={() => navigate('/settings')}>
              <Icon name="user" size={15} /> My profile
            </button>
            <button onClick={() => navigate('/settings')}>
              <Icon name="key" size={15} /> Change password
            </button>
            {isManager ? (
              <button onClick={() => navigate('/users')}>
                <Icon name="users" size={15} /> Users &amp; audit trail
              </button>
            ) : null}
            <hr />
            <button className="danger" onClick={logout}>
              <Icon name="logout" size={15} /> Sign out
            </button>
          </Dropdown>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
