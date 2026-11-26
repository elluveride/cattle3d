const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const dayTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const safeFormat = (formatter, date, fallback) => (Number.isNaN(date.getTime()) ? fallback : formatter.format(date));

export const fmtTime = (ms) => time.format(ms);
export const fmtHHMM = (hhmm) => safeFormat(time, new Date(`2000-01-01T${hhmm}:00`), hhmm);
export const fmtDateKey = (key) => safeFormat(day, new Date(`${key}T12:00:00`), key);
export const fmtDateTime = (ms) => dayTime.format(ms);
export const fmtPoints = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
export const fmtPct = (ratio) => (ratio == null ? '—' : `${Math.round(ratio * 100)}%`);
export const fmtHours = (h) => `${h >= 10 ? Math.round(h) : h.toFixed(1)} h`;
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const firstName = (name) => String(name).trim().split(/\s+/)[0];
export const initials = (name) =>
  String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
export const hueOf = (name) => [...String(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
