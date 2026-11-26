const MINUTE = 60_000;
const DAY = 86_400_000;
const pad = (n) => String(n).padStart(2, '0');

export const minutes = (n) => n * MINUTE;
export const days = (n) => n * DAY;

export const toDateKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const toTimeKey = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const at = (dateKey, timeKey) => new Date(`${dateKey}T${timeKey}:00`).getTime();

export const weekdayOf = (dateKey) => new Date(`${dateKey}T12:00:00`).getDay();

export const addDaysToKey = (dateKey, n) => {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toDateKey(d.getTime());
};

export const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);

export const startOfWeek = (ms) => {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};
