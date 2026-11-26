import { html } from '../../html.js';
import { adminShell } from './shell.js';
import { adminOnlyAll } from '../../guard.js';
import { STATUS_LABELS, STATUSES } from '../../../domain/attendance.js';
import { formatPresets, parsePresets } from '../../../domain/presets.js';
import { hashPin, isValidPin, verifyPin } from '../../../domain/pin.js';
import { emptyState, looksLikeBackup } from '../../../domain/state.js';
import { fmtDateTime, plural } from '../../format.js';
import { randomHex } from '../../ids.js';

const intIn = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

const pinField = (name, label) =>
  html`<label>${label}<input type="password" name="${name}" inputmode="numeric" autocomplete="off" pattern="[0-9]{4,8}" maxlength="8" required></label>`;

export default {
  title: () => 'Settings',
  render(ctx) {
    const s = ctx.state.settings;
    return adminShell(ctx, html`
      <div class="page-head"><h1>Settings</h1></div>
      <div class="settings-grid">
        <section class="card">
          <h2>Team</h2>
          <form data-form="team" class="stack">
            <label>Team name<input name="teamName" required maxlength="60" value="${s.teamName}"></label>
            <div class="row"><button class="btn btn-primary">Save</button></div>
          </form>
        </section>

        <section class="card">
          <h2>Attendance points</h2>
          <form data-form="attendance" class="stack">
            <div class="grid-4">${STATUSES.map((st) => html`<label>${STATUS_LABELS[st]}<input type="number" step="1" name="pts-${st}" value="${s.points[st]}"></label>`)}</div>
            <div class="grid-2">
              <label><span>Late after <small>minutes past start</small></span><input type="number" min="0" max="180" name="grace" value="${s.lateGraceMinutes}"></label>
              <label><span>Check-in opens <small>minutes before start</small></span><input type="number" min="0" max="240" name="early" value="${s.checkInOpensMinutes}"></label>
            </div>
            <label class="check"><input type="checkbox" name="rescore"><span>Also re-score past meetings with these values</span></label>
            <div class="row"><button class="btn btn-primary">Save</button></div>
          </form>
        </section>

        <section class="card">
          <h2>Robot subsystems</h2>
          <form data-form="subsystems" class="stack">
            <label>One per line<textarea name="subsystems" rows="7">${s.subsystems.join('\n')}</textarea></label>
            <div class="row"><button class="btn btn-primary">Save</button></div>
          </form>
        </section>

        <section class="card">
          <h2>Behavior quick reasons</h2>
          <form data-form="presets" class="stack">
            <label><span>One per line, like <code>Left tools out | -3</code></span><textarea name="presets" rows="7">${formatPresets(s.behaviorPresets)}</textarea></label>
            <div class="row"><button class="btn btn-primary">Save</button></div>
          </form>
        </section>

        <section class="card">
          <h2>Change admin PIN</h2>
          <form data-form="pin" class="stack">
            ${pinField('current', 'Current PIN')}
            <div class="grid-2">${pinField('next', 'New PIN')}${pinField('confirm', 'Confirm new PIN')}</div>
            <div class="row"><button class="btn btn-primary">Change PIN</button></div>
          </form>
        </section>

        <section class="card">
          <h2>Data</h2>
          <p class="muted">Everything is stored in this browser on this device. Export a backup regularly${s.lastBackupAt ? `. Last backup: ${fmtDateTime(s.lastBackupAt)}` : ''}.</p>
          <div class="row wrap gap-top">
            <button class="btn btn-primary" data-action="exportData">Export backup</button>
            <label class="btn">Import backup<input type="file" accept="application/json,.json" data-change="importFile" hidden></label>
          </div>
          <hr>
          <div class="row wrap">
            <button class="btn" data-action="loadDemo">Load demo data</button>
            <button class="btn btn-danger-ghost" data-action="startFresh">Start fresh</button>
          </div>
          <p class="muted small">Start fresh erases members, meetings, tasks and points but keeps these settings. Handy for a new season, after you export a backup.</p>
        </section>
      </div>`);
  },
  forms: adminOnlyAll({
    team({ form, api }) {
      const teamName = String(form.get('teamName')).trim();
      if (!teamName) return api.toast('Team name is required', 'err');
      api.dispatch({ type: 'settings/updated', patch: { teamName } });
      api.toast('Saved');
    },
    attendance({ form, api }) {
      const points = Object.fromEntries(STATUSES.map((st) => [st, intIn(form.get(`pts-${st}`), -1000, 1000, 0)]));
      api.dispatch({
        type: 'settings/updated',
        patch: {
          points,
          lateGraceMinutes: intIn(form.get('grace'), 0, 180, 10),
          checkInOpensMinutes: intIn(form.get('early'), 0, 240, 30),
        },
      });
      if (form.get('rescore') === 'on') api.dispatch({ type: 'attendance/rescored' });
      api.toast(form.get('rescore') === 'on' ? 'Saved and re-scored past meetings' : 'Saved. New values apply from now on.');
    },
    subsystems({ form, api }) {
      const subsystems = [...new Set(String(form.get('subsystems')).split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
      api.dispatch({ type: 'settings/updated', patch: { subsystems } });
      api.toast('Saved');
    },
    presets({ form, api }) {
      const { presets, skipped } = parsePresets(form.get('presets'));
      api.dispatch({ type: 'settings/updated', patch: { behaviorPresets: presets } });
      api.toast(skipped ? `Saved. Skipped ${plural(skipped, 'line')} without “| points”.` : 'Saved', skipped ? 'warn' : 'ok');
    },
    pin({ form, el, api }) {
      const next = String(form.get('next'));
      if (!verifyPin(api.state.settings.admin, String(form.get('current')))) return api.toast('Current PIN is wrong', 'err');
      if (!isValidPin(next)) return api.toast('New PIN must be 4–8 digits', 'err');
      if (next !== form.get('confirm')) return api.toast("New PINs don't match", 'err');
      const salt = randomHex();
      api.dispatch({ type: 'settings/updated', patch: { admin: { salt, hash: hashPin(next, salt) } } });
      el.reset();
      api.toast('PIN changed');
    },
  }),
  actions: adminOnlyAll({
    startFresh({ api }) {
      if (prompt('This erases all members, meetings, tasks and points.\nType ERASE to confirm.') !== 'ERASE') return;
      api.replaceState({ ...emptyState(), settings: api.state.settings });
      api.toast('Started fresh');
    },
  }),
  changes: adminOnlyAll({
    async importFile({ el, api }) {
      const file = el.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!looksLikeBackup(data)) throw new Error('not a backup');
        if (!confirm(`Replace ALL current data with this backup (${plural(data.members.length, 'member')})?`)) return;
        api.replaceState(data);
        api.toast('Backup restored');
      } catch {
        api.toast("That file isn't a valid backup", 'err');
      } finally {
        el.value = '';
      }
    },
  }),
};
