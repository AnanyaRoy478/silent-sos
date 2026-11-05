import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { openSocket } from '../lib/socket';
import { fmtAgo, fmtDateTime, mapsLink, useNow } from '../lib/format';
import MapView from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';

// Public page opened from the SMS / email link. The token in the URL is the credential.
export default function Track() {
  const { token } = useParams();
  const { user } = useAuth();
  const now = useNow();
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !name) setName(user.name);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(
    () =>
      api
        .get(`/track/${token}`, { auth: false })
        .then((d) => {
          setAlert(d.alert);
          setError('');
        })
        .catch((e) => setError(e.message)),
    [token]
  );

  useEffect(() => {
    load();
    const socket = openSocket({ trackToken: token });
    socket.on('alert:updated', (a) => setAlert(a));
    socket.on('alert:location', (p) => {
      if (!p.location) return;
      setAlert((prev) => prev && prev.status !== 'resolved' && { ...prev, location: p.location, path: [...(prev.path || []), [p.location.lat, p.location.lng]] });
    });
    const poll = setInterval(load, 30000); // safety net if the realtime channel drops
    return () => {
      socket.close();
      clearInterval(poll);
    };
  }, [token, load]);

  async function acknowledge() {
    setBusy(true);
    try {
      const d = await api.post(`/track/${token}/acknowledge`, { name }, { auth: false });
      setAlert(d.alert);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!alert) {
    return (
      <div className="track">
        <TrackHeader user={user} />
        <main className="content">{error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading</p>}</main>
      </div>
    );
  }

  const resolved = alert.status === 'resolved';
  const markers = alert.location
    ? [{ id: 'them', lat: alert.location.lat, lng: alert.location.lng, accuracy: alert.location.accuracy, label: alert.userName, tone: 'danger' }]
    : [];

  return (
    <div className="track">
      <TrackHeader user={user} />
      <main className="content">
        <div className="page-head">
          <div>
            <h1>{resolved ? `${alert.userName} is safe` : `${alert.userName} needs help`}</h1>
            <p><StatusBadge status={alert.status} /> <span className="muted">Sent {fmtDateTime(alert.triggeredAt)}</span></p>
          </div>
        </div>

        {error && <p className="error" role="alert">{error}</p>}

        {resolved ? (
          <div className="panel"><p>{alert.userName} ended this request. Live location sharing has stopped. Thank you for being there.</p></div>
        ) : (
          <>
            {alert.location ? (
              <>
                <MapView markers={markers} path={alert.path} height={380} />
                <p className="small">
                  Location updated {fmtAgo(alert.location.updatedAt, now)}
                  {alert.location.accuracy ? `, accurate to about ${alert.location.accuracy} m` : ''}.{' '}
                  <a href={mapsLink(alert.location)} target="_blank" rel="noreferrer">Open in Google Maps</a>
                </p>
              </>
            ) : (
              <div className="empty"><p>{alert.userName}’s location has not arrived yet. This page updates by itself as soon as it does.</p></div>
            )}

            <section className="panel">
              <h2>Let {alert.userName} know you are on the way</h2>
              <p className="muted">
                Acknowledging records your response for the team and your contact. If you believe they are in immediate danger, call your local emergency number.
              </p>
              {alert.status === 'sent' || !alert.acknowledgedAt ? null : <p className="success">Someone has already acknowledged this request. You can still add your response.</p>}
              <div className="row">
                <label className="inline-label">
                  Your name
                  <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="So they know who is coming" />
                </label>
                <button className="btn btn-primary" onClick={acknowledge} disabled={busy}>{busy ? 'Sending' : 'I am responding'}</button>
              </div>
            </section>
          </>
        )}

        <h2>Activity</h2>
        <Timeline logs={alert.logs} />
      </main>
    </div>
  );
}

function TrackHeader({ user }) {
  return (
    <header className="topbar">
      <div className="brand"><Link to={user ? '/' : '/login'} className="wordmark">Silent SOS</Link></div>
    </header>
  );
}
