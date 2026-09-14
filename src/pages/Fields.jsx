import { useMemo, useState } from 'react';
import api from '../api/client.js';
import DynamicField from '../components/DynamicField.jsx';
import Icon from '../components/Icon.jsx';
import { Badge, Confirm, Empty, Loading, Modal } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const TYPES = [
  { value: 'text', label: 'Short text', hint: 'A single line — names, codes, references.' },
  { value: 'textarea', label: 'Long text', hint: 'A paragraph — notes, specifications.' },
  { value: 'number', label: 'Number', hint: 'Quantities, weights, ratings.' },
  { value: 'date', label: 'Date', hint: 'Calibration due, inspection date.' },
  { value: 'select', label: 'Dropdown', hint: 'One choice from a fixed list.' },
  { value: 'multiselect', label: 'Multi-select', hint: 'Any number of choices from a list.' },
  { value: 'checkbox', label: 'Yes / No', hint: 'A simple tick box.' },
  { value: 'email', label: 'Email', hint: 'An email address.' },
  { value: 'phone', label: 'Phone', hint: 'A contact number.' },
  { value: 'url', label: 'Link', hint: 'A web address or document link.' },
];

const BLANK = {
  label: '', type: 'text', scope: 'item', options: '', helpText: '',
  placeholder: '', unit: '', group: 'Custom Fields', required: false, visible: true, showInTable: false,
};

export default function Fields() {
  const { isAdmin } = useAuth();
  const { fields, loading, refresh } = useMeta();
  const toast = useToast();

  const [scope, setScope] = useState('item');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rows = useMemo(
    () => fields.filter((f) => f.scope === scope).sort((a, b) => a.order - b.order),
    [fields, scope]
  );

  const systemRows = rows.filter((f) => f.isSystem);
  const customRows = rows.filter((f) => !f.isSystem);

  function openNew() {
    setForm({ ...BLANK, scope });
    setError('');
    setEditing({ isNew: true });
  }

  function openEdit(f) {
    setForm({
      label: f.label, type: f.type, scope: f.scope, options: (f.options || []).join(', '),
      helpText: f.helpText || '', placeholder: f.placeholder || '', unit: f.unit || '',
      group: f.group || 'Custom Fields', required: f.required, visible: f.visible, showInTable: f.showInTable,
    });
    setError('');
    setEditing(f);
  }

  async function save(e) {
    e.preventDefault();
    setError('');

    if (!form.label.trim()) return setError('Give the field a label — that is what people will see on the form.');
    if (['select', 'multiselect'].includes(form.type) && !form.options.trim()) {
      return setError('A dropdown needs at least one option. Separate them with commas.');
    }

    setBusy(true);
    try {
      const payload = { ...form, options: form.options.split(',').map((o) => o.trim()).filter(Boolean) };

      if (editing.isNew) {
        const { data } = await api.post('/fields', payload);
        toast.success('Field added', `"${data.field.label}" now appears on every ${scope} form.`);
      } else {
        await api.put(`/fields/${editing._id}`, payload);
        toast.success('Field updated', `"${form.label}" was saved.`);
      }
      await refresh();
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(f, key) {
    try {
      await api.put(`/fields/${f._id}`, { [key]: !f[key] });
      await refresh();
    } catch (err) {
      toast.error('Could not update the field', err.message);
    }
  }

  async function remove(f, purge = false) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/fields/${f._id}`, { params: purge ? { purge: true } : {} });
      toast.success('Field removed', data.message);
      await refresh();
      setConfirm(null);
    } catch (err) {
      // A 409 means the field still holds data — offer the purge as a second step.
      if (/purge=true/.test(err.message)) {
        setConfirm({
          field: f,
          purge: true,
          title: `Delete "${f.label}" and its data?`,
          message: err.message.replace(' Re-send with purge=true to delete the field and that data.', ' Deleting it will also clear that data permanently.'),
          label: 'Delete field and data',
        });
      } else {
        toast.error('Could not remove the field', err.message);
        setConfirm(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading field definitions…" />;

  const previewDef = {
    key: 'preview',
    label: form.label || 'Your new field',
    type: form.type,
    options: form.options.split(',').map((o) => o.trim()).filter(Boolean),
    required: form.required,
    helpText: form.helpText,
    placeholder: form.placeholder,
    unit: form.unit,
    scope: form.scope,
  };

  const Row = ({ f }) => (
    <tr>
      <td>
        <div className="cell-main">
          {f.label}
          {f.locked ? (
            <span style={{ marginLeft: 7 }}>
              <Badge tone="navy">Core</Badge>
            </span>
          ) : null}
          {!f.visible ? (
            <span style={{ marginLeft: 7 }}>
              <Badge tone="grey">Hidden</Badge>
            </span>
          ) : null}
        </div>
        <div className="cell-sub">
          {f.key}
          {f.helpText ? ` · ${f.helpText}` : ''}
        </div>
      </td>
      <td>
        <Badge tone="grey">{TYPES.find((t) => t.value === f.type)?.label || f.type}</Badge>
        {f.options?.length ? <div className="cell-sub">{f.options.slice(0, 3).join(', ')}{f.options.length > 3 ? `, +${f.options.length - 3}` : ''}</div> : null}
      </td>
      <td>{f.group}</td>
      <td>
        <label className="checkbox">
          <input type="checkbox" checked={f.required} disabled={f.locked} onChange={() => toggle(f, 'required')} />
          <span className="small">Required</span>
        </label>
      </td>
      <td>
        <label className="checkbox">
          <input type="checkbox" checked={f.visible} disabled={f.locked} onChange={() => toggle(f, 'visible')} />
          <span className="small">Shown</span>
        </label>
      </td>
      <td>
        <label className="checkbox">
          <input type="checkbox" checked={f.showInTable} onChange={() => toggle(f, 'showInTable')} />
          <span className="small">In table</span>
        </label>
      </td>
      <td>
        <div className="actions">
          <button className="icon-btn" title="Edit" onClick={() => openEdit(f)}>
            <Icon name="edit" size={14} />
          </button>
          {isAdmin && !f.locked ? (
            <button
              className="icon-btn danger"
              title={f.isSystem ? 'Hide this built-in field' : 'Delete this field'}
              onClick={() =>
                setConfirm({
                  field: f,
                  purge: false,
                  title: f.isSystem ? `Hide "${f.label}"?` : `Delete "${f.label}"?`,
                  message: f.isSystem
                    ? 'This is a built-in attribute, so it will be hidden from every form rather than deleted. You can switch it back on at any time.'
                    : `"${f.label}" will be removed from every ${f.scope} form. If any records already hold a value for it, you will be asked to confirm clearing that data.`,
                  label: f.isSystem ? 'Hide field' : 'Delete field',
                })
              }
            >
              <Icon name={f.isSystem ? 'eye' : 'trash'} size={14} />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );

  return (
    <>
      <div className="card mb">
        <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Icon name="sliders" size={22} style={{ color: 'var(--red-600)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <h3 style={{ fontSize: 14.5, fontWeight: 700 }}>Shape the forms to match how your team actually works</h3>
            <p className="muted small" style={{ marginTop: 3, maxWidth: 720 }}>
              Everything below is a field on the add / edit form. Turn the built-in ones off if you do not use them, and add
              your own — calibration due date, warranty vendor, panel number, anything. New fields appear on the forms, in the
              detail view, in search filters and in the CSV export straight away.
            </p>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={scope === 'item' ? 'active' : ''} onClick={() => setScope('item')}>
          Material fields
        </button>
        <button className={scope === 'transaction' ? 'active' : ''} onClick={() => setScope('transaction')}>
          Movement fields
        </button>
      </div>

      <div className="toolbar">
        <p className="muted small" style={{ flex: 1 }}>
          {scope === 'item'
            ? 'These appear when adding or editing a material.'
            : 'These appear when recording an issue, receipt or return.'}
        </p>
        <button className="btn btn-red" onClick={openNew}>
          <Icon name="plus" size={15} /> Add a field
        </button>
      </div>

      <div className="card mb">
        <div className="card-head">
          <div style={{ flex: 1 }}>
            <h3>Your custom fields</h3>
            <p>Fields your team created. These can be edited, reordered or deleted freely.</p>
          </div>
          <Badge tone="red">{customRows.length}</Badge>
        </div>
        <div className="card-body flush">
          {customRows.length === 0 ? (
            <Empty
              icon="sliders"
              title="No custom fields yet"
              message={`Add one and it appears on every ${scope === 'item' ? 'material' : 'movement'} form immediately.`}
              action={
                <button className="btn btn-red" onClick={openNew}>
                  <Icon name="plus" size={15} /> Add your first field
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Group</th>
                    <th />
                    <th />
                    <th />
                    <th style={{ width: 80 }} />
                  </tr>
                </thead>
                <tbody>
                  {customRows.map((f) => (
                    <Row key={f._id} f={f} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div style={{ flex: 1 }}>
            <h3>Built-in fields</h3>
            <p>Rename, reorder, require or hide them. Core fields marked below always stay on.</p>
          </div>
          <Badge tone="navy">{systemRows.length}</Badge>
        </div>
        <div className="card-body flush">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Group</th>
                  <th />
                  <th />
                  <th />
                  <th style={{ width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {systemRows.map((f) => (
                  <Row key={f._id} f={f} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        title={editing?.isNew ? 'Add a field' : `Edit "${editing?.label}"`}
        subtitle={
          editing?.isNew
            ? `It will appear on every ${form.scope === 'item' ? 'material' : 'movement'} form right away.`
            : editing?.isSystem
              ? 'This is a built-in field — the label and behaviour can change, the type cannot.'
              : 'Changes apply everywhere this field is used.'
        }
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setEditing(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="field-form" className="btn btn-red" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="save" size={15} />} Save field
            </button>
          </>
        }
      >
        {error ? <div className="alert error">{error}</div> : null}

        <form id="field-form" onSubmit={save}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="flabel">
                Label<span className="req">*</span>
              </label>
              <input
                id="flabel"
                className="input"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Calibration due date"
                required
                autoFocus
              />
              <div className="hint">This is the wording people see on the form.</div>
            </div>

            <div className="field">
              <label htmlFor="ftype">Type of answer</label>
              <select
                id="ftype"
                className="select"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                disabled={editing && !editing.isNew && editing.isSystem}
              >
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="hint">{TYPES.find((t) => t.value === form.type)?.hint}</div>
            </div>

            {editing?.isNew ? (
              <div className="field">
                <label htmlFor="fscope">Which form?</label>
                <select id="fscope" className="select" value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}>
                  <option value="item">Material (add / edit an item)</option>
                  <option value="transaction">Movement (issue / receive / return)</option>
                </select>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="fgroup">Group heading</label>
              <input id="fgroup" className="input" value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))} placeholder="Custom Fields" />
              <div className="hint">Fields sharing a heading are shown together.</div>
            </div>

            {['select', 'multiselect'].includes(form.type) ? (
              <div className="field span-2">
                <label htmlFor="fopts">
                  Options<span className="req">*</span>
                </label>
                <textarea
                  id="fopts"
                  className="textarea"
                  rows={2}
                  value={form.options}
                  onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))}
                  placeholder="Yearly, Half-yearly, Quarterly"
                />
                <div className="hint">Separate each choice with a comma.</div>
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="fph">Placeholder</label>
              <input id="fph" className="input" value={form.placeholder} onChange={(e) => setForm((f) => ({ ...f, placeholder: e.target.value }))} placeholder="Faint example text inside the box" />
            </div>

            <div className="field">
              <label htmlFor="funit">Unit</label>
              <input id="funit" className="input" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="e.g. months, V, A" />
            </div>

            <div className="field span-2">
              <label htmlFor="fhelp">Help text</label>
              <input id="fhelp" className="input" value={form.helpText} onChange={(e) => setForm((f) => ({ ...f, helpText: e.target.value }))} placeholder="A short note shown under the field." />
            </div>

            <div className="field span-2">
              <div style={{ display: 'grid', gap: 9 }}>
                <label className="checkbox">
                  <input type="checkbox" checked={form.required} onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))} />
                  <span>
                    Required
                    <div className="hint" style={{ marginTop: 1 }}>The form cannot be saved without it.</div>
                  </span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={form.visible} onChange={(e) => setForm((f) => ({ ...f, visible: e.target.checked }))} />
                  <span>
                    Shown on the form
                    <div className="hint" style={{ marginTop: 1 }}>Switch off to retire a field without losing its data.</div>
                  </span>
                </label>
                <label className="checkbox">
                  <input type="checkbox" checked={form.showInTable} onChange={(e) => setForm((f) => ({ ...f, showInTable: e.target.checked }))} />
                  <span>
                    Show as a column in the list
                    <div className="hint" style={{ marginTop: 1 }}>Up to three custom columns appear in the inventory table.</div>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="fieldset-title">Preview</div>
          <div style={{ background: 'var(--grey-50)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px 16px 2px' }}>
            <DynamicField def={previewDef} value={previewDef.type === 'multiselect' ? [] : ''} onChange={() => {}} />
          </div>
        </form>
      </Modal>

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label || 'Remove'}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm.field, confirm.purge)}
      />
    </>
  );
}
