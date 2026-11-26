import { html } from '../../html.js';
import { hashPin, isValidPin, verifyPin } from '../../../domain/pin.js';
import { randomHex } from '../../ids.js';

const MAX_TRIES = 5;
const COOLDOWN_MS = 30_000;
let failures = 0;
let blockedUntil = 0;

const pinInput = (name, placeholder, autofocus = false) =>
  html`<input type="password" name="${name}" inputmode="numeric" autocomplete="off" pattern="[0-9]{4,8}" maxlength="8" required placeholder="${placeholder}" ${autofocus ? 'autofocus' : ''}>`;

export default {
  title: () => 'Admin',
  render(ctx) {
    const setup = !ctx.state.settings.admin;
    return html`
      <section class="card gate">
        <div class="gate-mark" aria-hidden="true">${setup ? '🛠' : '🔒'}</div>
        <h1>${setup ? 'Create an admin PIN' : 'Admin'}</h1>
        <p class="muted">${setup
          ? 'Mentors and captains use this PIN to manage members, meetings, tasks and points. 4–8 digits.'
          : 'Enter the admin PIN to manage the team.'}</p>
        <form data-form="${setup ? 'createPin' : 'unlock'}" class="stack">
          ${pinInput('pin', 'PIN', true)}
          ${setup ? pinInput('confirm', 'Confirm PIN') : ''}
          <button class="btn btn-primary">${setup ? 'Create PIN' : 'Unlock'}</button>
        </form>
      </section>`;
  },
  forms: {
    unlock({ form, el, api }) {
      if (Date.now() < blockedUntil) return api.toast('Too many tries. Wait 30 seconds.', 'err');
      if (verifyPin(api.state.settings.admin, String(form.get('pin')))) {
        failures = 0;
        api.auth.unlock();
        api.render();
        return;
      }
      failures += 1;
      if (failures >= MAX_TRIES) {
        failures = 0;
        blockedUntil = Date.now() + COOLDOWN_MS;
      }
      el.reset();
      el.querySelector('input')?.focus();
      api.toast('Wrong PIN', 'err');
    },
    createPin({ form, api }) {
      const pin = String(form.get('pin'));
      if (!isValidPin(pin)) return api.toast('PIN must be 4–8 digits', 'err');
      if (pin !== form.get('confirm')) return api.toast("PINs don't match", 'err');
      const salt = randomHex();
      api.auth.unlock();
      api.dispatch({ type: 'settings/updated', patch: { admin: { salt, hash: hashPin(pin, salt) } } });
      api.toast('Admin PIN created');
    },
  },
};
