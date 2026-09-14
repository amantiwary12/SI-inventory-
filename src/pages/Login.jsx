import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Brand } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../api/client.js';

const HIGHLIGHTS = [
  'One list of every material, its condition and where it sits',
  'Issue to AIC, any department or any employee in seconds',
  'Know who is holding what, and what is overdue',
  'Add or remove any field you need — no developer required',
];

const OTHER = '__other__';

export default function Login() {
  const { login, register } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState('login'); // login | register | forgot
  // Sign-up asks for just these four things; the rest can be added later in Settings.
  const [form, setForm] = useState({ name: '', department: '', email: '', password: '' });
  const [departments, setDepartments] = useState([]);
  const [otherDept, setOtherDept] = useState(false); // "Other" picked: department is typed in by hand
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (mode !== 'register' || departments.length) return;
    api
      .get('/auth/departments')
      .then(({ data }) => setDepartments(data.departments || []))
      .catch(() => {});
  }, [mode, departments.length]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);

    try {
      if (mode === 'login') {
        const u = await login(form.email, form.password);
        toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      } else if (mode === 'register') {
        const u = await register({
          name: form.name.trim(),
          department: form.department.trim(),
          email: form.email.trim(),
          password: form.password,
        });
        toast.success('Account created', `Signed in as ${u.role}.`);
      } else {
        const { data } = await api.post('/auth/forgot-password', { email: form.email });
        setNotice(data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const switchTo = (m) => {
    setMode(m);
    setError('');
    setNotice('');
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="logo">
          <Brand />
        </div>

        <h2>
          System Integration <em>Inventory</em>
        </h2>
        <p className="lead">
          One list for every material the team holds, issues or receives — whether it comes from AIC, a vendor, another
          department, or an employee.
        </p>

        <ul>
          {HIGHLIGHTS.map((h) => (
            <li key={h}>
              <i>
                <Icon name="check" size={12} />
              </i>
              {h}
            </li>
          ))}
        </ul>

        <div className="tag">Inventory Dashboard</div>
      </div>

      <div className="auth-form">
        <div className="auth-box">
          <h1>
            {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create your account' : 'Reset your password'}
          </h1>
          <p>
            {mode === 'login'
              ? 'Use your work email to access the inventory.'
              : mode === 'register'
                ? 'The first account created becomes the administrator.'
                : "Enter your email and we'll send you a reset link."}
          </p>

          {error ? <div className="alert error">{error}</div> : null}
          {notice ? <div className="alert success">{notice}</div> : null}

          <form onSubmit={submit}>
            {mode === 'register' ? (
              <>
                <div className="field">
                  <label htmlFor="name">
                    Full name<span className="req">*</span>
                  </label>
                  <input id="name" className="input" value={form.name} onChange={set('name')} required autoComplete="name" />
                </div>
                <div className="field">
                  <label htmlFor="dept">
                    Department<span className="req">*</span>
                  </label>
                  {departments.length ? (
                    <select
                      id="dept"
                      className="select"
                      value={otherDept ? OTHER : form.department}
                      onChange={(e) => {
                        const isOther = e.target.value === OTHER;
                        setOtherDept(isOther);
                        setForm((f) => ({ ...f, department: isOther ? '' : e.target.value }));
                      }}
                      required
                    >
                      <option value="" disabled>
                        Select your department
                      </option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                      <option value={OTHER}>Other (type it in)</option>
                    </select>
                  ) : null}
                  {!departments.length || otherDept ? (
                    <input
                      id={departments.length ? 'dept-other' : 'dept'}
                      className="input"
                      style={departments.length ? { marginTop: 8 } : undefined}
                      value={form.department}
                      onChange={set('department')}
                      required
                      autoFocus={otherDept}
                      placeholder="Type your department name"
                    />
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="field">
              <label htmlFor="email">
                Email address<span className="req">*</span>
              </label>
              <input
                id="email"
                className="input"
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>

            {mode !== 'forgot' ? (
              <div className="field">
                <label htmlFor="password">
                  Password<span className="req">*</span>
                </label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            ) : null}

            {mode === 'login' ? (
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button type="button" className="auth-alt" style={{ margin: 0 }} onClick={() => switchTo('forgot')}>
                  <span style={{ color: 'var(--navy-600)', fontSize: 12.5, fontWeight: 600 }}>Forgot password?</span>
                </button>
              </div>
            ) : null}

            <button className="btn btn-red btn-block btn-lg" disabled={busy} type="submit">
              {busy ? <span className="spinner" /> : <Icon name={mode === 'forgot' ? 'mail' : 'logout'} size={16} />}
              {mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="auth-alt">
            {mode === 'login' ? (
              <>
                New to the dashboard? <button onClick={() => switchTo('register')}>Create an account</button>
              </>
            ) : (
              <>
                Already have an account? <button onClick={() => switchTo('login')}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
