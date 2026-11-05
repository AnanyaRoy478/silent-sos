import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const EMPTY = { name: '', relationship: '', phone: '', email: '', channels: { sms: true, email: true } };

export default function Contacts() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(null); // null | 'new' | contact id
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const contacts = user.emergencyContacts;

  const open = (c) => {
    setError('');
    setEditing(c ? c.id : 'new');
    setForm(c ? { name: c.name, relationship: c.relationship, phone: c.phone, email: c.email, channels: { ...c.channels } } : EMPTY);
  };
  const close = () => setEditing(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setChannel = (k) => (e) => setForm({ ...form, channels: { ...form.channels, [k]: e.target.checked } });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = editing === 'new' ? await api.post('/contacts', form) : await api.put(`/contacts/${editing}`, form);
      setUser({ ...user, emergencyContacts: d.contacts });
      close();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c) {
    if (!window.confirm(`Remove ${c.name} from your trusted contacts?`)) return;
    try {
      const d = await api.del(`/contacts/${c.id}`);
      setUser({ ...user, emergencyContacts: d.contacts });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Trusted contacts</h1>
          <p className="muted">These people receive your location when you send a request. Add up to 10.</p>
        </div>
        {editing === null && contacts.length < 10 && <button className="btn btn-primary" onClick={() => open(null)}>Add contact</button>}
      </div>

      {editing !== null && (
        <form className="form panel" onSubmit={save}>
          <h2>{editing === 'new' ? 'New contact' : 'Edit contact'}</h2>
          <div className="grid-2">
            <label>
              Name
              <input required value={form.name} onChange={set('name')} />
            </label>
            <label>
              Relationship (optional)
              <input value={form.relationship} onChange={set('relationship')} placeholder="Sister, roommate, neighbour" />
            </label>
            <label>
              Phone number
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+919876543210" />
            </label>
            <label>
              Email
              <input type="email" value={form.email} onChange={set('email')} />
            </label>
          </div>
          <fieldset>
            <legend>Notify by</legend>
            <label className="check">
              <input type="checkbox" checked={form.channels.sms} onChange={setChannel('sms')} /> SMS
            </label>
            <label className="check">
              <input type="checkbox" checked={form.channels.email} onChange={setChannel('email')} /> Email
            </label>
            <p className="hint">If this person also has a Silent SOS account with the same email or phone number, they get an in-app alert too.</p>
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save contact'}</button>
            <button type="button" className="btn" onClick={close}>Cancel</button>
          </div>
        </form>
      )}

      {editing === null && error && <p className="error" role="alert">{error}</p>}

      {contacts.length === 0 && editing === null ? (
        <div className="empty">
          <p>You have no trusted contacts yet. Add at least one person who can respond quickly.</p>
          <button className="btn btn-primary" onClick={() => open(null)}>Add your first contact</button>
        </div>
      ) : (
        <ul className="list">
          {contacts.map((c) => (
            <li key={c.id} className="list-row">
              <div>
                <strong>{c.name}</strong>
                {c.relationship && <span className="muted"> ({c.relationship})</span>}
                <div className="muted small">
                  {[c.phone && `SMS ${c.channels.sms ? 'on' : 'off'}: ${c.phone}`, c.email && `Email ${c.channels.email ? 'on' : 'off'}: ${c.email}`]
                    .filter(Boolean)
                    .join('. ')}
                </div>
              </div>
              <div className="row">
                <button className="btn btn-quiet" onClick={() => open(c)}>Edit</button>
                <button className="btn btn-quiet" onClick={() => remove(c)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
