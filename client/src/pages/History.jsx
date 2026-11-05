import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { fmtDateTime, fmtDuration } from '../lib/format';

export default function History() {
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/alerts')
      .then((d) => setAlerts(d.alerts))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <h1>Your requests</h1>
      <p className="muted">Every request you have sent, with the time each step happened.</p>
      {error && <p className="error" role="alert">{error}</p>}
      {alerts && alerts.length === 0 && <div className="empty"><p>You have not sent any requests. That is a good sign.</p></div>}
      {alerts && alerts.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>Status</th>
                <th>Delivered in</th>
                <th>Acknowledged in</th>
                <th><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDateTime(a.triggeredAt)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>{fmtDuration(a.deliveryTimeMs)}</td>
                  <td>{fmtDuration(a.responseTimeMs)}</td>
                  <td><Link to={`/alerts/${a.id}`}>View details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
