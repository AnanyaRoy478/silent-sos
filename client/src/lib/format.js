import { useEffect, useState } from 'react';

export const STATUS_LABEL = { sent: 'Sent', acknowledged: 'Acknowledged', resolved: 'Resolved' };

export function fmtDateTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDuration(ms) {
  if (ms == null) return 'Not available';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${Math.round(s % 60)} s`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function fmtPercent(ratio) {
  return ratio == null ? 'Not available' : `${Math.round(ratio * 100)}%`;
}

export function fmtUptime(seconds) {
  if (seconds == null) return 'Not available';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d} d ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}

export function fmtAgo(value, now = Date.now()) {
  if (!value) return '';
  const s = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

// Re-renders the component on an interval so relative times stay fresh.
export function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const mapsLink = (loc) => (loc ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}` : '#');
