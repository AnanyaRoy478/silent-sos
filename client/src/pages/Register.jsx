import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthShell from '../components/AuthShell';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/contacts', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account">
      <form onSubmit={submit} className="form">
        <label>
          Full name
          <input autoComplete="name" required value={form.name} onChange={set('name')} />
        </label>
        <label>
          Email
          <input type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </label>
        <label>
          Phone number (optional)
          <input type="tel" autoComplete="tel" placeholder="+919876543210" value={form.phone} onChange={set('phone')} />
          <span className="hint">Include the country code. Friends who add you as a contact can then reach you inside the app.</span>
        </label>
        <label>
          Password
          <input type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
          <span className="hint">At least 8 characters.</span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating account' : 'Create account'}</button>
        <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
