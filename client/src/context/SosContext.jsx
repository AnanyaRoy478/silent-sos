import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken } from '../api/client';
import { openSocket } from '../lib/socket';
import { useAuth } from './AuthContext';

const SosContext = createContext(null);
export const useSos = () => useContext(SosContext);

const SEND_INTERVAL_MS = 5000; // minimum gap between location uploads
const HEARTBEAT_MS = 15000; // re-send the last fix when standing still
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function SosProvider({ children }) {
  const { user } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [position, setPosition] = useState(null);
  const [geoState, setGeoState] = useState('unknown'); // unknown | granted | denied | unavailable
  const [incoming, setIncoming] = useState([]);
  const [consumers, setConsumers] = useState(0);

  const posRef = useRef(null);
  const alertRef = useRef(null);
  const lastSentRef = useRef(0);
  const busyRef = useRef(false);

  const applyAlert = useCallback((a) => {
    alertRef.current = a;
    setActiveAlert(a);
  }, []);

  const refreshIncoming = useCallback(() => {
    api
      .get('/alerts/incoming')
      .then((d) => setIncoming(d.alerts))
      .catch(() => {});
  }, []);

  // Load state and open the realtime channel when someone signs in.
  useEffect(() => {
    if (!user) {
      applyAlert(null);
      setIncoming([]);
      return undefined;
    }
    let cancelled = false;
    api
      .get('/alerts/active')
      .then((d) => !cancelled && applyAlert(d.alert))
      .catch(() => {});
    refreshIncoming();

    const socket = openSocket({ token: getToken() });
    socket.on('alert:updated', (a) => {
      if (alertRef.current && a.id === alertRef.current.id) applyAlert(a.status === 'resolved' ? null : a);
    });
    socket.on('incoming:refresh', refreshIncoming);
    return () => {
      cancelled = true;
      socket.close();
    };
  }, [user?.id, applyAlert, refreshIncoming]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendLocation = useCallback((pos) => {
    const a = alertRef.current;
    if (!a || !pos) return;
    lastSentRef.current = Date.now();
    api.post(`/alerts/${a.id}/location`, { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy }, { keepalive: true }).catch(() => {});
  }, []);

  // Watch the device position while the dashboard is open or an alert is live.
  const hasAlert = !!activeAlert;
  useEffect(() => {
    if (!user) return undefined;
    if (!('geolocation' in navigator)) {
      setGeoState('unavailable');
      return undefined;
    }
    if (consumers === 0 && !hasAlert) return undefined;

    const id = navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
        posRef.current = pos;
        setGeoState('granted');
        setPosition(pos);
        if (alertRef.current && Date.now() - lastSentRef.current >= SEND_INTERVAL_MS) sendLocation(pos);
      },
      (err) => {
        if (err.code === 1) setGeoState('denied');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [user?.id, consumers, hasAlert, sendLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // While an alert is live, keep contacts updated even if the person is standing still.
  useEffect(() => {
    if (!hasAlert) return undefined;
    lastSentRef.current = 0;
    const id = setInterval(() => {
      if (posRef.current && Date.now() - lastSentRef.current >= HEARTBEAT_MS - 1000) sendLocation(posRef.current);
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [hasAlert, sendLocation]);

  const watchLocation = useCallback(() => {
    setConsumers((c) => c + 1);
    return () => setConsumers((c) => c - 1);
  }, []);

  // Returns 'sent' | 'already' | 'failed'
  const trigger = useCallback(
    async (source = 'hold') => {
      if (!user) return 'failed';
      if (alertRef.current || busyRef.current) return 'already';
      busyRef.current = true;
      if (user.settings?.haptic !== false && navigator.vibrate) navigator.vibrate(35);

      const pos = posRef.current;
      const body = { source, location: pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : null };
      try {
        for (const delay of [0, 600, 1500]) {
          if (delay) await sleep(delay);
          try {
            const d = await api.post('/alerts', body);
            lastSentRef.current = 0;
            applyAlert(d.alert);
            return 'sent';
          } catch (err) {
            // Do not retry client errors (except rate limits we cannot fix by retrying either).
            if (err.status && err.status >= 400 && err.status < 500) break;
          }
        }
        if (navigator.vibrate) navigator.vibrate([60, 60, 60]);
        return 'failed';
      } finally {
        busyRef.current = false;
      }
    },
    [user, applyAlert]
  );

  const resolve = useCallback(async () => {
    const a = alertRef.current;
    if (!a) return null;
    const d = await api.post(`/alerts/${a.id}/resolve`);
    applyAlert(null);
    return d.alert;
  }, [applyAlert]);

  const value = useMemo(
    () => ({ activeAlert, position, geoState, incoming, refreshIncoming, watchLocation, trigger, resolve }),
    [activeAlert, position, geoState, incoming, refreshIncoming, watchLocation, trigger, resolve]
  );
  return <SosContext.Provider value={value}>{children}</SosContext.Provider>;
}
