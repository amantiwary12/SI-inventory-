import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import { Badge, Confirm, Modal, initials } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const ICONS = ['box', 'grid', 'exchange', 'undo', 'chart', 'list', 'sliders', 'users', 'gear', 'wrench', 'cart', 'qr', 'truck', 'shield', 'clock', 'tag', 'inbox', 'activity'];

export default function Settings() {
  const { user, setUser, isAdmin } = useAuth();
  const { masters, modules, refresh } = useMeta();
  const toast = useToast();
  const avatarRef = useRef(null);

  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ name: '', employeeId: '', department: '', phone: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [moduleForm, setModuleForm] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (user) setProfile({ name: user.name, employeeId: user.employeeId || '', department: user.department || '', phone: user.phone || '' });
  }, [user]);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.put('/auth/me', profile);
      setUser(data.user);
      toast.success('Profile saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const fd = new FormData();
    fd.append('avatar', file);
    setBusy(true);
    try {
      const { data } = await api.post('/auth/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(data.user);
      toast.success('Photo updated');
    } catch (err) {
      toast.error('Upload failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setError('');
    if (pwd.newPassword !== pwd.confirm) return setError('The two new passwords do not match.');

    setBusy(true);
    try {
      await api.put('/auth/password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed', 'Use your new password from the next sign-in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleModule(m) {
    try {
      await api.put(`/modules/${m._id}`, { enabled: !m.enabled });
      await refresh();
      toast.success(m.enabled ? `${m.label} hidden` : `${m.label} enabled`);
    } catch (err) {
      toast.error('Could not update the module', err.message);
    }
  }

  async function saveModule(e) {
    e.preventDefault();
    setError('');
    if (!moduleForm.label.trim()) return setError('Give the tool a name.');
    if (!moduleForm.path && !moduleForm.externalUrl) return setError('Add an in-app path or an external link.');

    setBusy(true);
    try {
      if (moduleForm.isNew) await api.post('/modules', moduleForm);
      else await api.put(`/modules/${moduleForm._id}`, moduleForm);
      await refresh();
      setModuleForm(null);
      toast.success('Saved', 'The sidebar has been updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeModule(m) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/modules/${m._id}`);
      await refresh();
      toast.success('Removed', data.message);
      setConfirm(null);
    } catch (err) {
      toast.error('Could not remove it', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="tabs">
        <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>
          My profile
        </button>
        <button className={tab === 'security' ? 'active' : ''} onClick={() => setTab('security')}>
          Password
        </button>
        {isAdmin ? (
          <button className={tab === 'modules' ? 'active' : ''} onClick={() => setTab('modules')}>
            Modules &amp; tools
          </button>
        ) : null}
        <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
          About
        </button>
      </div>

      {tab === 'profile' ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>My profile</h3>
              <p>How you appear on movements you record.</p>
            </div>
          </div>
          <div className="card-body">
            {error ? <div className="alert error">{error}</div> : null}

            <div className="flex mb" style={{ gap: 16 }}>
              <span className="avatar lg">{user?.avatar?.url ? <img src={user.avatar.url} alt="" /> : initials(user?.name)}</span>
              <div>
                <button className="btn btn-ghost btn-sm" onClick={() => avatarRef.current?.click()} disabled={busy}>
                  <Icon name="upload" size={14} /> Change photo
                </button>
                <div className="hint" style={{ marginTop: 5 }}>
                  {user?.email} · <Badge tone="navy">{user?.role}</Badge>
                </div>
                <input ref={avatarRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
              </div>
            </div>

            <form onSubmit={saveProfile}>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="pname">Full name</label>
                  <input id="pname" className="input" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} required />
                </div>
                <div className="field">
                  <label htmlFor="pemp">Employee ID</label>
                  <input id="pemp" className="input" value={profile.employeeId} onChange={(e) => setProfile((p) => ({ ...p, employeeId: e.target.value }))} />
                </div>
                <div className="field">
                  <label htmlFor="pdept">Department</label>
                  <select id="pdept" className="select" value={profile.department} onChange={(e) => setProfile((p) => ({ ...p, department: e.target.value }))}>
                    {masters.department.map((d) => (
                      <option key={d._id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    {profile.department && !masters.department.some((d) => d.name === profile.department) ? (
                      <option value={profile.department}>{profile.department}</option>
                    ) : null}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="pphone">Phone</label>
                  <input id="pphone" className="input" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-red" disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="save" size={15} />} Save profile
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="card" style={{ maxWidth: 470 }}>
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Change your password</h3>
              <p>Use at least 6 characters.</p>
            </div>
          </div>
          <div className="card-body">
            {error ? <div className="alert error">{error}</div> : null}
            <form onSubmit={changePassword}>
              <div className="field">
                <label htmlFor="cp">Current password</label>
                <input id="cp" className="input" type="password" value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} required autoComplete="current-password" />
              </div>
              <div className="field">
                <label htmlFor="np">New password</label>
                <input id="np" className="input" type="password" value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} required minLength={6} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="cnp">Confirm new password</label>
                <input id="cnp" className="input" type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} required minLength={6} autoComplete="new-password" />
              </div>
              <button className="btn btn-red" disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="key" size={15} />} Update password
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {tab === 'modules' && isAdmin ? (
        <>
          <div className="card mb">
            <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Icon name="grid" size={22} style={{ color: 'var(--red-600)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>Grow the dashboard as you need it</h3>
                <p className="muted small" style={{ marginTop: 3, maxWidth: 720 }}>
                  Switch modules on or off for the whole team, and pin new tools to the sidebar — either a page inside this app
                  or a link to something you already use.
                </p>
              </div>
            </div>
          </div>

          <div className="toolbar">
            <div style={{ flex: 1 }} />
            <button
              className="btn btn-red"
              onClick={() => {
                setError('');
                setModuleForm({ isNew: true, label: '', description: '', icon: 'box', path: '', externalUrl: '', enabled: true });
              }}
            >
              <Icon name="plus" size={15} /> Pin a tool
            </button>
          </div>

          <div className="grid three">
            {modules.map((m) => (
              <div key={m._id} className="card">
                <div className="card-body">
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: m.enabled ? 'var(--navy-50)' : 'var(--grey-100)',
                        color: m.enabled ? 'var(--navy-600)' : 'var(--grey-400)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon name={m.icon} size={17} />
                    </span>
                    <div className="flex" style={{ gap: 6 }}>
                      {m.isCore ? <Badge tone="navy">Core</Badge> : null}
                      <Badge tone={m.enabled ? 'green' : 'grey'} dot>
                        {m.enabled ? 'On' : 'Off'}
                      </Badge>
                    </div>
                  </div>

                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>{m.label}</h3>
                  <p className="muted small" style={{ marginTop: 3, minHeight: 34 }}>
                    {m.description || 'No description.'}
                  </p>
                  <p className="cell-sub" style={{ marginTop: 4 }}>
                    {m.externalUrl || m.path || 'Not linked yet'}
                  </p>

                  <div className="flex mt" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleModule(m)} disabled={m.isCore}>
                      <Icon name={m.enabled ? 'lock' : 'check'} size={13} /> {m.enabled ? 'Turn off' : 'Turn on'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setError('');
                        setModuleForm({ ...m });
                      }}
                    >
                      <Icon name="edit" size={13} /> Edit
                    </button>
                    {!m.isCore ? (
                      <button
                        className="icon-btn danger"
                        title="Remove from sidebar"
                        aria-label="Remove from sidebar"
                        onClick={() => setConfirm({ module: m, title: `Remove "${m.label}"?`, message: 'It disappears from the sidebar for everyone. No inventory data is affected.' })}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {tab === 'about' ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>About this dashboard</h3>
              <p>System Integration Inventory</p>
            </div>
          </div>
          <div className="card-body">
            <dl className="kv">
              <dt>Purpose</dt>
              <dd>Keep one list of every material the team holds, issues or receives — from AIC, vendors, other departments or individual employees.</dd>
              <dt>Signed in as</dt>
              <dd>
                {user?.name} ({user?.email}) · <Badge tone="navy">{user?.role}</Badge>
              </dd>
              <dt>Built with</dt>
              <dd>React + Vite frontend, Node.js + Express API, MongoDB, Cloudinary for images, Brevo for email.</dd>
              <dt>Extending it</dt>
              <dd>
                Add fields under <b>Custom Fields</b>, dropdown values under <b>Master Lists</b>, and new tools under{' '}
                <b>Modules &amp; tools</b> — all without a code change.
              </dd>
            </dl>
          </div>
        </div>
      ) : null}

      <Modal
        open={Boolean(moduleForm)}
        title={moduleForm?.isNew ? 'Pin a tool to the sidebar' : `Edit "${moduleForm?.label}"`}
        subtitle="Point it at a page inside this app, or link out to another system your team uses."
        onClose={() => setModuleForm(null)}
        width="narrow"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModuleForm(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="module-form" className="btn btn-red" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="save" size={15} />} Save
            </button>
          </>
        }
      >
        {error ? <div className="alert error">{error}</div> : null}
        {moduleForm ? (
          <form id="module-form" onSubmit={saveModule}>
            <div className="field">
              <label htmlFor="mlabel">
                Name<span className="req">*</span>
              </label>
              <input id="mlabel" className="input" value={moduleForm.label} onChange={(e) => setModuleForm((m) => ({ ...m, label: e.target.value }))} required autoFocus placeholder="e.g. Calibration Tracker" />
            </div>

            <div className="field">
              <label htmlFor="mdesc">Description</label>
              <input id="mdesc" className="input" value={moduleForm.description} onChange={(e) => setModuleForm((m) => ({ ...m, description: e.target.value }))} placeholder="Shown as a tooltip in the sidebar." />
            </div>

            <div className="field">
              <label htmlFor="micon">Icon</label>
              <select id="micon" className="select" value={moduleForm.icon} onChange={(e) => setModuleForm((m) => ({ ...m, icon: e.target.value }))}>
                {ICONS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="murl">External link</label>
              <input id="murl" className="input" type="url" value={moduleForm.externalUrl} onChange={(e) => setModuleForm((m) => ({ ...m, externalUrl: e.target.value }))} placeholder="https://…" />
              <div className="hint">Leave blank if this is a page inside the dashboard.</div>
            </div>

            <div className="field">
              <label htmlFor="mpath">In-app path</label>
              <input id="mpath" className="input" value={moduleForm.path} onChange={(e) => setModuleForm((m) => ({ ...m, path: e.target.value }))} placeholder="/maintenance" disabled={Boolean(moduleForm.externalUrl)} />
            </div>
          </form>
        ) : null}
      </Modal>

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Remove"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => removeModule(confirm.module)}
      />
    </>
  );
}
