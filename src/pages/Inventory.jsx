import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { downloadCSV } from '../api/client.js';
import Icon from '../components/Icon.jsx';
import ItemForm from '../components/ItemForm.jsx';
import IssueForm from '../components/IssueForm.jsx';
import {
  Badge,
  CONDITION_TONE,
  Confirm,
  Empty,
  Loading,
  Modal,
  Pagination,
  STATUSES,
  STATUS_TONE,
  availableOf,
  fmtNum,
  isLow,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

const SORTS = [
  { value: 'createdAt', label: 'Recently added' },
  { value: 'name', label: 'Name' },
  { value: 'itemCode', label: 'Item code' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'category', label: 'Category' },
  { value: 'updatedAt', label: 'Recently updated' },
];

export default function Inventory() {
  const navigate = useNavigate();
  const { canWrite, canManageInventory, isAdmin } = useAuth();
  const { masters, customItemFields, labelFor } = useMeta();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const importRef = useRef(null);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    category: '', location: '', condition: '', status: '', ownerDepartment: '', project: '',
    lowQuantity: params.get('lowQuantity') === 'true' ? 'true' : '', includeInactive: '',
  });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [showFilters, setShowFilters] = useState(params.get('lowQuantity') === 'true');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [issueFor, setIssueFor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [importReport, setImportReport] = useState(null);
  const [busy, setBusy] = useState(false);

  const query = useMemo(
    () => ({
      page: meta.page,
      limit: meta.limit,
      sortBy,
      sortDir,
      ...(search ? { search } : {}),
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }),
    [meta.page, meta.limit, sortBy, sortDir, search, filters]
  );

  const load = useCallback(async (opts) => {
    if (opts?.silent !== true) setLoading(true);
    try {
      const { data } = await api.get('/items', { params: query });
      setRows(data.items);
      setMeta((m) => ({ ...m, page: data.page, pages: data.pages, total: data.total }));
    } catch (err) {
      toast.error('Could not load inventory', err.message);
    } finally {
      setLoading(false);
    }
  }, [query, toast]);

  // Debounce so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 260);
    return () => clearTimeout(t);
  }, [load]);

  // Someone else added, edited, issued or received material — refresh in place.
  useLiveUpdates(['items', 'transactions', 'fields'], () => load({ silent: true }));

  const setFilter = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setMeta((m) => ({ ...m, page: 1 }));
  };

  const activeFilters = Object.entries(filters).filter(([, v]) => v);

  function clearFilters() {
    setFilters({ category: '', location: '', condition: '', status: '', ownerDepartment: '', project: '', lowQuantity: '', includeInactive: '' });
    setParams({});
    setMeta((m) => ({ ...m, page: 1 }));
  }

  async function archive(item, hard = false) {
    setBusy(true);
    try {
      const { data } = await api.delete(`/items/${item._id}`, { params: hard ? { hard: true } : {} });
      toast.success(hard ? 'Item deleted' : 'Item archived', data.message);
      setConfirm(null);
      load();
    } catch (err) {
      toast.error('Could not remove the item', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(item) {
    try {
      await api.post(`/items/${item._id}/restore`);
      toast.success('Item restored', `${item.itemCode} is active again.`);
      load();
    } catch (err) {
      toast.error('Restore failed', err.message);
    }
  }

  async function exportCSV() {
    try {
      await downloadCSV('/items/export', query, `rd-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export ready', 'The CSV has been downloaded.');
    } catch (err) {
      toast.error('Export failed', err.message);
    }
  }

  /** Parse a pasted/uploaded CSV into row objects keyed by our field names. */
  async function importCSV(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const text = await file.text();
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return toast.error('Nothing to import', 'The file has no data rows.');

    const splitLine = (line) => {
      const out = [];
      let cur = '';
      let quoted = false;
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (quoted) {
          if (c === '"' && line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else if (c === '"') quoted = false;
          else cur += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') {
          out.push(cur);
          cur = '';
        } else cur += c;
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };

    const HEADER_MAP = {
      'item code': 'itemCode', itemcode: 'itemCode', name: 'name', 'item name': 'name',
      category: 'category', 'sub category': 'subCategory', make: 'make', model: 'model',
      'serial no': 'serialNumber', 'serial number': 'serialNumber', 'part no': 'partNumber',
      condition: 'condition', quantity: 'quantity', qty: 'quantity', unit: 'unit',
      'reorder level': 'reorderLevel',
      vendor: 'vendor', 'po no': 'poNumber', 'invoice no': 'invoiceNumber',
      'received date': 'purchaseDate', 'purchase date': 'purchaseDate', 'warranty expiry': 'warrantyExpiry',
      location: 'location', rack: 'rack', 'owner department': 'ownerDepartment',
      project: 'project', source: 'source', remarks: 'remarks', description: 'description',
    };

    const headers = splitLine(lines[0]);
    const customLabels = new Map(customItemFields.map((f) => [f.label.toLowerCase(), f.key]));

    const rowsToSend = lines.slice(1).map((line) => {
      const cells = splitLine(line);
      const row = { custom: {} };
      headers.forEach((h, i) => {
        const key = HEADER_MAP[h.toLowerCase()];
        const customKey = customLabels.get(h.toLowerCase());
        const value = cells[i] ?? '';
        if (key) row[key] = value;
        else if (customKey) row.custom[customKey] = value;
      });
      return row;
    });

    setBusy(true);
    try {
      const { data } = await api.post('/items/import', { rows: rowsToSend });
      setImportReport(data);
      load();
    } catch (err) {
      toast.error('Import failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  const extraCols = customItemFields.filter((f) => f.showInTable).slice(0, 3);

  return (
    <>
      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input
            className="input"
            placeholder="Search by name, code, serial, make, project…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setMeta((m) => ({ ...m, page: 1 }));
            }}
          />
        </div>

        <button className={`btn ${showFilters || activeFilters.length ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setShowFilters((s) => !s)}>
          <Icon name="filter" size={15} /> Filters
          {activeFilters.length ? ` (${activeFilters.length})` : ''}
        </button>

        <select className="select" style={{ width: 168 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort: {s.label}
            </option>
          ))}
        </select>
        <button
          className="icon-btn"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          aria-label={sortDir === 'asc' ? 'Sort ascending' : 'Sort descending'}
        >
          <Icon name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={15} />
        </button>

        <div style={{ flex: 1 }} />

        <button className="btn btn-ghost" onClick={exportCSV}>
          <Icon name="download" size={15} /> Export
        </button>
        {canManageInventory ? (
          <>
            <button className="btn btn-ghost" onClick={() => importRef.current?.click()} disabled={busy}>
              <Icon name="upload" size={15} /> Import
            </button>
            <input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={importCSV} />
            <button
              className="btn btn-red"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Icon name="plus" size={15} /> Add material
            </button>
          </>
        ) : null}
      </div>

      {showFilters ? (
        <div className="filter-bar">
          <div className="field">
            <label>Category</label>
            <select className="select" value={filters.category} onChange={setFilter('category')}>
              <option value="">All categories</option>
              {masters.category.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Location</label>
            <select className="select" value={filters.location} onChange={setFilter('location')}>
              <option value="">All locations</option>
              {masters.location.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Condition</label>
            <select className="select" value={filters.condition} onChange={setFilter('condition')}>
              <option value="">Any condition</option>
              {masters.condition.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select className="select" value={filters.status} onChange={setFilter('status')}>
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Owner department</label>
            <select className="select" value={filters.ownerDepartment} onChange={setFilter('ownerDepartment')}>
              <option value="">All departments</option>
              {masters.department.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Show</label>
            <select
              className="select"
              value={filters.lowQuantity ? 'low' : filters.includeInactive ? 'archived' : ''}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((f) => ({ ...f, lowQuantity: v === 'low' ? 'true' : '', includeInactive: v === 'archived' ? 'true' : '' }));
                setMeta((m) => ({ ...m, page: 1 }));
              }}
            >
              <option value="">Active items</option>
              <option value="low">Running low only</option>
              <option value="archived">Include archived</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }} className="chip-row">
            {activeFilters.map(([k, v]) => (
              <span key={k} className="chip">
                {k === 'lowQuantity' ? 'Running low only' : k === 'includeInactive' ? 'Including archived' : `${k}: ${v}`}
                <button onClick={() => setFilters((f) => ({ ...f, [k]: '' }))} aria-label="Remove filter">
                  <Icon name="x" size={12} />
                </button>
              </span>
            ))}
            {activeFilters.length ? (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                Clear all
              </button>
            ) : (
              <span className="muted small">No filters applied.</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="card">
        {loading ? (
          <Loading label="Loading materials…" />
        ) : rows.length === 0 ? (
          <Empty
            icon="box"
            title={search || activeFilters.length ? 'No materials match this search' : 'No materials recorded yet'}
            message={
              search || activeFilters.length
                ? 'Try a different search term or clear the filters.'
                : 'Add your first material to start tracking what R&D holds.'
            }
            action={
              search || activeFilters.length ? (
                <button className="btn btn-ghost" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : canManageInventory ? (
                <button
                  className="btn btn-red"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Icon name="plus" size={15} /> Add material
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
                    <th style={{ width: 48 }} />
                    <th>{labelFor('name', 'Item')}</th>
                    <th>{labelFor('category', 'Category')}</th>
                    <th className="num">Total qty</th>
                    <th className="num">In store</th>
                    <th>{labelFor('condition', 'Condition')}</th>
                    <th>Status</th>
                    <th>{labelFor('location', 'Location')}</th>
                    {extraCols.map((f) => (
                      <th key={f.key}>{f.label}</th>
                    ))}
                    <th style={{ width: 110 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => {
                    const avail = availableOf(i);
                    const low = isLow(i);
                    return (
                      <tr key={i._id} className="clickable" onClick={() => navigate(`/inventory/${i._id}`)}>
                        <td>
                          <div className="thumb">
                            {i.image?.url ? <img src={i.image.url} alt="" /> : <Icon name="box" size={15} strokeWidth={1.6} />}
                          </div>
                        </td>
                        <td>
                          <div className="cell-main">
                            {i.name}
                            {!i.active ? (
                              <span style={{ marginLeft: 7 }}>
                                <Badge tone="grey">Archived</Badge>
                              </span>
                            ) : null}
                          </div>
                          <div className="cell-sub">
                            {i.itemCode}
                            {i.make ? ` · ${i.make}` : ''}
                            {i.model ? ` ${i.model}` : ''}
                          </div>
                        </td>
                        <td>
                          <div>{i.category || <span className="muted">—</span>}</div>
                          {i.subCategory ? <div className="cell-sub">{i.subCategory}</div> : null}
                        </td>
                        <td className="num">
                          {fmtNum(i.quantity)} <span className="cell-sub">{i.unit}</span>
                        </td>
                        <td className="num">
                          <b style={{ color: low ? 'var(--red-600)' : 'inherit' }}>{fmtNum(avail)}</b>
                          {low ? (
                            <div className="cell-sub" style={{ color: 'var(--red-600)' }}>
                              at / below {fmtNum(i.reorderLevel)}
                            </div>
                          ) : i.issuedQuantity ? (
                            <div className="cell-sub">{fmtNum(i.issuedQuantity)} out</div>
                          ) : null}
                        </td>
                        <td>
                          <Badge tone={CONDITION_TONE[i.condition] || 'grey'}>{i.condition}</Badge>
                        </td>
                        <td>
                          <Badge tone={STATUS_TONE[i.status] || 'grey'} dot>
                            {i.status}
                          </Badge>
                        </td>
                        <td>
                          <div>{i.location || <span className="muted">—</span>}</div>
                          {i.rack ? <div className="cell-sub">Rack {i.rack}</div> : null}
                        </td>
                        {extraCols.map((f) => (
                          <td key={f.key}>
                            {Array.isArray(i.custom?.[f.key]) ? i.custom[f.key].join(', ') : i.custom?.[f.key] || <span className="muted">—</span>}
                          </td>
                        ))}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="actions">
                            {canWrite && i.active ? (
                              <button className="icon-btn" title="Issue / receive" aria-label="Issue / receive" onClick={() => setIssueFor(i)}>
                                <Icon name="exchange" size={14} />
                              </button>
                            ) : null}
                            {canManageInventory && i.active ? (
                              <>
                                <button
                                  className="icon-btn"
                                  title="Edit"
                                  aria-label="Edit"
                                  onClick={() => {
                                    setEditing(i);
                                    setFormOpen(true);
                                  }}
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  className="icon-btn danger"
                                  title="Archive"
                                  aria-label="Archive"
                                  onClick={() =>
                                    setConfirm({
                                      item: i,
                                      hard: false,
                                      title: `Archive ${i.itemCode}?`,
                                      message: `"${i.name}" will be hidden from the active list but its history is kept. You can restore it at any time.`,
                                      label: 'Archive item',
                                    })
                                  }
                                >
                                  <Icon name="archive" size={14} />
                                </button>
                              </>
                            ) : null}
                            {canManageInventory && !i.active ? (
                              <button className="btn btn-ghost btn-sm" onClick={() => restore(i)}>
                                Restore
                              </button>
                            ) : null}
                            {isAdmin && !i.active ? (
                              <button
                                className="icon-btn danger"
                                title="Delete permanently"
                                aria-label="Delete permanently"
                                onClick={() =>
                                  setConfirm({
                                    item: i,
                                    hard: true,
                                    title: `Permanently delete ${i.itemCode}?`,
                                    message: `This erases "${i.name}" and every movement recorded against it. This cannot be undone.`,
                                    label: 'Delete forever',
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

      <ItemForm open={formOpen} item={editing} onClose={() => setFormOpen(false)} onSaved={load} />

      <IssueForm open={Boolean(issueFor)} item={issueFor} onClose={() => setIssueFor(null)} onSaved={load} />

      <Confirm
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.label}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => archive(confirm.item, confirm.hard)}
      />

      <Modal
        open={Boolean(importReport)}
        title="Import finished"
        onClose={() => setImportReport(null)}
        footer={
          <button className="btn btn-primary" onClick={() => setImportReport(null)}>
            Done
          </button>
        }
      >
        <div className={`alert ${importReport?.failed ? 'info' : 'success'}`}>
          <b>{importReport?.imported}</b> material(s) imported
          {importReport?.failed ? (
            <>
              , <b>{importReport.failed}</b> row(s) skipped.
            </>
          ) : (
            ' successfully.'
          )}
        </div>
        {importReport?.errors?.length ? (
          <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {importReport.errors.map((e) => (
                  <tr key={`${e.row}-${e.name}`}>
                    <td>{e.row}</td>
                    <td>{e.name}</td>
                    <td className="small" style={{ color: 'var(--red-600)' }}>
                      {e.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="hint mt">
          Tip: export the current list first — that CSV has exactly the column headers the importer expects.
        </p>
      </Modal>
    </>
  );
}
