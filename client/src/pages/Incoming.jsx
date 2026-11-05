import { Link } from 'react-router-dom';
import { useSos } from '../context/SosContext';
import StatusBadge from '../components/StatusBadge';
import { fmtAgo, fmtDateTime, useNow } from '../lib/format';

export default function Incoming() {
  const { incoming } = useSos();
  const now = useNow(10000);

  return (
    <div className="page">
      <h1>Alerts for you</h1>
      <p className="muted">Requests from people who added you as a trusted contact in the last 7 days.</p>
      {incoming.length === 0 ? (
        <div className="empty"><p>No one has asked you for help. You will see requests here the moment they arrive.</p></div>
      ) : (
        <ul className="list">
          {incoming.map((a) => (
            <li key={a.id} className="list-row">
              <div>
                <strong>{a.userName}</strong> <StatusBadge status={a.status} />
                <div className="muted small">
                  Sent {fmtDateTime(a.triggeredAt)}
                  {a.location && `. Location updated ${fmtAgo(a.location.updatedAt, now)}`}
                </div>
              </div>
              <Link className={`btn ${a.status !== 'resolved' ? 'btn-primary' : ''}`} to={`/track/${a.token}`}>
                {a.status === 'resolved' ? 'View summary' : 'Open live location'}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
