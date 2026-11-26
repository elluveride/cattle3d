import { sha256 } from './sha256.js';

export const isValidPin = (pin) => /^\d{4,8}$/.test(pin);

export const hashPin = (pin, salt) => sha256(`${salt}:${pin}`);

export const verifyPin = (admin, pin) =>
  Boolean(admin?.salt && admin?.hash) && hashPin(pin, admin.salt) === admin.hash;
