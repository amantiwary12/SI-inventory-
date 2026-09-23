import { useCallback, useEffect, useMemo, useState } from 'react';
import publicApi from '../api/publicClient.js';
import Icon from '../components/Icon.jsx';

/**
 * The screen that opens when somebody scans the store QR code on their phone.
 *
 * No sign-in, no account, no jargon. The whole store catalogue is here: search
 * it, filter by category, pick quantities, then four boxes — who you are, your
 * department, your mobile number and when it comes back. The same page takes
 * returns, found by mobile number, name or reference code. Everything is one
 * column and thumb-sized, because it is read standing at the store with one
 * hand holding a box.
 */

const OTHER_DEPT = '__other__';

/** `datetime-local` wants local time in YYYY-MM-DDTHH:mm — never the UTC of toISOString(). */
function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default the return a week out at 6pm — the common case, still editable. */
function defaultReturnAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(18, 0, 0, 0);
  return toLocalInput(d);
}

const nowLocal = () => toLocalInput(new Date());

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtWhen = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function Scan() {
  // home | pick | details | issued | find | give-back | returned
  const [screen, setScreen] = useState('home');

  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(''); // '' = every category
  const [cart, setCart] = useState({}); // itemId -> quantity

  const [form, setForm] = useState({
    name: '',
    department: '',
    phone: '',
    email: '',
    employeeId: '',
    expectedReturnDate: defaultReturnAt(),
    purpose: '',
  });
  const [otherDept, setOtherDept] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  // --- return flow ---
  const [lookup, setLookup] = useState('');
  const [holdings, setHoldings] = useState([]);
  const [picked, setPicked] = useState({}); // txnId -> quantity
  const [returned, setReturned] = useState(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await publicApi.get('/catalog');
      setCatalog(data.items || []);
      setCategories(data.categories || []);
      setDepartments(data.departments || []);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((i) => {
      if (category && i.category !== category) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.itemCode.toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      );
    });
  }, [catalog, search, category]);

  const chosen = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ item: catalog.find((i) => i._id === id), quantity: qty })).filter((l) => l.item),
    [cart, catalog]
  );
  const chosenCount = chosen.length;

  const setQty = (item, qty) => {
    const next = Math.max(0, Math.min(qty, item.available));
    setCart((c) => {
      const copy = { ...c };
      if (next <= 0) delete copy[item._id];
      else copy[item._id] = next;
      return copy;
    });
  };

  function goToDetails() {
    if (!chosenCount) return;
    setError('');
    setScreen('details');
  }

  async function submitIssue(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('Please enter your name.');
    if (!form.department.trim()) return setError('Please choose your department.');
    if (form.phone.replace(/\D/g, '').length < 10) return setError('Please enter your 10-digit mobile number.');
    if (!form.expectedReturnDate) return setError('Please say when you will return it.');

    setBusy(true);
    try {
      const { data } = await publicApi.post('/issue', {
        name: form.name.trim(),
        department: form.department.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        employeeId: form.employeeId.trim(),
        expectedReturnDate: form.expectedReturnDate,
        purpose: form.purpose.trim(),
        lines: chosen.map((l) => ({ item: l.item._id, quantity: l.quantity })),
      });
      setReceipt(data);
      setScreen('issued');
      setCart({});
      loadCatalog();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function findHoldings(e) {
    e.preventDefault();
    setError('');
    if (lookup.trim().length < 3) return setError('Type at least 3 characters of your mobile number or name.');

    setBusy(true);
    try {
      const { data } = await publicApi.get('/holdings', { params: { q: lookup.trim() } });
      setHoldings(data.holdings || []);
      setPicked({});
      setScreen('give-back');
      if (!data.holdings?.length) setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReturn() {
    const lines = Object.entries(picked)
      .filter(([, qty]) => qty > 0)
      .map(([txn, quantity]) => ({ txn, quantity }));

    if (!lines.length) return setError('Tick what you are giving back.');

    setError('');
    setBusy(true);
    try {
      const { data } = await publicApi.post('/return', { lines, name: lookup.trim() });
      setReturned(data.returned || []);
      setScreen('returned');
      loadCatalog();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setScreen('home');
    setCart({});
    setPicked({});
    setHoldings([]);
    setLookup('');
    setReceipt(null);
    setReturned(null);
    setError('');
    setSearch('');
    setCategory('');
  }

  /* ------------------------------ chrome ------------------------------ */

  const Header = ({ back, title, sub }) => (
    <header className="scan-head">
      {back ? (
        <button className="scan-back" onClick={back} aria-label="Go back">
          <Icon name="chevron-left" size={22} />
        </button>
      ) : null}
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
    </header>
  );

  return (
    <div className="scan-page">
      <div className="scan-shell">
        {/* ------------------------------- home ------------------------------- */}
        {screen === 'home' ? (
          <>
            <Header title="R&D Store" sub="R&D · material counter" />
            <div className="scan-body">
              <p className="scan-lead">What would you like to do?</p>

              <button className="scan-choice take" onClick={() => setScreen('pick')}>
                <Icon name="box" size={30} />
                <span>
                  <b>Take material</b>
                  <i>Pick what you need and say when you will return it</i>
                </span>
                <Icon name="chevron-right" size={20} className="chev" />
              </button>

              <button className="scan-choice give" onClick={() => { setError(''); setScreen('find'); }}>
                <Icon name="undo" size={30} />
                <span>
                  <b>Return material</b>
                  <i>Give back what you took earlier</i>
                </span>
                <Icon name="chevron-right" size={20} className="chev" />
              </button>

              <p className="scan-note">No login needed. Just fill in the short form.</p>
            </div>
          </>
        ) : null}

        {/* ------------------------------- pick ------------------------------- */}
        {screen === 'pick' ? (
          <>
            <Header back={() => setScreen('home')} title="Pick material" sub={`${catalog.length} material${catalog.length === 1 ? '' : 's'} in the store — tap + to add`} />

            <div className="scan-search">
              <Icon name="search" size={17} />
              <input
                placeholder="Search by name or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
              {search ? (
                <button onClick={() => setSearch('')} aria-label="Clear search">
                  <Icon name="x" size={16} />
                </button>
              ) : null}
            </div>

            {categories.length > 1 ? (
              <div className="scan-chips">
                <button className={category ? '' : 'on'} onClick={() => setCategory('')}>
                  All
                </button>
                {categories.map((c) => (
                  <button key={c} className={category === c ? 'on' : ''} onClick={() => setCategory(c)}>
                    {c}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="scan-body list">
              {loading ? (
                <div className="scan-empty">Loading the material list…</div>
              ) : loadError ? (
                <div className="scan-alert error">
                  {loadError}
                  <button className="scan-btn ghost sm" onClick={loadCatalog}>
                    Try again
                  </button>
                </div>
              ) : visible.length === 0 ? (
                <div className="scan-empty">Nothing matches {search ? `“${search}”` : `“${category}”`}.</div>
              ) : (
                visible.map((i) => {
                  const qty = cart[i._id] || 0;
                  const out = i.available <= 0;
                  return (
                    <div key={i._id} className={`scan-item${qty ? ' picked' : ''}${out ? ' out' : ''}`}>
                      <div className="scan-item-main">
                        <b>{i.name}</b>
                        <i>
                          {i.itemCode}
                          {i.category ? ` · ${i.category}` : ''}
                          {i.location ? ` · ${i.location}` : ''}
                        </i>
                        <em className={out ? 'none' : ''}>
                          {out ? 'Out of stock' : `${i.available} ${i.unit} available`}
                        </em>
                      </div>

                      {out ? null : qty ? (
                        <div className="scan-stepper">
                          <button onClick={() => setQty(i, qty - 1)} aria-label="One less">
                            <Icon name="minus" size={16} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={qty}
                            min="0"
                            max={i.available}
                            onChange={(e) => setQty(i, Number(e.target.value))}
                          />
                          <button onClick={() => setQty(i, qty + 1)} disabled={qty >= i.available} aria-label="One more">
                            <Icon name="plus" size={16} />
                          </button>
                        </div>
                      ) : (
                        <button className="scan-add" onClick={() => setQty(i, 1)} aria-label={`Add ${i.name}`}>
                          <Icon name="plus" size={20} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {chosenCount ? (
              <div className="scan-bar">
                <span>
                  <b>{chosenCount}</b> material{chosenCount > 1 ? 's' : ''} chosen
                </span>
                <button className="scan-btn" onClick={goToDetails}>
                  Next <Icon name="arrow-right" size={17} />
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {/* ------------------------------ details ----------------------------- */}
        {screen === 'details' ? (
          <>
            <Header back={() => setScreen('pick')} title="Your details" sub="Four boxes and you are done" />

            <form className="scan-body" onSubmit={submitIssue}>
              <div className="scan-summary">
                {chosen.map((l) => (
                  <div key={l.item._id}>
                    <span>{l.item.name}</span>
                    <b>
                      {l.quantity} {l.item.unit}
                    </b>
                  </div>
                ))}
                <button type="button" className="scan-link" onClick={() => setScreen('pick')}>
                  Change
                </button>
              </div>

              {error ? <div className="scan-alert error">{error}</div> : null}

              <label className="scan-field">
                <span>
                  Your name <i>*</i>
                </span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Aman Tiwary"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="scan-field">
                <span>
                  Department <i>*</i>
                </span>
                {otherDept ? (
                  <input
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="Type your department"
                    required
                    autoFocus
                  />
                ) : (
                  <select
                    value={form.department}
                    onChange={(e) => {
                      if (e.target.value === OTHER_DEPT) {
                        setOtherDept(true);
                        setForm((f) => ({ ...f, department: '' }));
                      } else {
                        setForm((f) => ({ ...f, department: e.target.value }));
                      }
                    }}
                    required
                  >
                    <option value="">Choose your department…</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value={OTHER_DEPT}>Other…</option>
                  </select>
                )}
              </label>

              <label className="scan-field">
                <span>
                  Mobile number <i>*</i>
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="10-digit mobile number"
                  autoComplete="tel"
                  required
                />
              </label>

              <label className="scan-field">
                <span>
                  Returning on <i>*</i>
                </span>
                <input
                  type="datetime-local"
                  value={form.expectedReturnDate}
                  min={nowLocal()}
                  onChange={(e) => setForm((f) => ({ ...f, expectedReturnDate: e.target.value }))}
                  required
                />
              </label>

              <details className="scan-more">
                <summary>Add email, employee ID or a reason (optional)</summary>

                <label className="scan-field">
                  <span>
                    Email <em>we will send you a copy</em>
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@aartechsolonics.com"
                    autoComplete="email"
                  />
                </label>

                <label className="scan-field">
                  <span>Employee ID</span>
                  <input
                    value={form.employeeId}
                    onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                    placeholder="e.g. AAR-104"
                  />
                </label>

                <label className="scan-field">
                  <span>What is it for?</span>
                  <textarea
                    rows={2}
                    value={form.purpose}
                    onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                    placeholder="e.g. Panel testing at the customer site"
                  />
                </label>
              </details>

              <button className="scan-btn block" type="submit" disabled={busy}>
                {busy ? 'Recording…' : 'Take the material'}
              </button>
            </form>
          </>
        ) : null}

        {/* ------------------------------ issued ------------------------------ */}
        {screen === 'issued' && receipt ? (
          <div className="scan-body done">
            <div className="scan-tick">
              <Icon name="check" size={38} />
            </div>
            <h2>All done, {form.name.split(' ')[0]}</h2>
            <p>The material is now recorded against your name.</p>

            <div className="scan-code">
              <span>Your reference</span>
              <b>{receipt.code}</b>
            </div>

            <div className="scan-summary plain">
              {receipt.transactions.map((t) => (
                <div key={t.txnNumber}>
                  <span>{t.item}</span>
                  <b>
                    {t.quantity} {t.unit}
                  </b>
                </div>
              ))}
            </div>

            <p className="scan-due">
              Please return by <b>{fmtWhen(receipt.returnBy)}</b>
            </p>

            <button className="scan-btn ghost block" onClick={startOver}>
              Done
            </button>
          </div>
        ) : null}

        {/* ------------------------------- find ------------------------------- */}
        {screen === 'find' ? (
          <>
            <Header back={() => setScreen('home')} title="Return material" sub="Find what is out in your name" />

            <form className="scan-body" onSubmit={findHoldings}>
              <label className="scan-field">
                <span>Your mobile number, name, or reference code</span>
                <input
                  value={lookup}
                  onChange={(e) => setLookup(e.target.value)}
                  placeholder="e.g. 9876543210  ·  SS-000012"
                  autoComplete="tel"
                  autoFocus
                  required
                />
              </label>

              {error ? <div className="scan-alert error">{error}</div> : null}

              <button className="scan-btn block" type="submit" disabled={busy}>
                {busy ? 'Looking…' : 'Find my material'}
              </button>
            </form>
          </>
        ) : null}

        {/* ----------------------------- give back ---------------------------- */}
        {screen === 'give-back' ? (
          <>
            <Header back={() => setScreen('find')} title="Giving back" sub="Tick what you are returning now" />

            <div className="scan-body list">
              {holdings.length === 0 ? (
                <div className="scan-empty">
                  Nothing is out in the name “{lookup}”.
                  <button className="scan-btn ghost sm" onClick={() => setScreen('find')}>
                    Try another name
                  </button>
                </div>
              ) : (
                holdings.map((h) => {
                  const qty = picked[h._id] || 0;
                  return (
                    <div key={h._id} className={`scan-item${qty ? ' picked' : ''}`}>
                      <label className="scan-item-main">
                        <b>{h.item}</b>
                        <i>
                          {h.itemCode} · taken {fmtDate(h.date)}
                          {h.reference ? ` · ${h.reference}` : ''}
                        </i>
                        <em className={h.overdue ? 'none' : ''}>
                          {h.pending} {h.unit} out
                          {h.expectedReturnDate ? ` · due ${fmtDate(h.expectedReturnDate)}` : ''}
                          {h.overdue ? ' · overdue' : ''}
                        </em>
                      </label>

                      {qty ? (
                        <div className="scan-stepper">
                          <button
                            onClick={() => setPicked((p) => ({ ...p, [h._id]: Math.max(0, qty - 1) }))}
                            aria-label="One less"
                          >
                            <Icon name="minus" size={16} />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={qty}
                            min="0"
                            max={h.pending}
                            onChange={(e) =>
                              setPicked((p) => ({ ...p, [h._id]: Math.max(0, Math.min(Number(e.target.value), h.pending)) }))
                            }
                          />
                          <button
                            onClick={() => setPicked((p) => ({ ...p, [h._id]: Math.min(h.pending, qty + 1) }))}
                            disabled={qty >= h.pending}
                            aria-label="One more"
                          >
                            <Icon name="plus" size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="scan-add"
                          onClick={() => setPicked((p) => ({ ...p, [h._id]: h.pending }))}
                          aria-label={`Return ${h.item}`}
                        >
                          <Icon name="check" size={20} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}

              {error ? <div className="scan-alert error">{error}</div> : null}
            </div>

            {Object.values(picked).some((q) => q > 0) ? (
              <div className="scan-bar">
                <span>
                  <b>{Object.values(picked).filter((q) => q > 0).length}</b> to give back
                </span>
                <button className="scan-btn" onClick={submitReturn} disabled={busy}>
                  {busy ? 'Recording…' : 'Return it'}
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {/* ----------------------------- returned ----------------------------- */}
        {screen === 'returned' && returned ? (
          <div className="scan-body done">
            <div className="scan-tick">
              <Icon name="check" size={38} />
            </div>
            <h2>Thank you</h2>
            <p>These are back in the store:</p>

            <div className="scan-summary plain">
              {returned.map((r) => (
                <div key={r.txnNumber}>
                  <span>{r.item}</span>
                  <b>
                    {r.quantity} {r.unit}
                  </b>
                </div>
              ))}
            </div>

            <button className="scan-btn ghost block" onClick={startOver}>
              Done
            </button>
          </div>
        ) : null}

        <footer className="scan-foot">R&amp;D · Aartech Solonics</footer>
      </div>
    </div>
  );
}
