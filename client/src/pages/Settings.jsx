import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    phone: user.phone || '',
    triggerMode: user.settings.triggerMode,
    stealthMode: user.settings.stealthMode,
    haptic: user.settings.haptic,
    customMessage: user.settings.customMessage || '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [status, setStatus] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setStatus({ type: '', text: '' });
    try {
      const body = {
        name: form.name,
        phone: form.phone,
        settings: { triggerMode: form.triggerMode, stealthMode: form.stealthMode, haptic: form.haptic, customMessage: form.customMessage },
      };
      if (pw.newPassword) Object.assign(body, pw);
      const d = await api.put('/auth/me', body);
      setUser(d.user);
      setPw({ currentPassword: '', newPassword: '' });
      setStatus({ type: 'ok', text: 'Settings saved.' });
    } catch (err) {
      setStatus({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Settings</h1>
      <form className="form" onSubmit={save}>
        <section className="panel">
          <h2>Your details</h2>
          <label>
            Full name
            <input required value={form.name} onChange={set('name')} />
          </label>
          <label>
            Phone number
            <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+919876543210" />
            <span className="hint">Lets people who list this number as a contact reach you in the app.</span>
          </label>
          <label>
            Message added to alerts (optional)
            <input maxLength={200} value={form.customMessage} onChange={set('customMessage')} placeholder="For example: I am on the night shift at the library" />
          </label>
        </section>

        <section className="panel">
          <h2>How the button works</h2>
          <fieldset>
            <legend>Trigger</legend>
            <label className="check">
              <input type="radio" name="mode" value="hold" checked={form.triggerMode === 'hold'} onChange={set('triggerMode')} /> Press and hold for about a second (fewer accidental sends)
            </label>
            <label className="check">
              <input type="radio" name="mode" value="tap" checked={form.triggerMode === 'tap'} onChange={set('triggerMode')} /> Single tap (fastest)
            </label>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={form.stealthMode} onChange={set('stealthMode')} /> Discreet mode: show nothing on screen after a request is sent
          </label>
          <label className="check">
            <input type="checkbox" checked={form.haptic} onChange={set('haptic')} /> Short vibration when a request is sent (phones that support it)
          </label>
        </section>

        <section className="panel">
          <h2>Change password</h2>
          <label>
            Current password
            <input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </label>
          <label>
            New password
            <input type="password" autoComplete="new-password" minLength={8} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </label>
        </section>

        {status.text && <p className={status.type === 'error' ? 'error' : 'success'} role="status">{status.text}</p>}
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save settings'}</button>
          <button type="button" className="btn" onClick={logout}>Sign out</button>
        </div>
      </form>
    </div>
  );
}
