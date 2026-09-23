import { useCallback, useEffect, useState } from 'react';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import { Badge, Empty, Loading, Modal, StatCard, fmtDate, fmtNum } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

export default function Returns() {
  const { canWrite } = useAuth();
  const { masters } = useMeta();
  const toast = useToast();

  const [rows, setRows] = useState([]);
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [view, setView] = useState('list'); // list | people

  const [returning, setReturning] = useState(null);
  const [returnForm, setReturnForm] = useState({ quantity: '', condition: 'Good', docNumber: '', remarks: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (opts) => {
    if (opts?.silent !== true) setLoading(true);
    try {
      const [txns, who] = await Promise.all([
        api.get('/transactions', { params: { pendingReturn: 'true', ...(onlyOverdue ? { overdue: 'true' } : {}), limit: 200 } }),
        api.get('/dashboard/reports/who-has-what'),
      ]);
      setRows(txns.data.transactions);
      setHolders(who.data.holders);
    } catch (err) {
      toast.error('Could not load pending returns', err.message);
    } finally {
      setLoading(false);
    }
  }, [onlyOverdue, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveUpdates(['transactions'], () => load({ silent: true }));

  function openReturn(txn) {
    const pending = Math.max(0, txn.quantity - txn.returnedQuantity);
    setReturnForm({ quantity: pending, condition: txn.condition || 'Good', docNumber: '', remarks: '' });
    setError('');
    setReturning(txn);
  }

  async function submitReturn(e) {
    e.preventDefault();
    setError('');

    const pending = Math.max(0, returning.quantity - returning.returnedQuantity);
    const qty = Number(returnForm.quantity);
    if (!qty || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (qty > pending) return setError(`Only ${fmtNum(pending)} ${returning.unit} are pending on this issue.`);

    setBusy(true);
    try {
      await api.post(`/transactions/${returning._id}/return`, {
        quantity: qty,
        condition: returnForm.condition,
        docNumber: returnForm.docNumber,
        remarks: returnForm.remarks,
      });
      toast.success('Return recorded', `${fmtNum(qty)} ${returning.unit} of ${returning.itemNameSnapshot} is back in the store.`);
      setReturning(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remind(txn) {
    try {
      const { data } = await api.post(`/transactions/${txn._id}/remind`);
      toast.success('Reminder sent', data.message);
    } catch (err) {
      toast.error('Could not send the reminder', err.message);
    }
  }

  const overdueCount = rows.filter((t) => t.expectedReturnDate && new Date(t.expectedReturnDate) < new Date()).length;
  const totalPending = rows.reduce((sum, t) => sum + Math.max(0, t.quantity - t.returnedQuantity), 0);

  return (
    <>
      <div className="grid stats mb">
        <StatCard label="Open issues" value={fmtNum(rows.length)} sub="Returnable issues not yet closed" icon="undo" />
        <StatCard label="Units out" value={fmtNum(totalPending)} sub="Across all pending issues" tone="blue" icon="box" />
        <StatCard label="Overdue" value={fmtNum(overdueCount)} sub={overdueCount ? 'Past the expected return date' : 'Nothing is late'} tone={overdueCount ? 'red' : 'green'} icon="clock" />
        <StatCard label="People holding material" value={fmtNum(holders.length)} sub="Employees, departments or companies" icon="users" />
      </div>

      <div className="tabs">
        <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
          Pending issues
        </button>
        <button className={view === 'people' ? 'active' : ''} onClick={() => setView('people')}>
          Grouped by holder
        </button>
      </div>

      <div className="toolbar">
        <label className="checkbox">
          <input type="checkbox" checked={onlyOverdue} onChange={(e) => setOnlyOverdue(e.target.checked)} />
          <span>Show overdue only</span>
        </label>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={load}>
          <Icon name="refresh" size={15} /> Refresh
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loading label="Loading pending returns…" />
        ) : view === 'list' ? (
          rows.length === 0 ? (
            <Empty
              icon="check-circle"
              title={onlyOverdue ? 'Nothing is overdue' : 'Nothing is out on loan'}
              message={
                onlyOverdue
                  ? 'Every returnable issue is still within its due date.'
                  : 'All returnable material has come back to the store.'
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Held by</th>
                    <th>Material</th>
                    <th className="num">Issued</th>
                    <th className="num">Returned</th>
                    <th className="num">Pending</th>
                    <th>Issued on</th>
                    <th>Due</th>
                    <th style={{ width: 150 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const pending = Math.max(0, t.quantity - t.returnedQuantity);
                    const overdue = t.expectedReturnDate && new Date(t.expectedReturnDate) < new Date();
                    const daysLate = overdue ? Math.floor((Date.now() - new Date(t.expectedReturnDate)) / 86400000) : 0;
                    return (
                      <tr key={t._id}>
                        <td>
                          <div className="cell-main">{t.to?.name || '—'}</div>
                          <div className="cell-sub">
                            {[t.to?.department, t.to?.employeeId].filter(Boolean).join(' · ')}
                          </div>
                        </td>
                        <td>
                          <div className="cell-main">{t.itemNameSnapshot}</div>
                          <div className="cell-sub">
                            {t.txnNumber}
                            {t.docNumber ? ` · ${t.docNumber}` : ''}
                          </div>
                        </td>
                        <td className="num">
                          {fmtNum(t.quantity)} <span className="cell-sub">{t.unit}</span>
                        </td>
                        <td className="num">{fmtNum(t.returnedQuantity)}</td>
                        <td className="num">
                          <b style={{ color: overdue ? 'var(--red-600)' : 'inherit' }}>{fmtNum(pending)}</b>
                        </td>
                        <td className="nowrap small">{fmtDate(t.date)}</td>
                        <td className="nowrap">
                          {t.expectedReturnDate ? (
                            <Badge tone={overdue ? 'red' : 'grey'} dot={overdue}>
                              {overdue ? `${daysLate}d late` : fmtDate(t.expectedReturnDate)}
                            </Badge>
                          ) : (
                            <span className="muted small">Not set</span>
                          )}
                        </td>
                        <td>
                          <div className="actions">
                            {overdue && canWrite ? (
                              <button className="icon-btn" title="Email a reminder" aria-label="Email a reminder" onClick={() => remind(t)}>
                                <Icon name="mail" size={14} />
                              </button>
                            ) : null}
                            {canWrite ? (
                              <button className="btn btn-ghost btn-sm" onClick={() => openReturn(t)}>
                                <Icon name="undo" size={13} /> Receive back
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : holders.length === 0 ? (
          <Empty icon="users" title="Nobody is holding material" message="Everything issued out has been returned." />
        ) : (
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            {holders.map((h) => (
              <div key={`${h._id.name}-${h._id.employeeId}`} className="card">
                <div className="card-head">
                  <span className="avatar">{(h._id.name || '?').slice(0, 2).toUpperCase()}</span>
                  <div style={{ flex: 1 }}>
                    <h3>{h._id.name || 'Unnamed'}</h3>
                    <p>{[h._id.department, h._id.employeeId].filter(Boolean).join(' · ') || 'No department recorded'}</p>
                  </div>
                  <Badge tone="amber">{fmtNum(h.totalPending)} units pending</Badge>
                </div>
                <div className="card-body flush">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th className="num">Pending</th>
                        <th>Issued on</th>
                        <th>Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.holdings.map((x) => {
                        const overdue = x.expectedReturnDate && new Date(x.expectedReturnDate) < new Date();
                        return (
                          <tr key={x.txnNumber}>
                            <td>
                              <div className="cell-main">{x.item}</div>
                              <div className="cell-sub">
                                {x.itemCode} · {x.txnNumber}
                              </div>
                            </td>
                            <td className="num">
                              {fmtNum(x.pending)} <span className="cell-sub">{x.unit}</span>
                            </td>
                            <td className="nowrap small">{fmtDate(x.date)}</td>
                            <td className="nowrap">
                              {x.expectedReturnDate ? (
                                <Badge tone={overdue ? 'red' : 'grey'} dot={overdue}>
                                  {fmtDate(x.expectedReturnDate)}
                                </Badge>
                              ) : (
                                <span className="muted small">Not set</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(returning)}
        title="Receive material back"
        subtitle={returning ? `${returning.itemNameSnapshot} from ${returning.to?.name || 'unknown'} · ${returning.txnNumber}` : ''}
        onClose={() => setReturning(null)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setReturning(null)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="return-form" className="btn btn-red" disabled={busy}>
              {busy ? <span className="spinner" /> : <Icon name="undo" size={15} />} Record return
            </button>
          </>
        }
      >
        {error ? <div className="alert error">{error}</div> : null}

        {returning ? (
          <form id="return-form" onSubmit={submitReturn}>
            <div className="alert info">
              {fmtNum(Math.max(0, returning.quantity - returning.returnedQuantity))} {returning.unit} of{' '}
              <b>{returning.itemNameSnapshot}</b> are still pending on this issue.
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="rq">
                  Quantity coming back<span className="req">*</span>
                </label>
                <input
                  id="rq"
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  max={Math.max(0, returning.quantity - returning.returnedQuantity)}
                  value={returnForm.quantity}
                  onChange={(e) => setReturnForm((f) => ({ ...f, quantity: e.target.value }))}
                  required
                  autoFocus
                />
              </div>

              <div className="field">
                <label htmlFor="rc">Condition it came back in</label>
                <select id="rc" className="select" value={returnForm.condition} onChange={(e) => setReturnForm((f) => ({ ...f, condition: e.target.value }))}>
                  {masters.condition.map((c) => (
                    <option key={c._id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="hint">If this differs from the recorded condition, the item is updated to match.</div>
              </div>

              <div className="field">
                <label htmlFor="rd">Gate pass / challan no.</label>
                <input id="rd" className="input" value={returnForm.docNumber} onChange={(e) => setReturnForm((f) => ({ ...f, docNumber: e.target.value }))} />
              </div>

              <div className="field span-2">
                <label htmlFor="rr">Remarks</label>
                <textarea id="rr" className="textarea" rows={2} value={returnForm.remarks} onChange={(e) => setReturnForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Any damage, missing accessories, or notes." />
              </div>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
