import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { downloadCSV } from '../api/client.js';
import Icon from '../components/Icon.jsx';
import IssueForm from '../components/IssueForm.jsx';
import {
  Badge,
  CONDITION_TONE,
  Confirm,
  Empty,
  Loading,
  Modal,
  Pagination,
  TYPE_TONE,
  availableOf,
  fmtDate,
  fmtDateTime,
  fmtNum,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

const TYPES = ['ISSUE', 'RECEIVE', 'RETURN', 'TRANSFER', 'SCRAP', 'ADJUST'];

/** Item picker used when starting an update from this page. */
function ItemPicker({ open, onClose, onPick }) {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get('/items', { params: { search, limit: 30 } })
        .then(({ data }) => setRows(data.items))
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, search]);

  return (
    <Modal open={open} title="Which material?" subtitle="Pick the item you want to issue, receive or return." onClose={onClose}>
      <div className="search mb" style={{ maxWidth: '100%' }}>
        <Icon name="search" size={16} />
        <input className="input" autoFocus placeholder="Search by name, code or serial number…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <Loading label="Searching…" />
      ) : rows.length === 0 ? (
        <Empty icon="box" title="No materials found" message="Try a different search term." />
      ) : (
        <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
          <table className="data">
            <tbody>
              {rows.map((i) => (
                <tr key={i._id} className="clickable" onClick={() => onPick(i)}>
                  <td style={{ width: 46 }}>
                    <div className="thumb">{i.image?.url ? <img src={i.image.url} alt="" /> : <Icon name="box" size={14} />}</div>
                  </td>
                  <td>
                    <div className="cell-main">{i.name}</div>
                    <div className="cell-sub">
                      {i.itemCode}
                      {i.location ? ` · ${i.location}` : ''}
                    </div>
                  </td>
                  <td className="num">
                    <b>{fmtNum(availableOf(i))}</b> <span className="cell-sub">{i.unit} in store</span>
                    {i.issuedQuantity ? <div className="cell-sub">{fmtNum(i.issuedQuantity)} out</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default function Transactions() {
  const { canWrite, isAdmin } = useAuth();
  const { masters } = useMeta();
  const toast = useToast();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ type: '', department: '', project: '', from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(params.get('new') === '1');
  const [movementFor, setMovementFor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(
    () => ({
      page: meta.page,
      limit: meta.limit,
      ...(search ? { search } : {}),
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [meta.page, meta.limit, search, filters]
  );

  const load = useCallback(async (opts) => {
    if (opts?.silent !== true) setLoading(true);
    try {
      const { data } = await api.get('/transactions', { params: query });
      setRows(data.transactions);
      setMeta((m) => ({ ...m, page: data.page, pages: data.pages, total: data.total }));
    } catch (err) {
      toast.error('Could not load updates', err.message);
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  useEffect(() => {
    const t = setTimeout(load, 260);
    return () => clearTimeout(t);
  }, [load]);

  useLiveUpdates(['transactions', 'items'], () => load({ silent: true }));

  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setMeta((m) => ({ ...m, page: 1 }));
  };

  async function remove(txn) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/transactions/${txn._id}`);
      toast.success('Update reversed', data.message);
      setConfirmDel(null);
      load();
    } catch (err) {
      toast.error('Could not reverse this update', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportCSV() {
    try {
      await downloadCSV('/transactions/export', query, `si-movements-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export ready', 'The CSV has been downloaded.');
    } catch (err) {
      toast.error('Export failed', err.message);
    }
  }

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Search by txn no., item, person, gate pass…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setMeta((m) => ({ ...m, page: 1 }));
            }}
          />
        </div>

        <button className={`btn ${showFilters ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowFilters((s) => !s)}>
          <Icon name="filter" size={15} /> Filters
        </button>

        <div style={{ flex: 1 }} />

        <button className="btn btn-ghost" onClick={exportCSV}>
          <Icon name="download" size={15} /> Export
        </button>
        {canWrite ? (
          <button
            className="btn btn-red"
            onClick={() => {
              setPickerOpen(true);
              setParams({});
            }}
          >
            <Icon name="plus" size={15} /> Record update
          </button>
        ) : null}
      </div>

      {showFilters ? (
        <div className="filter-bar">
          <div className="field">
            <label>Update type</label>
            <select className="select" value={filters.type} onChange={setFilter('type')}>
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Department</label>
            <select className="select" value={filters.department} onChange={setFilter('department')}>
              <option value="">All departments</option>
              {masters.department.map((d) => (
                <option key={d._id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Project</label>
            <select className="select" value={filters.project} onChange={setFilter('project')}>
              <option value="">All projects</option>
              {masters.project.map((p) => (
                <option key={p._id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>From date</label>
            <input className="input" type="date" value={filters.from} onChange={setFilter('from')} />
          </div>
          <div className="field">
            <label>To date</label>
            <input className="input" type="date" value={filters.to} onChange={setFilter('to')} />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                setFilters({ type: '', department: '', project: '', from: '', to: '' });
                setMeta((m) => ({ ...m, page: 1 }));
              }}
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        {loading ? (
          <Loading label="Loading movements…" />
        ) : rows.length === 0 ? (
          <Empty
            icon="exchange"
            title="No updates found"
            message="Nothing matches this search. Record an issue or receipt and it will appear here."
            action={
              canWrite ? (
                <button className="btn btn-red" onClick={() => setPickerOpen(true)}>
                  <Icon name="plus" size={15} /> Record update
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Type</th>
                    <th>Material</th>
                    <th className="num">Qty</th>
                    <th>From → To</th>
                    <th>Project / purpose</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th style={{ width: 76 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => {
                    const pending = t.returnable ? Math.max(0, t.quantity - t.returnedQuantity) : 0;
                    const overdue = pending > 0 && t.expectedReturnDate && new Date(t.expectedReturnDate) < new Date();
                    return (
                      <tr key={t._id} className="clickable" onClick={() => setDetail(t)}>
                        <td>
                          <div className="cell-main">{t.txnNumber}</div>
                          {t.docNumber ? <div className="cell-sub">{t.docNumber}</div> : null}
                        </td>
                        <td>
                          <Badge tone={TYPE_TONE[t.type]}>{t.type}</Badge>
                        </td>
                        <td>
                          <div className="cell-main">{t.itemNameSnapshot}</div>
                          <div className="cell-sub">{t.itemCodeSnapshot}</div>
                        </td>
                        <td className="num">
                          {fmtNum(t.quantity)} <span className="cell-sub">{t.unit}</span>
                        </td>
                        <td>
                          <div className="small">
                            {t.from?.name || '—'} <Icon name="arrow-right" size={11} style={{ verticalAlign: -1, color: 'var(--grey-400)' }} /> {t.to?.name || '—'}
                          </div>
                          <div className="cell-sub">{t.to?.department || t.from?.department || ''}</div>
                        </td>
                        <td>
                          <div className="small">{t.project || <span className="muted">—</span>}</div>
                          {t.purpose ? <div className="cell-sub">{t.purpose.slice(0, 42)}{t.purpose.length > 42 ? '…' : ''}</div> : null}
                        </td>
                        <td className="nowrap small">{fmtDate(t.date)}</td>
                        <td>
                          {pending > 0 ? (
                            <Badge tone={overdue ? 'red' : 'amber'} dot>
                              {fmtNum(pending)} due back
                            </Badge>
                          ) : (
                            <Badge tone={t.status === 'Returned' ? 'green' : 'grey'}>{t.status}</Badge>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="actions">
                            <button className="icon-btn" title="View" aria-label="View" onClick={() => setDetail(t)}>
                              <Icon name="eye" size={14} />
                            </button>
                            {isAdmin ? (
                              <button
                                className="icon-btn danger"
                                title="Reverse and delete"
                                aria-label="Reverse and delete"
                                onClick={() =>
                                  setConfirmDel({
                                    txn: t,
                                    title: `Reverse ${t.txnNumber}?`,
                                    message: `The quantity effect of this ${t.type.toLowerCase()} (${fmtNum(t.quantity)} ${t.unit} of ${t.itemNameSnapshot}) will be undone and the entry deleted.${
                                      t.type === 'ISSUE' && t.returnedQuantity > 0
                                        ? ` The ${fmtNum(t.returnedQuantity)} ${t.unit} already returned against it will be deleted too.`
                                        : t.type === 'RETURN'
                                          ? ' The quantity goes back to pending on the issue it was returned against.'
                                          : ''
                                    } This cannot be undone.`,
                                  })
                                }
                              >
                                <Icon name="trash" size={14} />
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

            <Pagination
              page={meta.page}
              pages={meta.pages}
              total={meta.total}
              limit={meta.limit}
              onPage={(p) => setMeta((m) => ({ ...m, page: p }))}
              onLimit={(l) => setMeta((m) => ({ ...m, limit: l, page: 1 }))}
            />
          </>
        )}
      </div>

      <ItemPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(i) => {
          setPickerOpen(false);
          setMovementFor(i);
        }}
      />

      <IssueForm
        open={Boolean(movementFor)}
        item={movementFor}
        onClose={() => setMovementFor(null)}
        onSaved={() => {
          setMovementFor(null);
          load();
        }}
      />

      <Modal
        open={Boolean(detail)}
        title={detail?.txnNumber}
        subtitle={detail ? `${detail.type} · ${fmtDateTime(detail.date)}` : ''}
        onClose={() => setDetail(null)}
        footer={
          <button className="btn btn-ghost" onClick={() => setDetail(null)}>
            Close
          </button>
        }
      >
        {detail ? (
          <dl className="kv">
            {[
              ['Material', `${detail.itemNameSnapshot} (${detail.itemCodeSnapshot})`],
              ['Quantity', `${fmtNum(detail.quantity)} ${detail.unit}`],
              ['Condition', detail.condition],
              ['From', detail.from?.name ? `${detail.from.name}${detail.from.department ? ` · ${detail.from.department}` : ''}` : '—'],
              ['To', detail.to?.name ? `${detail.to.name}${detail.to.department ? ` · ${detail.to.department}` : ''}` : '—'],
              ['Employee ID', detail.to?.employeeId || detail.from?.employeeId],
              ['Mobile', detail.to?.phone || detail.from?.phone],
              ['Email', detail.to?.contact || detail.from?.contact],
              ['Gate pass / challan', detail.docNumber],
              ['Project', detail.project],
              ['Purpose', detail.purpose],
              ['Location', detail.location],
              ['Returnable', detail.returnable ? 'Yes' : 'No'],
              ['Expected return', detail.expectedReturnDate ? fmtDateTime(detail.expectedReturnDate) : ''],
              ['Returned so far', detail.returnable ? `${fmtNum(detail.returnedQuantity)} ${detail.unit}` : ''],
              ['Status', detail.status],
              ['Recorded by', detail.handledBy?.name],
              ['Recorded on', fmtDateTime(detail.createdAt)],
              ['Remarks', detail.remarks],
            ]
              .filter(([, v]) => v !== undefined && v !== null && v !== '')
              .map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>
                    {k === 'Condition' ? <Badge tone={CONDITION_TONE[v] || 'grey'}>{v}</Badge> : v}
                  </dd>
                </div>
              ))}
          </dl>
        ) : null}
      </Modal>

      <Confirm
        open={Boolean(confirmDel)}
        title={confirmDel?.title}
        message={confirmDel?.message}
        confirmLabel="Reverse & delete"
        busy={busy}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => remove(confirmDel.txn)}
      />
    </>
  );
}
