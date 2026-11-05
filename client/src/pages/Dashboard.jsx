import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSos } from '../context/SosContext';
import SosButton from '../components/SosButton';

export default function Dashboard() {
  const { user } = useAuth();
  const { activeAlert, trigger, geoState, position, watchLocation } = useSos();
  const [notice, setNotice] = useState('');

  useEffect(() => watchLocation(), [watchLocation]);

  const stealth = user.settings?.stealthMode !== false;
  const contacts = user.emergencyContacts.length;

  async function onTrigger(source) {
    setNotice('');
    const result = await trigger(source);
    if (result === 'failed') setNotice('Your request was not sent. Check your connection and try again.');
  }

  const location = {
    unknown: 'Waiting for your browser to share your location.',
    granted: position ? `Location is on, accurate to about ${Math.round(position.accuracy)} m.` : 'Location is on.',
    denied: 'Location is blocked. Allow location for this site in your browser settings so contacts can find you.',
    unavailable: 'This device cannot share its location. Contacts will still be told you need help.',
  }[geoState];

  return (
    <div className="dashboard">
      <section className="sos-stage" aria-label="Silent SOS">
        <SosButton mode={user.settings?.triggerMode} onTrigger={onTrigger} />
        <p className="sos-help">
          {user.settings?.triggerMode === 'tap' ? 'Tap once to send.' : 'Press and hold for about a second.'} Nothing will show or sound
          on this screen.
        </p>
        {notice && <p className="error" role="alert">{notice}</p>}
        {activeAlert && !stealth && (
          <p className="sent-note">Help request sent. Your contacts are being notified and your location is shared until you mark yourself safe.</p>
        )}
      </section>

      <section className="readiness" aria-label="Readiness">
        <h2>Before you need it</h2>
        <dl className="facts">
          <div className={`fact ${geoState === 'granted' ? 'ok' : 'warn'}`}>
            <dt>Location</dt>
            <dd>{location}</dd>
          </div>
          <div className={`fact ${contacts ? 'ok' : 'warn'}`}>
            <dt>Trusted contacts</dt>
            <dd>
              {contacts
                ? `${contacts} ${contacts === 1 ? 'person' : 'people'} will be notified.`
                : 'No one will be notified yet.'}{' '}
              <Link to="/contacts">{contacts ? 'Manage contacts' : 'Add a contact'}</Link>
            </dd>
          </div>
          <div className="fact ok">
            <dt>Discreet mode</dt>
            <dd>
              {stealth ? 'On. After you send a request, this screen looks unchanged.' : 'Off. A banner confirms when a request is sent.'}{' '}
              <Link to="/settings">Change</Link>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
