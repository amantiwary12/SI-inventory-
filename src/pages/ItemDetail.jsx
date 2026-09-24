import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import Icon from '../components/Icon.jsx';
import ItemForm from '../components/ItemForm.jsx';
import IssueForm from '../components/IssueForm.jsx';
import {
  Badge,
  CONDITION_TONE,
  Empty,
  Loading,
  STATUS_TONE,
  StatCard,
  TYPE_TONE,
  availableOf,
  fmtDate,
  fmtDateTime,
  fmtNum,
  isLow,
} from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useLiveUpdates } from '../context/SocketContext.jsx';

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canWrite, canManageInventory } = useAuth();
  const { labelFor } = useMeta();
  const toast = useToast();
  const attachRef = useRef(null);

  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get(`/items/${id}`);
      setItem(data.item);
      setHistory(data.history);
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useLiveUpdates(['items', 'transactions'], () => load());

  async function addAttachments(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;

    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));

    setUploading(true);
    try {
      const { data } = await api.post(`/items/${id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setItem(data.item);
      toast.success('Files attached', `${files.length} file(s) uploaded.`);
    } catch (err) {
      toast.error('Upload failed', err.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(att) {
    try {
      const { data } = await api.delete(`/items/${id}/attachments/${att._id}`);
      setItem(data.item);
      toast.success('Attachment removed');
    } catch (err) {
      toast.error('Could not remove the file', err.message);
    }
  }

  if (error) {
    return (
      <div className="card">
        <Empty
          icon="alert"
          title="Could not load this item"
          message={error}
          action={
            <button className="btn btn-ghost" onClick={() => navigate('/inventory')}>
              Back to inventory
            </button>
          }
        />
      </div>
    );
  }

  if (!item) return <Loading label="Loading item…" />;

  const avail = availableOf(item);
  const low = isLow(item);

  const spec = [
    ['Item code', item.itemCode],
    [labelFor('category', 'Category'), item.category],
    [labelFor('subCategory', 'Sub category'), item.subCategory],
    [labelFor('make', 'Make / brand'), item.make],
    [labelFor('model', 'Model'), item.model],
    [labelFor('serialNumber', 'Serial number'), item.serialNumber],
    [labelFor('partNumber', 'Part number'), item.partNumber],
    [labelFor('specification', 'Specification'), item.specification],
    [labelFor('description', 'Description'), item.description],
  ];

  const supply = [
    [labelFor('vendor', 'Vendor'), item.vendor],
    [labelFor('poNumber', 'PO number'), item.poNumber],
    [labelFor('invoiceNumber', 'Invoice number'), item.invoiceNumber],
    [labelFor('purchaseDate', 'Received date'), item.purchaseDate ? fmtDate(item.purchaseDate) : ''],
    [labelFor('warrantyExpiry', 'Warranty expiry'), item.warrantyExpiry ? fmtDate(item.warrantyExpiry) : ''],
  ];

  const placement = [
    [labelFor('location', 'Location'), item.location],
    [labelFor('rack', 'Rack / bin'), item.rack],
    [labelFor('ownerDepartment', 'Owner department'), item.ownerDepartment],
    [labelFor('project', 'Project'), item.project],
    [labelFor('source', 'Received from'), item.source],
    [labelFor('remarks', 'Remarks'), item.remarks],
    ['Added by', item.createdBy?.name],
    ['Added on', fmtDateTime(item.createdAt)],
    ['Last updated', fmtDateTime(item.updatedAt)],
  ];

  const Section = ({ title, rows }) => {
    const filled = rows.filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!filled.length) return null;
    return (
      <>
        <div className="fieldset-title" style={{ marginTop: 4 }}>
          {title}
        </div>
        <dl className="kv" style={{ marginBottom: 18 }}>
          {filled.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </>
    );
  };

  return (
    <>
      <div className="flex-between mb">
        <button className="btn btn-ghost" onClick={() => navigate('/inventory')}>
          <Icon name="arrow-left" size={15} /> Back to inventory
        </button>
        <div className="flex">
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Icon name="printer" size={15} /> Print
          </button>
          {canManageInventory ? (
            <button className="btn btn-ghost" onClick={() => setEditOpen(true)}>
              <Icon name="edit" size={15} /> Edit
            </button>
          ) : null}
          {canWrite ? (
            <button className="btn btn-red" onClick={() => setIssueOpen(true)} disabled={!item.active}>
              <Icon name="exchange" size={15} /> Record movement
            </button>
          ) : null}
        </div>
      </div>

      <div className="card mb">
        <div className="card-body">
          <div className="flex" style={{ alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <div className="thumb" style={{ width: 96, height: 96, borderRadius: 0 }}>
              {item.image?.url ? <img src={item.image.url} alt="" /> : <Icon name="box" size={32} strokeWidth={1.4} />}
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="flex" style={{ flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-0.4px' }}>{item.name}</h2>
                <Badge tone={STATUS_TONE[item.status] || 'grey'} dot>
                  {item.status}
                </Badge>
                <Badge tone={CONDITION_TONE[item.condition] || 'grey'}>{item.condition}</Badge>
                {!item.active ? <Badge tone="grey">Archived</Badge> : null}
                {low ? <Badge tone="red">Running low</Badge> : null}
              </div>
              <p className="muted small" style={{ marginTop: 3 }}>
                {item.itemCode}
                {item.category ? ` · ${item.category}` : ''}
                {item.location ? ` · ${item.location}` : ''}
              </p>
              {item.description ? <p style={{ marginTop: 9, fontSize: 13.5, maxWidth: 620 }}>{item.description}</p> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="grid stats mb">
        <StatCard label="Total quantity" value={`${fmtNum(item.quantity)} ${item.unit}`} sub="On the list" icon="box" />
        <StatCard
          label="In the store"
          value={`${fmtNum(avail)} ${item.unit}`}
          sub={low ? `At or below the reorder level of ${fmtNum(item.reorderLevel)}` : 'Ready to issue'}
          tone={low ? 'red' : 'green'}
          icon="archive"
        />
        <StatCard label="Issued out" value={`${fmtNum(item.issuedQuantity)} ${item.unit}`} sub="Held by people or departments" tone="amber" icon="arrow-up" />
        <StatCard label="Updates recorded" value={fmtNum(history.length)} sub="Issues, receipts and returns" tone="blue" icon="activity" />
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <h3>Details</h3>
          </div>
          <div className="card-body">
            <Section title="Identification & specification" rows={spec} />
            <Section title="Supply" rows={supply} />
            <Section title="Placement & ownership" rows={placement} />

            <div className="fieldset-title" style={{ marginTop: 4 }}>
              Documents
            </div>
            {item.attachments?.length ? (
              <div style={{ display: 'grid', gap: 7, marginBottom: 12 }}>
                {item.attachments.map((a) => (
                  <div key={a._id} className="flex" style={{ border: '1px solid var(--border)', borderRadius: 0, padding: '7px 10px' }}>
                    <Icon name="paperclip" size={14} style={{ color: 'var(--grey-400)' }} />
                    <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.name || 'Attachment'}
                    </a>
                    <span className="cell-sub nowrap">{a.bytes ? `${Math.round(a.bytes / 1024)} KB` : ''}</span>
                    {canManageInventory ? (
                      <button className="icon-btn danger" onClick={() => removeAttachment(a)} title="Remove" aria-label="Remove attachment">
                        <Icon name="x" size={13} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted small mb">No invoices, datasheets or test reports attached yet.</p>
            )}

            {canManageInventory ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => attachRef.current?.click()} disabled={uploading}>
                  {uploading ? <span className="spinner dark" /> : <Icon name="paperclip" size={14} />} Attach files
                </button>
                <input ref={attachRef} type="file" multiple hidden onChange={addAttachments} />
              </>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div style={{ flex: 1 }}>
              <h3>Update history</h3>
              <p>Every issue, receipt and return recorded against this material.</p>
            </div>
          </div>
          <div className="card-body flush">
            {history.length ? (
              <div className="table-wrap" style={{ maxHeight: 620, overflowY: 'auto' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="num">Qty</th>
                      <th>Party</th>
                      <th>Date</th>
                      <th>Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((t) => (
                      <tr key={t._id}>
                        <td>
                          <Badge tone={TYPE_TONE[t.type]}>{t.type}</Badge>
                          {t.returnable ? <div className="cell-sub">returnable</div> : null}
                        </td>
                        <td className="num">
                          {fmtNum(t.quantity)} <span className="cell-sub">{t.unit}</span>
                        </td>
                        <td>
                          <div>{t.to?.name || t.from?.name || '—'}</div>
                          <div className="cell-sub">{t.to?.department || t.from?.department || ''}</div>
                        </td>
                        <td className="nowrap small">{fmtDate(t.date)}</td>
                        <td>
                          <div className="cell-sub">{t.txnNumber}</div>
                          {t.docNumber ? <div className="cell-sub">{t.docNumber}</div> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="activity" title="No updates yet" message="Nothing has been issued or received for this material." />
            )}
          </div>
        </div>
      </div>

      <ItemForm open={editOpen} item={item} onClose={() => setEditOpen(false)} onSaved={load} />
      <IssueForm open={issueOpen} item={item} onClose={() => setIssueOpen(false)} onSaved={load} />
    </>
  );
}
