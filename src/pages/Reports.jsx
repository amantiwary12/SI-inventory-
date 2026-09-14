import { useCallback, useEffect, useState } from 'react';
import api, { downloadCSV } from '../api/client.js';
import Icon from '../components/Icon.jsx';
import { Badge, Empty, Loading, TYPE_TONE, fmtDate, fmtNum } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

const TABS = [
  { key: 'log', label: 'Movement log', hint: 'Every update, oldest first, with a running count.' },
  { key: 'usage', label: 'Department usage', hint: 'Which department has taken the most.' },
  { key: 'holders', label: 'Who has what', hint: 'Material currently outside the store.' },
];

export default function Reports() {
  const toast = useToast();
  const [tab, setTab] = useState('log');
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState([]);
  const [log, setLog] = useState([]);
  const [usage, setUsage] = useState([]);
  const [holders, setHolders] = useState([]);

  const [filters, setFilters] = useState({ item: '', from: '', to: '', days: 90 });

  useEffect(() => {
    api
      .get('/items', { params: { limit: 500, sortBy: 'name', sortDir: 'asc' } })
      .then(({ data }) => setItems(data.items))
      .catch(() => {});
  }, []);

  const load = useCallback(async (opts) => {
    if (opts?.silent !== true) setLoading(true);
    try {
      if (tab === 'log') {
        const { data } = await api.get('/dashboard/reports/movement-log', {
          params: {
            ...(filters.item ? { item: filters.item } : {}),
            ...(filters.from ? { from: filters.from } : {}),
            ...(filters.to ? { to: filters.to } : {}),
          },
        });
        setLog(data.log);
      } else if (tab === 'usage') {
        const { data } = await api.get('/dashboard/reports/department-usage', { params: { days: filters.days } });
        setUsage(data.usage);
      } else {
        const { data } = await api.get('/dashboard/reports/who-has-what');
        setHolders(data.holders);
      }
    } catch (err) {
      toast.error('Could not load the report', err.message);
    } finally {
      setLoading(false);
    }
  }, [tab, filters, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveUpdates(['transactions', 'items'], () => load({ silent: true }));

  async function exportCurrent() {
    try {
      const params =
        tab === 'log'
          ? {
              ...(filters.item ? { item: filters.item } : {}),
              ...(filters.from ? { from: filters.from } : {}),
              ...(filters.to ? { to: filters.to } : {}),
            }
          : { type: 'ISSUE' };

      await downloadCSV('/transactions/export', params, `si-${tab}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export ready', 'The CSV has been downloaded.');
    } catch (err) {
      toast.error('Export failed', err.message);
    }
  }

  const maxUsage = Math.max(...usage.map((u) => u.quantity), 1);

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        {tab === 'log' ? (
          <>
            <select className="select" style={{ width: 260 }} value={filters.item} onChange={(e) => setFilters((f) => ({ ...f, item: e.target.value }))}>
              <option value="">All materials</option>
              {items.map((i) => (
                <option key={i._id} value={i._id}>
                  {i.itemCode} — {i.name}
                </option>
              ))}
            </select>
            <input className="input" style={{ width: 150 }} type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} title="From date" />
            <input className="input" style={{ width: 150 }} type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} title="To date" />
          </>
        ) : tab === 'usage' ? (
          <select className="select" style={{ width: 170 }} value={filters.days} onChange={(e) => setFilters((f) => ({ ...f, days: Number(e.target.value) }))}>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 6 months</option>
            <option value={365}>Last 12 months</option>
            <option value={730}>Last 2 years</option>
          </select>
        ) : null}

        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost" onClick={() => window.print()}>
          <Icon name="printer" size={15} /> Print
        </button>
        <button className="btn btn-ghost" onClick={exportCurrent}>
          <Icon name="download" size={15} /> Export CSV
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <div style={{ flex: 1 }}>
            <h3>{TABS.find((t) => t.key === tab).label}</h3>
            <p>{TABS.find((t) => t.key === tab).hint}</p>
          </div>
        </div>

        {loading ? (
          <Loading label="Building the report…" />
        ) : tab === 'log' ? (
          log.length === 0 ? (
            <Empty icon="list" title="No updates in this range" message="Widen the date range or pick a different material." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Txn</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Material</th>
                    <th>Party</th>
                    <th className="num">In</th>
                    <th className="num">Out</th>
                    <th className="num">Issued</th>
                    <th className="num">Returned</th>
                    {filters.item ? <th className="num">Running count</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {log.map((r) => (
                    <tr key={r.txnNumber}>
                      <td className="cell-sub">{r.txnNumber}</td>
                      <td className="nowrap small">{fmtDate(r.date)}</td>
                      <td>
                        <Badge tone={TYPE_TONE[r.type]}>{r.type}</Badge>
                      </td>
                      <td>
                        <div className="cell-main">{r.item}</div>
                        <div className="cell-sub">{r.itemCode}</div>
                      </td>
                      <td className="small">{r.party || '—'}</td>
                      <td className="num" style={{ color: r.in ? 'var(--green-600)' : 'var(--grey-300)' }}>
                        {r.in ? `+${fmtNum(r.in)}` : '—'}
                      </td>
                      <td className="num" style={{ color: r.out ? 'var(--red-600)' : 'var(--grey-300)' }}>
                        {r.out ? `-${fmtNum(r.out)}` : '—'}
                      </td>
                      <td className="num">{r.issued ? fmtNum(r.issued) : '—'}</td>
                      <td className="num">{r.returned ? fmtNum(r.returned) : '—'}</td>
                      {filters.item ? (
                        <td className="num">
                          <b>{fmtNum(r.balance)}</b>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filters.item ? (
                <p className="hint" style={{ padding: '10px 16px' }}>
                  Pick a single material above to see a running count column.
                </p>
              ) : null}
            </div>
          )
        ) : tab === 'usage' ? (
          usage.length === 0 ? (
            <Empty icon="building" title="Nothing was issued in this period" message="Try a longer date range." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Department / recipient</th>
                    <th className="num">Times issued</th>
                    <th className="num">Quantity</th>
                    <th className="num">Distinct items</th>
                    <th style={{ width: 160 }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => (
                    <tr key={u._id}>
                      <td className="cell-main">{u._id}</td>
                      <td className="num">{fmtNum(u.issues)}</td>
                      <td className="num">
                        <b>{fmtNum(u.quantity)}</b>
                      </td>
                      <td className="num">{fmtNum(u.distinctItems)}</td>
                      <td>
                        <div className="progress">
                          <span style={{ width: `${Math.max(4, (u.quantity / maxUsage) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : holders.length === 0 ? (
          <Empty icon="users" title="Nothing is out with anyone" message="All returnable material has been returned." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Holder</th>
                  <th>Department</th>
                  <th>Employee ID</th>
                  <th className="num">Items</th>
                  <th className="num">Units pending</th>
                  <th>Oldest issue</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((h) => {
                  const oldest = h.holdings.reduce((a, b) => (new Date(a.date) < new Date(b.date) ? a : b));
                  return (
                    <tr key={`${h._id.name}-${h._id.employeeId}`}>
                      <td className="cell-main">{h._id.name || '—'}</td>
                      <td>{h._id.department || <span className="muted">—</span>}</td>
                      <td>{h._id.employeeId || <span className="muted">—</span>}</td>
                      <td className="num">{h.holdings.length}</td>
                      <td className="num">
                        <b>{fmtNum(h.totalPending)}</b>
                      </td>
                      <td className="nowrap small">{fmtDate(oldest.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
