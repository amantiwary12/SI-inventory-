import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import {
  Badge,
  CONDITION_TONE,
  Empty,
  Loading,
  StatCard,
  TYPE_TONE,
  fmtAgo,
  fmtDate,
  fmtNum,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

/** A plain count-per-row list with a proportional bar — no chart library. */
function Breakdown({ rows, total, toneFor }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div key={r._id || 'none'} className="breakdown-row">
          <span className="name">{r._id || 'Not set'}</span>
          <span className="count">
            {fmtNum(r.count)} item{r.count === 1 ? '' : 's'}
            {total ? ` · ${Math.round((r.count / total) * 100)}%` : ''}
          </span>
          <span className="bar">
            <span style={{ width: `${(r.count / max) * 100}%`, background: toneFor?.(r._id) }} />
          </span>
        </div>
      ))}
    </div>
  );
}

const CONDITION_BAR = {
  New: 'var(--green-600)',
  Good: 'var(--green-600)',
  Used: 'var(--navy-500)',
  'Needs Repair': 'var(--amber-600)',
  'Under Repair': 'var(--amber-600)',
  Damaged: 'var(--red-600)',
  Scrap: 'var(--grey-400)',
};

export default function Dashboard() {
  const { user, canWrite, isAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/dashboard/summary');
      setData(res.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useLiveUpdates(['items', 'transactions', 'masters', 'users'], () => load());

  async function removeActivity(id) {
    try {
      await api.delete(`/users/activity/${id}`);
      setData((d) => ({ ...d, activity: d.activity.filter((a) => a._id !== id) }));
    } catch (err) {
      toast.error('Could not delete this entry', err.message);
    }
  }

  if (error) {
    return (
      <div className="card">
        <Empty
          icon="alert"
          title="Could not load the overview"
          message={error}
          action={
            <button className="btn btn-primary" onClick={load}>
              <Icon name="refresh" size={15} /> Try again
            </button>
          }
        />
      </div>
    );
  }

  if (!data) return <Loading label="Loading your inventory…" />;

  const { totals, byCategory, byCondition, byLocation, lowQuantity, recentTransactions, pendingReturns, activity } = data;
  const hour = new Date().getHours();

  return (
    <>
      <div className="flex-between mb">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}
          </h2>
          <p className="muted small">Here is what the R&amp;D store is holding right now.</p>
        </div>

        <div className="flex">
          <button className="btn btn-ghost" onClick={load}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
          {canWrite ? (
            <button className="btn btn-red" onClick={() => navigate('/transactions?new=1')}>
              <Icon name="exchange" size={15} /> Record update
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid stats mb">
        <StatCard label="Items on the list" value={fmtNum(totals.totalItems)} sub={`${fmtNum(totals.totalQuantity)} units in total`} icon="box" />
        <StatCard
          label="In the store"
          value={fmtNum(totals.availableQuantity)}
          sub={totals.totalIssued ? `${fmtNum(totals.totalIssued)} units issued out` : 'Nothing issued out'}
          tone="green"
          icon="archive"
        />
        <StatCard
          label="Running low"
          value={fmtNum(totals.lowQuantityCount)}
          sub={totals.lowQuantityCount ? 'Items at or below their reorder level' : 'Everything is above its reorder level'}
          tone={totals.lowQuantityCount ? 'red' : 'green'}
          icon="alert"
        />
        <StatCard
          label="Pending returns"
          value={fmtNum(totals.pendingReturnCount)}
          sub={totals.overdueCount ? `${fmtNum(totals.overdueCount)} overdue` : 'None overdue'}
          tone={totals.overdueCount ? 'amber' : ''}
          icon="undo"
        />
      </div>

      <div className="grid two mb">
        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Latest updates</h3>
              <p>The most recent things issued, received or returned.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/transactions">
              View all
            </Link>
          </div>
          <div className="card-body flush">
            {recentTransactions.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Update</th>
                      <th>Item</th>
                      <th className="num">Qty</th>
                      <th>Party</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((t) => (
                      <tr key={t._id}>
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
                          <div>{t.to?.name || t.from?.name || '—'}</div>
                          <div className="cell-sub">{t.to?.department || t.from?.department || ''}</div>
                        </td>
                        <td className="nowrap small muted">{fmtAgo(t.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="exchange" title="No updates yet" message="Issue or receive some material and it will show up here." />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Running low</h3>
              <p>Items at or below their reorder level.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/inventory?lowQuantity=true">
              View all
            </Link>
          </div>
          <div className="card-body flush">
            {lowQuantity.length ? (
              <div className="table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="num">In store</th>
                      <th className="num">Reorder at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowQuantity.map((i) => (
                      <tr key={i._id} className="clickable" onClick={() => navigate(`/inventory/${i._id}`)}>
                        <td>
                          <div className="cell-main">{i.name}</div>
                          <div className="cell-sub">
                            {i.itemCode}
                            {i.location ? ` · ${i.location}` : ''}
                          </div>
                        </td>
                        <td className="num">
                          <b style={{ color: i.available === 0 ? 'var(--red-600)' : 'inherit' }}>{fmtNum(i.available)}</b>{' '}
                          <span className="cell-sub">{i.unit}</span>
                        </td>
                        <td className="num">{fmtNum(i.reorderLevel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="check-circle" title="Nothing is running low" message="No item is at or below its reorder level." />
            )}
          </div>
        </div>
      </div>

      <div className="grid three mb">
        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>By category</h3>
              <p>How the list splits up.</p>
            </div>
          </div>
          <div className="card-body">
            {byCategory.length ? (
              <Breakdown rows={byCategory} total={totals.totalItems} />
            ) : (
              <Empty icon="tag" title="No categories in use" message="Set a category on an item to see this list." />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>By condition</h3>
              <p>What shape the material is in.</p>
            </div>
          </div>
          <div className="card-body">
            {byCondition.length ? (
              <Breakdown rows={byCondition} total={totals.totalItems} toneFor={(k) => CONDITION_BAR[k]} />
            ) : (
              <Empty icon="shield" title="Nothing on the list yet" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>By location</h3>
              <p>Where the material sits.</p>
            </div>
          </div>
          <div className="card-body">
            {byLocation.length ? (
              <Breakdown rows={byLocation} total={totals.totalItems} />
            ) : (
              <Empty icon="map-pin" title="No locations set" message="Give items a location to see this list." />
            )}
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Out with people</h3>
              <p>Returnable issues that are still pending.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" to="/returns">
              Manage
            </Link>
          </div>
          <div className="card-body flush">
            {pendingReturns.length ? (
              <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Held by</th>
                      <th>Item</th>
                      <th className="num">Pending</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingReturns.map((p) => {
                      const overdue = p.expectedReturnDate && new Date(p.expectedReturnDate) < new Date();
                      return (
                        <tr key={p._id}>
                          <td>
                            <div className="cell-main">{p.to?.name || '—'}</div>
                            <div className="cell-sub">{p.to?.department || p.to?.employeeId || ''}</div>
                          </td>
                          <td>
                            <div>{p.itemNameSnapshot}</div>
                            <div className="cell-sub">{p.txnNumber}</div>
                          </td>
                          <td className="num">
                            {fmtNum(p.pending)} <span className="cell-sub">{p.unit}</span>
                          </td>
                          <td className="nowrap">
                            {p.expectedReturnDate ? (
                              <Badge tone={overdue ? 'red' : 'grey'} dot={overdue}>
                                {fmtDate(p.expectedReturnDate)}
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
            ) : (
              <Empty icon="check-circle" title="Nothing is out on loan" message="Every returnable issue has come back." />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Recent activity</h3>
              <p>Who changed what, most recent first.</p>
            </div>
          </div>
          <div className="card-body">
            {activity?.length ? (
              <div style={{ display: 'grid', gap: 11 }}>
                {activity.slice(0, 9).map((a) => (
                  <div key={a._id} className="flex" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{a.summary}</div>
                      <div className="cell-sub">
                        {a.userName} · {fmtAgo(a.createdAt)}
                      </div>
                    </div>
                    {isAdmin ? (
                      <button className="icon-btn danger" title="Delete entry" aria-label="Delete entry" onClick={() => removeActivity(a._id)}>
                        <Icon name="x" size={13} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Empty icon="activity" title="Nothing recorded yet" message="Actions will appear here as your team uses the dashboard." />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
