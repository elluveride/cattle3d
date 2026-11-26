const adminOnly = (handler) => (args) =>
  args.api.auth.isUnlocked() ? handler(args) : args.api.toast('Unlock admin first', 'err');

export const adminOnlyAll = (handlers) =>
  Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, adminOnly(handler)]));
