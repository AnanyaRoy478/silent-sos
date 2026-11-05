export const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const cleanStr = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Keeps a leading + and digits only.
export const normalizePhone = (v) => {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  return (s.startsWith('+') ? '+' : '') + digits;
};

// E.164 style: + then 8-15 digits.
export const isPhone = (v) => /^\+\d{8,15}$/.test(v);

export const PHONE_HINT = 'Enter the phone number with country code, for example +919876543210.';

export function parseLocation(input) {
  if (!input || typeof input !== 'object') return null;
  if (input.lat == null || input.lng == null) return null;
  const lat = Number(input.lat);
  const lng = Number(input.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const acc = input.accuracy == null ? NaN : Number(input.accuracy);
  return { lat, lng, accuracy: Number.isFinite(acc) && acc >= 0 ? Math.round(acc) : null };
}
