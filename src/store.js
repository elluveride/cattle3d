const safeLocalStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function createStore({ key, reducer, init, normalize, storage = safeLocalStorage() }) {
  const read = () => {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    try {
      return normalize(JSON.parse(raw));
    } catch {
      try {
        storage.setItem(`${key}/corrupt-${Date.now()}`, raw);
      } catch {
        /* storage full: nothing more we can do */
      }
      return null;
    }
  };

  const write = (state) => {
    try {
      storage.setItem(key, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  };

  let state = read() ?? init();
  const listeners = new Set();
  const emit = (meta) => listeners.forEach((fn) => fn(state, meta));

  // Keep a kiosk tab and an admin tab on the same machine in sync.
  globalThis.addEventListener?.('storage', (event) => {
    if (event.key !== key) return;
    state = read() ?? init();
    emit({ external: true });
  });

  return {
    get: () => state,
    dispatch(action) {
      state = reducer(state, action);
      const saved = write(state);
      emit({ action });
      return saved;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
