import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import { Badge, Empty, Loading, StatCard, fmtDate, fmtDateTime, fmtNum } from '../components/ui.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

/**
 * The admin side of the QR counter: the code to print and stick on the store
 * door, and a plain list of what people took or brought back by scanning it.
 * Deliberately just numbers and a table — no charts.
 */
export default function SelfService() {
  const toast = useToast();

  const scanUrl = `${window.location.origin}/scan`;
  const [qr, setQr] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | ISSUE | RETURN | out

  useEffect(() => {
    QRCode.toDataURL(scanUrl, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#101F49', light: '#FFFFFF' },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [scanUrl]);

  const load = useCallback(
    async (opts) => {
      if (opts?.silent !== true) setLoading(true);
      try {
        const { data } = await api.get('/transactions', { params: { selfService: 'true', limit: 200 } });
        setRows(data.transactions || []);
      } catch (err) {
        toast.error('Could not load the self-service activity', err.message);
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    load();
  }, [load]);

  useLiveUpdates(['transactions', '*'], () => load({ silent: true }));

  const stats = useMemo(() => {
    const issues = rows.filter((r) => r.type === 'ISSUE');
    const stillOut = issues.filter((r) => Math.max(0, r.quantity - r.returnedQuantity) > 0);
    const overdue = stillOut.filter((r) => r.expectedReturnDate && new Date(r.expectedReturnDate) < new Date());
    const people = new Set(issues.map((r) => (r.to?.name || '').toLowerCase()).filter(Boolean));
    return { taken: issues.length, stillOut: stillOut.length, overdue: overdue.length, people: people.size };
  }, [rows]);

  const shown = useMemo(() => {
    if (filter === 'ISSUE' || filter === 'RETURN') return rows.filter((r) => r.type === filter);
    if (filter === 'out') return rows.filter((r) => r.type === 'ISSUE' && Math.max(0, r.quantity - r.returnedQuantity) > 0);
    return rows;
  }, [rows, filter]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(scanUrl);
      toast.success('Link copied', scanUrl);
    } catch {
      toast.error('Could not copy', 'Select the address and copy it by hand.');
    }
  }

  function downloadQR() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = 'si-store-qr.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <>
      <div className="grid stats mb">
        <StatCard label="Taken by scan" value={fmtNum(stats.taken)} sub="Issues recorded at the QR counter" icon="qr" />
        <StatCard label="Still out" value={fmtNum(stats.stillOut)} sub="Not yet brought back" tone="blue" icon="box" />
        <StatCard
          label="Overdue"
          value={fmtNum(stats.overdue)}
          sub={stats.overdue ? 'Past the promised date' : 'Nothing is late'}
          tone={stats.overdue ? 'red' : 'green'}
          icon="clock"
        />
        <StatCard label="People" value={fmtNum(stats.people)} sub="Have used the QR counter" icon="users" />
      </div>

      <div className="grid two mb">
        <div className="card qr-poster">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>The store QR code</h3>
              <p>Print this and stick it on the store door or the rack.</p>
            </div>
          </div>
          <div className="card-body qr-print-area">
            <div className="qr-frame">
              {qr ? <img src={qr} alt="QR code for the SI store self-service page" /> : <div className="qr-placeholder">Generating…</div>}
            </div>
            <h4 className="qr-title">SI STORE — SCAN TO TAKE OR RETURN MATERIAL</h4>
            <ol className="qr-steps">
              <li>Open the camera on your phone and point it at this code.</li>
              <li>Choose the material and the quantity you need.</li>
              <li>Enter your name, department, mobile number and when you will return it.</li>
            </ol>
            <p className="qr-url">{scanUrl}</p>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Icon name="printer" size={15} /> Print poster
            </button>
            <button className="btn btn-ghost" onClick={downloadQR}>
              <Icon name="download" size={15} /> Download PNG
            </button>
            <button className="btn btn-ghost" onClick={copyLink}>
              <Icon name="copy" size={15} /> Copy link
            </button>
            <a className="btn btn-ghost" href={scanUrl} target="_blank" rel="noreferrer">
              <Icon name="external-link" size={15} /> Open it
            </a>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>How it works</h3>
              <p>What happens when somebody scans</p>
            </div>
          </div>
          <div className="card-body">
            <ul className="qr-explain">
              <li>
                <b>No sign-in.</b> The scanner never sees a login screen — they pick material and fill four boxes: name,
                department, mobile number, and when it comes back. Email is optional, for a copy of the receipt.
              </li>
              <li>
                <b>Stock moves at once.</b> Each line becomes a normal returnable issue, so it shows up in{' '}
                <b>Pending Returns</b>, the movement log and the reports exactly like a counter-issued one.
              </li>
              <li>
                <b>Returns need no code.</b> They scan again, type their mobile number or name, and tick what they are
                giving back.
              </li>
              <li>
                <b>To close the counter,</b> switch off <b>QR Self-Service</b> under Settings → Modules &amp; tools. The
                page then tells scanners to see the store keeper.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          Everything
        </button>
        <button className={filter === 'out' ? 'active' : ''} onClick={() => setFilter('out')}>
          Still out
        </button>
        <button className={filter === 'ISSUE' ? 'active' : ''} onClick={() => setFilter('ISSUE')}>
          Taken
        </button>
        <button className={filter === 'RETURN' ? 'active' : ''} onClick={() => setFilter('RETURN')}>
          Returned
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Loading label="Loading self-service activity…" />
        ) : shown.length === 0 ? (
          <Empty
            icon="qr"
            title="Nobody has scanned yet"
            message="Print the QR code above and put it on the store door. Everything taken by scanning it will appear here."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Material</th>
                  <th className="num">Qty</th>
                  <th>What</th>
                  <th>When</th>
                  <th>Return by</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const person = t.type === 'ISSUE' ? t.to : t.from;
                  const pending = Math.max(0, t.quantity - t.returnedQuantity);
                  const overdue = t.type === 'ISSUE' && pending > 0 && t.expectedReturnDate && new Date(t.expectedReturnDate) < new Date();

                  return (
                    <tr key={t._id}>
                      <td>
                        <div className="cell-main">{person?.name || '—'}</div>
                        <div className="cell-sub">
                          {[person?.department, person?.phone, person?.contact].filter(Boolean).join(' · ') || 'No department'}
                        </div>
                      </td>
                      <td>
                        <div className="cell-main">{t.itemNameSnapshot}</div>
                        <div className="cell-sub">{t.itemCodeSnapshot}</div>
                      </td>
                      <td className="num">
                        {fmtNum(t.quantity)} <span className="cell-sub">{t.unit}</span>
                      </td>
                      <td>
                        <Badge tone={t.type === 'ISSUE' ? 'red' : 'green'}>{t.type === 'ISSUE' ? 'Took' : 'Returned'}</Badge>
                        {t.type === 'ISSUE' && pending === 0 ? (
                          <div className="cell-sub" style={{ marginTop: 3 }}>
                            all back
                          </div>
                        ) : null}
                      </td>
                      <td className="nowrap small">{fmtDateTime(t.date)}</td>
                      <td className="nowrap">
                        {t.type !== 'ISSUE' ? (
                          <span className="muted small">—</span>
                        ) : pending === 0 ? (
                          <Badge tone="green">Returned</Badge>
                        ) : t.expectedReturnDate ? (
                          <Badge tone={overdue ? 'red' : 'grey'} dot={overdue}>
                            {overdue ? 'Overdue ' : ''}
                            {fmtDate(t.expectedReturnDate)}
                          </Badge>
                        ) : (
                          <span className="muted small">Not set</span>
                        )}
                      </td>
                      <td className="small nowrap">{t.docNumber || t.txnNumber}</td>
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
