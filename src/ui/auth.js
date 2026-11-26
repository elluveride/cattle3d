// Admin unlock lives in sessionStorage (dies with the tab) and expires when idle.
const KEY = 'robotics-tracker/admin-session';
export const IDLE_MS = 15 * 60_000;

let fallback = 0;

const read = () => {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    return fallback;
  }
};

const write = (stamp) => {
  fallback = stamp;
  try {
    if (stamp) sessionStorage.setItem(KEY, String(stamp));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sessionStorage unavailable: in-memory fallback is enough */
  }
};

export const isUnlocked = () => {
  const stamp = read();
  return stamp > 0 && Date.now() - stamp < IDLE_MS;
};

export const unlock = () => write(Date.now());
export const lock = () => write(0);
export const touch = () => {
  if (isUnlocked()) write(Date.now());
};
