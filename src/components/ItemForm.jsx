import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api/client.js';
import DynamicField from './DynamicField.jsx';
import Icon from './Icon.jsx';
import { Modal } from './ui.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const BLANK = {
  name: '', itemCode: '', category: '', subCategory: '', description: '',
  make: '', model: '', serialNumber: '', partNumber: '', specification: '',
  quantity: '', unit: 'Nos', condition: 'New', reorderLevel: '',
  vendor: '', poNumber: '', invoiceNumber: '', purchaseDate: '', warrantyExpiry: '',
  location: '', rack: '', ownerDepartment: 'System Integration', project: '', source: '', remarks: '',
  custom: {},
};

/**
 * Add / edit a material. Every input on this form comes from a FieldDef, so
 * whatever the team adds under Custom Fields appears here automatically and
 * whatever they hide disappears.
 */
export default function ItemForm({ open, item, onClose, onSaved }) {
  const { itemFields, optionsFor, refresh } = useMeta();
  const toast = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState('');

  const isEdit = Boolean(item?._id);

  useEffect(() => {
    if (!open) return;
    setError('');
    setImageFile(null);

    if (item) {
      const next = { ...BLANK };
      Object.keys(BLANK).forEach((k) => {
        if (k === 'custom') return;
        const v = item[k];
        next[k] = v === undefined || v === null ? '' : k.includes('Date') || k === 'warrantyExpiry' ? String(v).slice(0, 10) : v;
      });
      next.custom = { ...(item.custom || {}) };
      setForm(next);
      setPreview(item.image?.url || '');
    } else {
      setForm({ ...BLANK, custom: {} });
      setPreview('');
    }
  }, [open, item]);

  /** Visible built-in fields, grouped in the order the admin arranged them. */
  const groups = useMemo(() => {
    const visible = itemFields.filter((f) => f.visible);
    const out = [];
    visible.forEach((f) => {
      let g = out.find((x) => x.name === f.group);
      if (!g) {
        g = { name: f.group || 'General', fields: [] };
        out.push(g);
      }
      g.fields.push(f);
    });
    return out;
  }, [itemFields]);

  const setValue = (def) => (value) => {
    if (def.isSystem) setForm((f) => ({ ...f, [def.key]: value }));
    else setForm((f) => ({ ...f, custom: { ...f.custom, [def.key]: value } }));
  };

  const valueOf = (def) => (def.isSystem ? form[def.key] : form.custom?.[def.key]);

  function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large', 'Please choose a file under 10 MB.');
      return;
    }
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!form.name?.trim()) return setError('Item name is required.');
    if (form.quantity === '' || Number(form.quantity) < 0) return setError('Enter a quantity of zero or more.');

    setBusy(true);
    try {
      const payload = { ...form };
      ['quantity', 'reorderLevel'].forEach((k) => {
        payload[k] = payload[k] === '' ? 0 : Number(payload[k]);
      });
      // Drop empty date strings so Mongo does not try to cast them.
      ['purchaseDate', 'warrantyExpiry'].forEach((k) => {
        if (!payload[k]) delete payload[k];
      });

      const { data } = isEdit ? await api.put(`/items/${item._id}`, payload) : await api.post('/items', payload);

      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await api.post(`/items/${data.item._id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      toast.success(isEdit ? 'Item updated' : 'Item added', `${data.item.itemCode} — ${data.item.name}`);
      await refresh();
      onSaved?.(data.item);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      width="wide"
      title={isEdit ? `Edit ${item.itemCode}` : 'Add a material'}
      subtitle={
        isEdit
          ? 'Changing the quantity here corrects the count without creating a separate update entry.'
          : 'The opening quantity is recorded as a RECEIVE entry so it stays auditable.'
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="btn btn-red" disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="save" size={15} />}
            {isEdit ? 'Save changes' : 'Add material'}
          </button>
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <form id="item-form" onSubmit={submit}>
        <div className="flex mb" style={{ alignItems: 'flex-start', gap: 16 }}>
          <div
            className="thumb"
            style={{ width: 82, height: 82, borderRadius: 'var(--radius)', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}
            title="Click to choose a photo"
          >
            {preview ? <img src={preview} alt="" /> : <Icon name="image" size={26} strokeWidth={1.5} />}
          </div>
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={14} /> {preview ? 'Change photo' : 'Add a photo'}
            </button>
            <div className="hint" style={{ marginTop: 6 }}>
              Optional. JPG or PNG up to 10 MB — helpful for identifying look-alike parts.
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.name}>
            <div className="form-grid">
              <div className="fieldset-title">{g.name}</div>
              {g.fields.map((def) => (
                <DynamicField
                  key={`${def.scope}-${def.key}`}
                  def={def}
                  value={valueOf(def)}
                  onChange={setValue(def)}
                  options={def.type === 'select' && def.isSystem ? optionsFor(def.key) : undefined}
                  disabled={busy}
                />
              ))}
            </div>
          </div>
        ))}
      </form>
    </Modal>
  );
}
