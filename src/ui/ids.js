// crypto.randomUUID needs a secure context; getRandomValues works everywhere.
export const randomHex = (bytes = 16) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

export const newId = () => `${Date.now().toString(36)}${randomHex(4)}`;
