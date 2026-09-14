import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { TOKEN_KEY } from '../api/client.js';
import { Brand } from '../components/Layout.jsx';
import Icon from '../components/Icon.jsx';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('The two passwords do not match.');

    setBusy(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      localStorage.setItem(TOKEN_KEY, data.token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-form" style={{ minHeight: '100vh', background: 'var(--grey-100)' }}>
      <div className="auth-box card" style={{ padding: 30 }}>
        <div className="flex" style={{ marginBottom: 22, gap: 12 }}>
          <div className="brand-mark on-light" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <b style={{ fontSize: 14.5, letterSpacing: '.6px' }}>
              SI <span style={{ color: 'var(--red-600)' }}>INVENTORY</span>
            </b>
            <div style={{ fontSize: 9.5, letterSpacing: 1.7, color: 'var(--grey-500)' }}>SYSTEM INTEGRATION</div>
          </div>
        </div>

        <h1 style={{ fontSize: 21, fontWeight: 800 }}>Choose a new password</h1>
        <p className="muted small" style={{ margin: '6px 0 22px' }}>
          Pick something at least 6 characters long.
        </p>

        {error ? <div className="alert error">{error}</div> : null}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="p1">New password</label>
            <input id="p1" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="field">
            <label htmlFor="p2">Confirm new password</label>
            <input id="p2" className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-red btn-block btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="key" size={16} />}
            Set new password
          </button>
        </form>

        <div className="auth-alt">
          <button onClick={() => navigate('/login')}>Back to sign in</button>
        </div>
      </div>
    </div>
  );
}
