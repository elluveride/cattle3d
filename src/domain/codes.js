export const CODE_LENGTH = 4;

export const isValidCode = (code) => /^\d{4}$/.test(code);

export function generateCode(taken, random = Math.random) {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 200; attempt++) {
    const code = String(1000 + Math.floor(random() * 9000));
    if (!used.has(code)) return code;
  }
  for (let n = 1000; n <= 9999; n++) if (!used.has(String(n))) return String(n);
  throw new Error('All check-in codes are in use');
}
