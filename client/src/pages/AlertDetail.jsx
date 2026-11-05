import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { useSos } from '../context/SosContext';
import { openSocket } from '../lib/socket';
import { fmtAgo, fmtDateTime, fmtDuration, mapsLink, useNow } from '../lib/format';
import MapView from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';

export default function AlertDetail() {
  const { id } = useParams();
  const { resolve } = useSos();
  const now = useNow();
  const [alert, setAlert] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(
    () =>
      api
        .get(`/alerts/${id}`)
        .then((d) => setAlert(d.alert))
        .catch((e) => setError(e.message)),
    [id]
  );

  useEffect(() => {
    load();
    const socket = openSocket({ token: getToken() });
    socket.on('alert:updated', (a) => a.id === id && setAlert((prev) => ({ ...prev, ...a })));
    socket.on('alert:location', (p) => {
      if (p.id !== id || !p.location) return;
      setAlert((prev) => prev && { ...prev, location: p.location, path: [...(prev.path || []), [p.location.lat, p.location.lng]] });
    });
    return () => socket.close();
  }, [id, load]);

  async function markSafe() {
    setBusy(true);
    setError('');
    try {
      await resolve();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function rate(rating) {
    try {
      const d = await api.post(`/alerts/${id}/feedback`, { rating });
      setAlert((prev) => ({ ...prev, feedbackRating: d.alert.feedbackRating }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/track/${alert.trackingToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  if (error && !alert) return <div className="page"><p className="error" role="alert">{error}</p></div>;
  if (!alert) return <div className="page"><p className="muted">Loading</p></div>;

  const markers = alert.location
    ? [{ id: 'me', lat: alert.location.lat, lng: alert.location.lng, accuracy: alert.location.accuracy, label: 'Your location', tone: alert.isActive ? 'danger' : 'calm' }]
    : [];

  return (
    <div className="page">
      <p><Link to="/history">Back to your requests</Link></p>
      <div className="page-head">
        <div>
          <h1>Request from {fmtDateTime(alert.triggeredAt)}</h1>
          <p><StatusBadge status={alert.status} /></p>
        </div>
        {alert.isActive && (
          <button className="btn btn-primary" onClick={markSafe} disabled={busy}>
            {busy ? 'Ending' : 'Mark myself safe'}
          </button>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {alert.isActive && (
        <p className="muted">
          Your location is shared with your contacts until you mark yourself safe.
          {alert.location && ` Last update ${fmtAgo(alert.location.updatedAt, now)}.`}
        </p>
      )}

      {alert.location ? (
        <>
          <MapView markers={markers} path={alert.path} />
          <p className="small"><a href={mapsLink(alert.location)} target="_blank" rel="noreferrer">Open in Google Maps</a></p>
        </>
      ) : (
        <div className="empty"><p>No location has been recorded for this request.</p></div>
      )}

      <dl className="facts facts-inline">
        <div><dt>Delivered in</dt><dd>{fmtDuration(alert.deliveryTimeMs)}</dd></div>
        <div><dt>Acknowledged in</dt><dd>{fmtDuration(alert.responseTimeMs)}</dd></div>
        <div><dt>Acknowledged by</dt><dd>{alert.acknowledgedBy ? alert.acknowledgedBy.name : 'No one yet'}</dd></div>
      </dl>

      {alert.isActive && (
        <div className="row">
          <button className="btn" onClick={copyLink}>{copied ? 'Link copied' : 'Copy live tracking link'}</button>
        </div>
      )}

      <h2>Activity</h2>
      <Timeline logs={alert.logs} />

      <h2>Notifications</h2>
      {alert.notifications.length === 0 ? (
        <p className="muted">{alert.logs.some((l) => l.event === 'no_contacts') ? 'No contacts were set up when this request was sent.' : 'Sending notifications.'}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Contact</th><th>Channel</th><th>Result</th></tr></thead>
            <tbody>
              {alert.notifications.map((n, i) => (
                <tr key={i}>
                  <td>{n.contactName}</td>
                  <td>{n.channel === 'in-app' ? 'In app' : n.channel.toUpperCase()}</td>
                  <td>
                    {n.status === 'sent' && 'Delivered'}
                    {n.status === 'simulated' && 'Logged on the server (no provider configured)'}
                    {n.status === 'failed' && <span className="error-text">Failed{n.error ? `: ${n.error}` : ''}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alert.status === 'resolved' && (
        <section className="panel">
          <h2>How safe did this tool help you feel?</h2>
          {alert.feedbackRating ? (
            <p>Thank you. You rated this {alert.feedbackRating} out of 5.</p>
          ) : (
            <div className="row" role="group" aria-label="Rating from 1 to 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="btn btn-round" onClick={() => rate(n)} aria-label={`${n} out of 5`}>{n}</button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
