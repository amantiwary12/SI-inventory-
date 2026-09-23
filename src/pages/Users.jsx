import { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import { Badge, Confirm, Empty, Loading, Modal, fmtAgo, fmtDateTime, initials } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

const ROLES = [
  { value: 'admin', label: 'Administrator', tone: 'red', hint: 'Full control, including users, fields and permanent deletes.' },
  { value: 'manager', label: 'Manager', tone: 'navy', hint: 'Everything except user management and permanent deletes.' },
  { value: 'storekeeper', label: 'Store keeper', tone: 'blue', hint: 'Can add materials and record movements — or be limited to just issue / receive / return.' },
  { value: 'viewer', label: 'Viewer', tone: 'grey', hint: 'Read-only access to stock and reports.' },
];

const BLANK = { name: '', email: '', password: '', role: 'viewer', transactionsOnly: false, employeeId: '', department: 'System Integration', phone: '' };

export default function Users() {
  const { isAdmin, user: me } = useAuth();
  const { masters } = useMeta();
  const toast = useToast();

  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (opts) => {
    if (opts?.silent !== true) setLoading(true);
    try {
      if (tab === 'users') {
        const { data } = await api.get('/users', { params: { search, includeInactive: includeInactive ? 'true' : '' } });
        setUsers(data.users);
      } else {
        const { data } = await api.get('/users/activity', { params: { limit: 100 } });
        setLogs(data.logs);
      }
    } catch (err) {
      toast.error('Could not load this page', err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, search, includeInactive, toast]);

  useEffect(() => {
    const t = setTimeout(load, 240);
    return () => clearTimeout(t);
  }, [load]);

  // The audit trail grows with every change anywhere; the team list only with account changes.
  useLiveUpdates(tab === 'activity' ? ['*'] : ['users'], () => load({ silent: true }));

  function openNew() {
    setForm(BLANK);
    setError('');
    setEditing({ isNew: true });
  }

  function openEdit(u) {
    setForm({ ...BLANK, ...u, password: '' });
    setError('');
    setEditing(u);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Enter the person’s name.');
    if (editing.isNew && !form.email.trim()) return setError('Enter an email address.');
    if (editing.isNew && form.password.length < 6) return setError('Set a temporary password of at least 6 characters.');

    setBusy(true);
    try {
      if (editing.isNew) {
        await api.post('/users', form);
        toast.success('Account created', `${form.name} has been emailed their sign-in details.`);
      } else {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        delete payload.email;
        await api.put(`/users/${editing.id}`, payload);
        toast.success('Account updated', `${form.name}'s details were saved.`);
      }
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(u, active) {
    try {
      await api.put(`/users/${u.id}`, { active });
      toast.success(active ? 'Account reactivated' : 'Account deactivated', `${u.name} ${active ? 'can sign in again.' : 'can no longer sign in.'}`);
      // Otherwise a just-deactivated person drops off this list immediately,
      // and there is no way back to their Reactivate button.
      if (!active) setIncludeInactive(true);
      load();
    } catch (err) {
      toast.error('Could not update the account', err.message);
    }
  }

  async function remove(u) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/users/${u.id}`);
      toast.success('Account deleted', data.message);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error('Could not delete the account', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          Team members
        </button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
          Audit trail
        </button>
      </div>

      {tab === 'users' ? (
        <>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={16} />
              <input className="input" placeholder="Search by name, email, employee ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
              <span>Include deactivated</span>
            </label>
            <div style={{ flex: 1 }} />
            {isAdmin ? (
              <button className="btn btn-red" onClick={openNew}>
                <Icon name="plus" size={15} /> Add a team member
              </button>
            ) : null}
          </div>

          <div className="grid three mb">
            {ROLES.map((r) => (
              <div key={r.value} className="card">
                <div className="card-body" style={{ padding: '13px 15px' }}>
                  <div className="flex-between">
                    <Badge tone={r.tone}>{r.label}</Badge>
                    <b style={{ fontSize: 17 }}>{users.filter((u) => u.role === r.value).length}</b>
                  </div>
                  <p className="muted small" style={{ marginTop: 6 }}>
                    {r.hint}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            {loading ? (
              <Loading label="Loading the team…" />
            ) : users.length === 0 ? (
              <Empty icon="users" title="No team members found" message="Try a different search, or add someone." />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Role</th>
                      <th>Employee ID</th>
                      <th>Department</th>
                      <th>Last sign-in</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const role = ROLES.find((r) => r.value === u.role);
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="flex">
                              <span className="avatar">{u.avatar?.url ? <img src={u.avatar.url} alt="" /> : initials(u.name)}</span>
                              <div>
                                <div className="cell-main">
                                  {u.name}
                                  {u.id === me.id ? <span className="cell-sub"> (you)</span> : null}
                                  {!u.active ? (
                                    <span style={{ marginLeft: 7 }}>
                                      <Badge tone="grey">Deactivated</Badge>
                                    </span>
                                  ) : null}
                                </div>
                                <div className="cell-sub">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge tone={role?.tone || 'grey'}>{role?.label || u.role}</Badge>
                            {u.role === 'storekeeper' && u.transactionsOnly ? (
                              <div className="cell-sub" style={{ marginTop: 3 }}>
                                Transactions only
                              </div>
                            ) : null}
                          </td>
                          <td>{u.employeeId || <span className="muted">—</span>}</td>
                          <td>{u.department || <span className="muted">—</span>}</td>
                          <td className="small muted nowrap">{u.lastLogin ? fmtAgo(u.lastLogin) : 'Never'}</td>
                          <td>
                            <div className="actions">
                              {isAdmin ? (
                                <>
                                  <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => openEdit(u)}>
                                    <Icon name="edit" size={14} />
                                  </button>
                                  {u.id !== me.id ? (
                                    <>
                                      {u.active ? (
                                        <button className="icon-btn" title="Deactivate" aria-label="Deactivate" onClick={() => setActive(u, false)}>
                                          <Icon name="lock" size={14} />
                                        </button>
                                      ) : (
                                        <button className="icon-btn" title="Reactivate" aria-label="Reactivate" onClick={() => setActive(u, true)}>
                                          <Icon name="unlock" size={14} />
                                        </button>
                                      )}
                                      <button
                                        className="icon-btn danger"
                                        title="Delete"
                                        aria-label="Delete"
                                        onClick={() =>
                                          setConfirm({
                                            user: u,
                                            title: `Delete ${u.name}'s account?`,
                                            message: `${u.name} will lose access immediately. Movements they recorded stay in the history. Deactivating instead keeps the account recoverable.`,
                                          })
                                        }
                                      >
                                        <Icon name="trash" size={14} />
                                      </button>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Audit trail</h3>
              <p>Every create, update, delete and stock movement, most recent first.</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={load}>
              <Icon name="refresh" size={14} /> Refresh
            </button>
          </div>
          <div className="card-body flush">
            {loading ? (
              <Loading label="Loading the audit trail…" />
            ) : logs.length === 0 ? (
              <Empty icon="activity" title="Nothing recorded yet" message="Actions will appear here as your team uses the dashboard." />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>Action</th>
                      <th>What happened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l._id}>
                        <td className="nowrap small muted">{fmtDateTime(l.createdAt)}</td>
                        <td className="cell-main">{l.userName}</td>
                        <td>
                          <Badge tone={['delete', 'archive'].includes(l.action) ? 'red' : l.action === 'create' ? 'green' : 'grey'}>
                            {l.action}
                          </Badge>
                        </td>
                        <td>{l.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        title={editing?.isNew ? 'Add a team member' : `Edit ${editing?.name}`}
        subtitle={editing?.isNew ? 'They are emailed their sign-in details automatically.' : 'Leave the password blank to keep their current one.'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="user-form" className="btn btn-red" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="save" size={15} />} Save
            </button>
          </>
        }
      >
        {error ? <div className="alert error">{error}</div> : null}

        <form id="user-form" onSubmit={save}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="uname">
                Full name<span className="req">*</span>
              </label>
              <input id="uname" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
            </div>

            <div className="field">
              <label htmlFor="uemail">
                Email<span className="req">*</span>
              </label>
              <input
                id="uemail"
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                disabled={!editing?.isNew}
                required
              />
              {!editing?.isNew ? <div className="hint">The email address cannot be changed.</div> : null}
            </div>

            <div className="field">
              <label htmlFor="urole">Role</label>
              <select
                id="urole"
                className="select"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, transactionsOnly: e.target.value === 'storekeeper' ? f.transactionsOnly : false }))}
                disabled={editing?.id === me.id}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <div className="hint">{ROLES.find((r) => r.value === form.role)?.hint}</div>
            </div>

            {form.role === 'storekeeper' ? (
              <div className="field span-2">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={form.transactionsOnly}
                    onChange={(e) => setForm((f) => ({ ...f, transactionsOnly: e.target.checked }))}
                  />
                  <span>
                    Limit to issue / receive / return only
                    <div className="hint" style={{ marginTop: 1 }}>
                      They can record movements but cannot add, edit, archive or import materials, or change master lists.
                    </div>
                  </span>
                </label>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="upass">{editing?.isNew ? 'Temporary password' : 'New password'}</label>
              <input
                id="upass"
                className="input"
                type="text"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editing?.isNew ? 'At least 6 characters' : 'Leave blank to keep the current one'}
                minLength={editing?.isNew ? 6 : 0}
              />
            </div>

            <div className="field">
              <label htmlFor="uemp">Employee ID</label>
              <input id="uemp" className="input" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
            </div>

            <div className="field">
              <label htmlFor="udept">Department</label>
              <select id="udept" className="select" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                {masters.department.map((d) => (
                  <option key={d._id} value={d.name}>
                    {d.name}
                  </option>
                ))}
                {form.department && !masters.department.some((d) => d.name === form.department) ? (
                  <option value={form.department}>{form.department}</option>
                ) : null}
              </select>
            </div>

            <div className="field">
              <label htmlFor="uphone">Phone</label>
              <input id="uphone" className="input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
        </form>
      </Modal>

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Delete account"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm.user)}
      />
    </>
  );
}
