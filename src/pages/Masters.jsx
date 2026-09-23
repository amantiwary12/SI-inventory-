import { useMemo, useState } from 'react';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import { Confirm, Empty, Loading, Modal } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const GROUPS = [
  { type: 'category', label: 'Categories', icon: 'tag', hint: 'The top-level grouping for every material.' },
  { type: 'subCategory', label: 'Sub categories', icon: 'layers', hint: 'A finer split inside a category.' },
  { type: 'location', label: 'Stores & locations', icon: 'map-pin', hint: 'Where material physically sits.' },
  { type: 'rack', label: 'Racks & bins', icon: 'grid', hint: 'The shelf or bin inside a store.' },
  { type: 'department', label: 'Departments', icon: 'building', hint: 'AIC, R&D, Production and anyone else you issue to.' },
  { type: 'vendor', label: 'Vendors & suppliers', icon: 'truck', hint: 'Who supplies the material.' },
  { type: 'unit', label: 'Units of measure', icon: 'box', hint: 'Nos, Mtr, Kg, Set and so on.' },
  { type: 'project', label: 'Projects', icon: 'clock', hint: 'Tag movements against a job or project.' },
  { type: 'source', label: 'Sources', icon: 'inbox', hint: 'Where incoming material came from.' },
  { type: 'condition', label: 'Conditions', icon: 'shield', hint: 'The condition states a material can be in.' },
];

export default function Masters() {
  const { canManageInventory, isManager } = useAuth();
  const { masters, loading, refresh } = useMeta();
  const toast = useToast();

  const [active, setActive] = useState('category');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', parent: '', description: '' });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const group = GROUPS.find((g) => g.type === active);
  const rows = useMemo(() => {
    const list = masters[active] || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(q) || (r.parent || '').toLowerCase().includes(q));
  }, [masters, active, search]);

  function openNew() {
    setForm({ name: '', parent: '', description: '' });
    setError('');
    setEditing({ isNew: true });
  }

  function openEdit(row) {
    setForm({ name: row.name, parent: row.parent || '', description: row.description || '' });
    setError('');
    setEditing(row);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Please enter a name.');

    setBusy(true);
    try {
      if (editing.isNew) {
        const { data } = await api.post('/masters', { type: active, ...form });
        toast.success('Added', data.message || `"${form.name}" is now available in ${group.label.toLowerCase()}.`);
      } else {
        await api.put(`/masters/${editing._id}`, { ...form, cascadeRename: true });
        toast.success('Updated', `Renamed to "${form.name}" everywhere it was used.`);
      }
      await refresh();
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row, hard) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/masters/${row._id}`, { params: hard ? { hard: true } : {} });
      toast.success('Removed', data.message);
      await refresh();
      setConfirm(null);
    } catch (err) {
      toast.error('Could not remove it', err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading master lists…" />;

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(210px, 250px) 1fr', alignItems: 'start' }}>
        <div className="card">
          <div className="card-head">
            <h3>Lists</h3>
          </div>
          <div className="card-body" style={{ padding: 8 }}>
            {GROUPS.map((g) => (
              <button
                key={g.type}
                onClick={() => setActive(g.type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 11px',
                  border: 0,
                  borderRadius: 'var(--radius-sm)',
                  background: active === g.type ? 'var(--navy-50)' : 'none',
                  color: active === g.type ? 'var(--navy-800)' : 'var(--grey-600)',
                  fontWeight: active === g.type ? 700 : 500,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderLeft: `3px solid ${active === g.type ? 'var(--red-600)' : 'transparent'}`,
                }}
              >
                <Icon name={g.icon} size={15} />
                <span style={{ flex: 1 }}>{g.label}</span>
                <span className="cell-sub">{(masters[g.type] || []).length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <Icon name={group.icon} size={17} style={{ color: 'var(--navy-600)' }} />
            <div style={{ flex: 1 }}>
              <h3>{group.label}</h3>
              <p>{group.hint}</p>
            </div>
            {canManageInventory ? (
              <button className="btn btn-red btn-sm" onClick={openNew}>
                <Icon name="plus" size={14} /> Add
              </button>
            ) : null}
          </div>

          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="search" style={{ maxWidth: '100%' }}>
              <Icon name="search" size={16} />
              <input className="input" placeholder={`Search ${group.label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="card-body flush" style={{ marginTop: 14 }}>
            {rows.length === 0 ? (
              <Empty
                icon={group.icon}
                title={search ? 'Nothing matches that search' : `No ${group.label.toLowerCase()} yet`}
                message={search ? 'Try a different term.' : 'Add the first one and it will appear in every dropdown that uses this list.'}
                action={canManageInventory && !search ? <button className="btn btn-red" onClick={openNew}><Icon name="plus" size={15} /> Add {group.label.toLowerCase().replace(/s$/, '')}</button> : null}
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Name</th>
                      {active === 'subCategory' ? <th>Parent category</th> : null}
                      <th>Description</th>
                      <th style={{ width: 84 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id}>
                        <td className="cell-main">{r.name}</td>
                        {active === 'subCategory' ? <td>{r.parent || <span className="muted">—</span>}</td> : null}
                        <td className="small muted">{r.description || '—'}</td>
                        <td>
                          <div className="actions">
                            {canManageInventory ? (
                              <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => openEdit(r)}>
                                <Icon name="edit" size={14} />
                              </button>
                            ) : null}
                            {isManager ? (
                              <button
                                className="icon-btn danger"
                                title="Remove"
                                aria-label="Remove"
                                onClick={() =>
                                  setConfirm({
                                    row: r,
                                    title: `Remove "${r.name}"?`,
                                    message: `It will stop appearing in new dropdowns. Materials already using "${r.name}" keep their value, so nothing breaks.`,
                                  })
                                }
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing?.isNew ? `Add to ${group.label.toLowerCase()}` : `Edit "${editing?.name}"`}
        subtitle={editing?.isNew ? 'It becomes available in every dropdown that uses this list.' : 'Renaming updates every material already using this value.'}
        onClose={() => setEditing(null)}
        width="narrow"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="master-form" className="btn btn-red" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="save" size={15} />} Save
            </button>
          </>
        }
      >
        {error ? <div className="alert error">{error}</div> : null}
        <form id="master-form" onSubmit={save}>
          <div className="field">
            <label htmlFor="mname">
              Name<span className="req">*</span>
            </label>
            <input id="mname" className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
          </div>

          {active === 'subCategory' ? (
            <div className="field">
              <label htmlFor="mparent">Parent category</label>
              <select id="mparent" className="select" value={form.parent} onChange={(e) => setForm((f) => ({ ...f, parent: e.target.value }))}>
                <option value="">— None —</option>
                {masters.category.map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="mdesc">Description</label>
            <textarea id="mdesc" className="textarea" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional note for your team." />
          </div>
        </form>
      </Modal>

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Remove"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm.row, false)}
      />
    </>
  );
}
