import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../api/client';
import { openSocket } from '../lib/socket';
import { fmtAgo, fmtDateTime, fmtDuration, fmtPercent, fmtUptime, mapsLink, useNow } from '../lib/format';
import MapView from '../components/MapView';
import StatusBadge from '../components/StatusBadge';
import Timeline from '../components/Timeline';

const FILTERS = [
  ['active', 'Active now'],
  ['all', 'All'],
  ['sent', 'Waiting'],
  ['acknowledged', 'Acknowledged'],
  ['resolved', 'Resolved'],
];

export default function Admin() {
  const now = useNow();
  const [filter, setFilter] = useState('active');
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAlerts = useCallback(
    () =>
      api
        .get(`/admin/alerts?filter=${filter}`)
        .then((d) => setAlerts(d.alerts))
        .catch((e) => setError(e.message)),
    [filter]
  );
  const loadStats = useCallback(
    () =>
      api
        .get('/admin/stats')
        .then((d) => setStats(d.stats))
        .catch((e) => setError(e.message)),
    []
  );

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 60000);
    return () => clearInterval(t);
  }, [loadStats]);

  useEffect(() => {
    const socket = openSocket({ token: getToken() });
    socket.on('alert:changed', () => {
      loadAlerts();
      loadStats();
    });
    socket.on('alert:location', (p) => {
      setAlerts((prev) => prev.map((a) => (a.id === p.id ? { ...a, location: p.location } : a)));
    });
    return () => socket.close();
  }, [loadAlerts, loadStats]);

  const selected = alerts.find((a) => a.id === selectedId) || null;

  const markers = useMemo(
    () =>
      alerts
        .filter((a) => a.location && a.isActive)
        .map((a) => ({ id: a.id, lat: a.location.lat, lng: a.location.lng, accuracy: a.location.accuracy, label: a.user.name, tone: a.id === selectedId ? 'danger' : 'calm' })),
    [alerts, selectedId]
  );

  async function act(kind) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/admin/alerts/${selected.id}/${kind}`);
      await Promise.all([loadAlerts(), loadStats()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const max = stats ? Math.max(1, ...stats.daily.map((d) => d.count)) : 1;

  return (
    <div className="page wide">
      <h1>Monitor</h1>
      {error && <p className="error" role="alert">{error}</p>}

      {stats && (
        <dl className="figures">
          <div><dt>Active now</dt><dd>{stats.activeAlerts}</dd></div>
          <div><dt>Total alerts</dt><dd>{stats.totalAlerts}</dd></div>
          <div><dt>Delivered to contacts</dt><dd>{stats.deliveredAlerts} ({fmtPercent(stats.deliveryRate)})</dd></div>
          <div><dt>Average delivery time</dt><dd>{fmtDuration(stats.avgDeliveryMs)}</dd></div>
          <div><dt>Acknowledgment rate</dt><dd>{fmtPercent(stats.acknowledgmentRate)}</dd></div>
          <div><dt>Average time to acknowledge</dt><dd>{fmtDuration(stats.avgResponseMs)}</dd></div>
          <div><dt>Safety satisfaction</dt><dd>{stats.avgRating == null ? 'No ratings yet' : `${stats.avgRating} / 5 (${stats.ratingCount})`}</dd></div>
          <div><dt>Server running for</dt><dd>{fmtUptime(stats.processUptimeSeconds)}</dd></div>
        </dl>
      )}

      {stats && stats.daily.length > 0 && (
        <section aria-label="Alerts in the last 7 days">
          <h2>Alerts in the last 7 days</h2>
          <ul className="bars">
            {stats.daily.map((d) => (
              <li key={d.date}>
                <span className="bar" style={{ height: `${Math.max(8, (d.count / max) * 80)}px` }} title={`${d.count} alerts`} />
                <span className="bar-n">{d.count}</span>
                <span className="bar-l">{d.date.slice(5)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="tabs" role="tablist" aria-label="Filter alerts">
        {FILTERS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'tab on' : 'tab'} onClick={() => { setFilter(key); setSelectedId(null); }}>
            {label}
          </button>
        ))}
      </div>

      {markers.length > 0 && <MapView markers={markers} height={300} />}

      {alerts.length === 0 ? (
        <div className="empty"><p>{filter === 'active' ? 'No active alerts right now.' : 'No alerts match this filter.'}</p></div>
      ) : (
        <div className="split">
          <div className="table-wrap">
            <table className="table table-select">
              <thead>
                <tr><th>Person</th><th>Status</th><th>Sent</th><th>Location</th></tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className={a.id === selectedId ? 'on' : ''} onClick={() => setSelectedId(a.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedId(a.id)}>
                    <td>{a.user.name}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>{fmtDateTime(a.triggeredAt)}</td>
                    <td>{a.location ? fmtAgo(a.location.updatedAt, now) : 'No fix'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="detail panel" aria-live="polite">
            {!selected ? (
              <p className="muted">Select an alert to see its timeline and respond.</p>
            ) : (
              <>
                <h2>{selected.user.name}</h2>
                <p className="small muted">{[selected.user.phone, selected.user.email].filter(Boolean).join('. ')}</p>
                <p><StatusBadge status={selected.status} /></p>
                {selected.location && <p className="small"><a href={mapsLink(selected.location)} target="_blank" rel="noreferrer">Open last location in Google Maps</a></p>}
                <p className="small">Delivered in {fmtDuration(selected.deliveryTimeMs)}. Acknowledged in {fmtDuration(selected.responseTimeMs)}.</p>
                {selected.isActive && (
                  <div className="row">
                    {selected.status === 'sent' && <button className="btn btn-primary" disabled={busy} onClick={() => act('acknowledge')}>Acknowledge</button>}
                    <button className="btn" disabled={busy} onClick={() => act('resolve')}>Resolve</button>
                  </div>
                )}
                <Timeline logs={selected.logs} />
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
