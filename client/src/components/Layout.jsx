import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSos } from '../context/SosContext';

export default function Layout() {
  const { user } = useAuth();
  const { activeAlert, incoming } = useSos();
  const stealth = user.settings?.stealthMode !== false;
  const openIncoming = incoming.filter((a) => a.status !== 'resolved');

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Link to="/" className="wordmark">Silent SOS</Link>
          {activeAlert && stealth && (
            <Link to={`/alerts/${activeAlert.id}`} className={`quiet-dot dot-${activeAlert.status}`} aria-label="Open request status" />
          )}
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/contacts">Contacts</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/incoming">
            Alerts for you
            {openIncoming.length > 0 && <span className="count">{openIncoming.length}</span>}
          </NavLink>
          <NavLink to="/settings">Settings</NavLink>
          {user.role === 'admin' && <NavLink to="/admin">Monitor</NavLink>}
        </nav>
      </header>

      {openIncoming.length > 0 && (
        <Link to="/incoming" className="banner banner-danger" role="alert">
          {openIncoming.length === 1
            ? `${openIncoming[0].userName} sent a request for help. View live location`
            : `${openIncoming.length} people sent requests for help. View live locations`}
        </Link>
      )}

      {activeAlert && !stealth && (
        <Link to={`/alerts/${activeAlert.id}`} className="banner banner-calm">
          Your request for help is active and your location is being shared. Open status
        </Link>
      )}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
