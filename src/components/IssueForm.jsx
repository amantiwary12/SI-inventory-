import { useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import Icon from './Icon.jsx';
import { Modal, availableOf, fmtNum } from './ui.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

// Only the two things that actually happen at the counter: material goes out with
// somebody, and material comes back. Transfer, Correction, Receive and Write off
// were all dropped from here — stock still enters the system through the opening
// quantity on a new material, and through editing that material's quantity.
//
// Older RECEIVE / SCRAP / TRANSFER / ADJUST entries in the history stay exactly as
// they are and still show in Reports; this list only controls what can be recorded
// from now on.
const TYPES = [
  { value: 'ISSUE', label: 'Issue out', hint: 'Give material to a person, department or company.', icon: 'arrow-up' },
  { value: 'RETURN', label: 'Return in', hint: 'Material coming back that was issued out earlier.', icon: 'undo' },
];

const PARTY_KINDS = ['Employee', 'Department', 'Company', 'Vendor', 'Customer', 'Store', 'Other'];

const blankParty = () => ({ name: '', kind: 'Employee', department: '', employeeId: '', contact: '' });

/**
 * Records one inventory update. The `from` / `to` parties are free text plus a
 * kind, so material can come from AIC, a vendor, another department or an
 * individual without needing a master record for each one first.
 */
export default function IssueForm({ open, item, presetType = 'ISSUE', onClose, onSaved }) {
  const { masters } = useMeta();
  const toast = useToast();

  const [type, setType] = useState(presetType);
  const [form, setForm] = useState({
    quantity: '', condition: '', date: new Date().toISOString().slice(0, 10),
    docNumber: '', project: '', purpose: '', remarks: '',
    returnable: false, expectedReturnDate: '',
  });
  const [from, setFrom] = useState(blankParty());
  const [to, setTo] = useState(blankParty());
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Everything below is optional and rarely changed from its default, so it starts
  // collapsed — this is the whole point of keeping the form quick to fill in.
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(presetType);
    setError('');
    setMoreOpen(false);
    setForm({
      quantity: '', condition: item?.condition || 'Good', date: new Date().toISOString().slice(0, 10),
      docNumber: '', project: item?.project || '', purpose: '', remarks: '',
      returnable: false, expectedReturnDate: '',
    });
    setFrom({ ...blankParty(), kind: 'Department', name: item?.ownerDepartment || 'System Integration', department: item?.ownerDepartment || 'System Integration' });
    setTo(blankParty());

    api
      .get('/users')
      .then(({ data }) => setPeople(data.users))
      .catch(() => {});
  }, [open, item, presetType]);

  const available = availableOf(item);
  const cfg = TYPES.find((t) => t.value === type);

  /** Which side of the movement the user actually fills in. */
  const partySide = useMemo(() => (type === 'ISSUE' ? 'to' : 'from'), [type]);

  const maxQty = useMemo(() => {
    if (!item) return undefined;
    // Issuing is capped by what is on the shelf; returning, by what is out.
    return type === 'ISSUE' ? available : item.issuedQuantity;
  }, [item, type, available]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  function pickPerson(e) {
    const person = people.find((p) => p.id === e.target.value);
    const setter = partySide === 'to' ? setTo : setFrom;
    if (!person) return;
    setter((p) => ({ ...p, kind: 'Employee', name: person.name, employeeId: person.employeeId || '', department: person.department || '', contact: person.email }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    const qty = Number(form.quantity);
    if (!qty || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (maxQty !== undefined && qty > maxQty) {
      return setError(`Only ${fmtNum(maxQty)} ${item.unit} can be recorded this way right now.`);
    }
    if (partySide && !(partySide === 'to' ? to : from).name.trim()) {
      return setError(type === 'ISSUE' ? 'Enter who the material is being issued to.' : 'Enter where the material is coming from.');
    }
    if (form.returnable && !form.expectedReturnDate) {
      return setError('Pick an expected return date, or switch off "expected back".');
    }

    setBusy(true);
    try {
      const { data } = await api.post('/transactions', {
        type,
        item: item._id,
        quantity: qty,
        condition: form.condition,
        date: form.date,
        from,
        to,
        docNumber: form.docNumber,
        project: form.project,
        purpose: form.purpose,
        remarks: form.remarks,
        returnable: type === 'ISSUE' ? form.returnable : false,
        expectedReturnDate: form.returnable ? form.expectedReturnDate : undefined,
      });

      toast.success(`${cfg.label} recorded`, `${data.transaction.txnNumber} · ${fmtNum(qty)} ${item.unit} of ${item.name}`);
      onSaved?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!item) return null;

  const party = partySide === 'to' ? to : from;
  const setParty = partySide === 'to' ? setTo : setFrom;

  return (
    <Modal
      open={open}
      width="wide"
      title={`Record an update — ${item.name}`}
      subtitle={`${item.itemCode} · ${fmtNum(available)} ${item.unit} in the store, ${fmtNum(item.issuedQuantity)} issued out`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="issue-form" className="btn btn-red" disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name={cfg.icon} size={15} />}
            {cfg.label}
          </button>
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}

      <form id="issue-form" onSubmit={submit}>
        <div className="field">
          <label>What is happening?</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(158px,1fr))', gap: 8 }}>
            {TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setType(t.value)}
                className="card"
                style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderColor: type === t.value ? 'var(--red-600)' : 'var(--border)',
                  background: type === t.value ? 'var(--red-50)' : '#fff',
                  borderWidth: type === t.value ? 1.5 : 1,
                  font: 'inherit',
                }}
              >
                <div className="flex" style={{ gap: 7, fontWeight: 700, fontSize: 13, color: type === t.value ? 'var(--red-700)' : 'var(--navy-800)' }}>
                  <Icon name={t.icon} size={14} />
                  {t.label}
                </div>
                <div className="cell-sub" style={{ marginTop: 2 }}>{t.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="form-grid">
          <div className="fieldset-title">Update</div>

          <div className="field">
            <label htmlFor="qty">
              Quantity<span className="req">*</span>
              {maxQty !== undefined ? <span className="muted" style={{ fontWeight: 400 }}> (max {fmtNum(maxQty)})</span> : null}
            </label>
            <input
              id="qty"
              className="input"
              type="number"
              step="any"
              min="0"
              max={maxQty}
              value={form.quantity}
              onChange={set('quantity')}
              required
              autoFocus
            />
            <div className="hint">Measured in {item.unit}.</div>
          </div>

          {partySide ? (
            <>
              <div className="field">
                <label htmlFor="pname">
                  {partySide === 'to' ? 'Issued to' : 'Received from'}
                  <span className="req">*</span>
                </label>
                <input
                  id="pname"
                  className="input"
                  value={party.name}
                  onChange={(e) => setParty((p) => ({ ...p, name: e.target.value }))}
                  placeholder={party.kind === 'Employee' ? 'e.g. Ravi Kumar' : 'e.g. AIC'}
                  required
                />
              </div>

              {party.kind === 'Employee' && people.length ? (
                <div className="field">
                  <label htmlFor="pick">Or pick from the team</label>
                  <select id="pick" className="select" value="" onChange={pickPerson}>
                    <option value="">— Choose a colleague —</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.employeeId ? ` (${p.employeeId})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="hint">Fills in their department and contact for you.</div>
                </div>
              ) : null}
            </>
          ) : null}

          {type === 'ISSUE' ? (
            <>
              <div className="field">
                <label className="checkbox" style={{ marginTop: 22 }}>
                  <input type="checkbox" checked={form.returnable} onChange={set('returnable')} />
                  <span>
                    This material is expected back
                    <div className="hint" style={{ marginTop: 2 }}>Tracked under Pending Returns until it comes back.</div>
                  </span>
                </label>
              </div>

              {form.returnable ? (
                <div className="field">
                  <label htmlFor="ret">
                    Expected return date<span className="req">*</span>
                  </label>
                  <input id="ret" className="input" type="date" value={form.expectedReturnDate} onChange={set('expectedReturnDate')} min={form.date} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMoreOpen((o) => !o)}
          style={{ marginBottom: moreOpen ? 14 : 4 }}
        >
          <Icon name={moreOpen ? 'chevron-down' : 'chevron-right'} size={13} />
          {moreOpen ? 'Hide more details' : 'More details (optional)'}
        </button>

        {moreOpen ? (
          <>
            <div className="form-grid">
              <div className="fieldset-title">Update</div>

              <div className="field">
                <label htmlFor="cond">Condition at the time</label>
                <select id="cond" className="select" value={form.condition} onChange={set('condition')}>
                  {masters.condition.map((c) => (
                    <option key={c._id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="date">Date</label>
                <input id="date" className="input" type="date" value={form.date} onChange={set('date')} />
              </div>
            </div>

            {partySide ? (
              <div className="form-grid">
                <div className="fieldset-title">
                  {partySide === 'to' ? 'Issued to' : 'Received from'} — more about them
                </div>

                <div className="field">
                  <label htmlFor="kind">Who / what kind</label>
                  <select
                    id="kind"
                    className="select"
                    value={party.kind}
                    onChange={(e) => setParty((p) => ({ ...p, kind: e.target.value }))}
                  >
                    {PARTY_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="pdept">Department</label>
                  <select
                    id="pdept"
                    className="select"
                    value={party.department}
                    onChange={(e) => setParty((p) => ({ ...p, department: e.target.value }))}
                  >
                    <option value="">— Select department —</option>
                    {masters.department.map((c) => (
                      <option key={c._id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {party.department && !masters.department.some((d) => d.name === party.department) ? (
                      <option value={party.department}>{party.department}</option>
                    ) : null}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="pemp">Employee ID</label>
                  <input id="pemp" className="input" value={party.employeeId} onChange={(e) => setParty((p) => ({ ...p, employeeId: e.target.value }))} />
                </div>

                <div className="field">
                  <label htmlFor="pcontact">Email or phone</label>
                  <input
                    id="pcontact"
                    className="input"
                    value={party.contact}
                    onChange={(e) => setParty((p) => ({ ...p, contact: e.target.value }))}
                    placeholder="name@company.com"
                  />
                  <div className="hint">If you enter an email, an issue confirmation is sent automatically.</div>
                </div>
              </div>
            ) : null}

            <div className="form-grid">
              <div className="fieldset-title">Reference</div>

              <div className="field">
                <label htmlFor="doc">Gate pass / challan no.</label>
                <input id="doc" className="input" value={form.docNumber} onChange={set('docNumber')} placeholder="e.g. GP-2024-118" />
              </div>

              <div className="field">
                <label htmlFor="proj">Project</label>
                <select id="proj" className="select" value={form.project} onChange={set('project')}>
                  <option value="">— Select project —</option>
                  {masters.project.map((c) => (
                    <option key={c._id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {form.project && !masters.project.some((p) => p.name === form.project) ? (
                    <option value={form.project}>{form.project}</option>
                  ) : null}
                </select>
              </div>

              <div className="field span-2">
                <label htmlFor="purpose">Purpose</label>
                <textarea id="purpose" className="textarea" rows={2} value={form.purpose} onChange={set('purpose')} placeholder="What is this material being used for?" />
              </div>

              <div className="field span-2">
                <label htmlFor="rem">Remarks</label>
                <textarea id="rem" className="textarea" rows={2} value={form.remarks} onChange={set('remarks')} />
              </div>
            </div>
          </>
        ) : null}
      </form>
    </Modal>
  );
}
