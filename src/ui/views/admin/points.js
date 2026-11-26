import { html } from '../../html.js';
import { adminShell } from './shell.js';
import { adminOnlyAll } from '../../guard.js';
import { subteamsOf } from '../../../domain/members.js';
import { byId, byName } from '../../../domain/util.js';
import { fmtDateTime, fmtPoints, plural } from '../../format.js';
import { newId } from '../../ids.js';
import { delta, empty } from '../../components.js';

const RECENT_LIMIT = 60;

const boxesIn = (form) => [...form.querySelectorAll('input[name="members"]')];

function updateCount(form) {
  const n = boxesIn(form).filter((b) => b.checked).length;
  form.querySelector('[data-selected]').textContent = `${n} selected`;
}

const select = (el, predicate) => {
  const form = el.closest('form');
  boxesIn(form).forEach((box) => {
    box.checked = predicate(box);
  });
  updateCount(form);
};

function adjustForm(state) {
  const active = state.members.filter((m) => m.active).sort(byName);
  return html`
    <form data-form="adjust" class="stack">
      <fieldset>
        <legend>Who? <span class="muted" data-selected>0 selected</span></legend>
        <div class="chips">
          <button type="button" class="chip" data-action="selectAll">Everyone</button>
          ${subteamsOf(active).map((t) => html`<button type="button" class="chip" data-action="selectTeam" data-team="${t}">${t}</button>`)}
          <button type="button" class="chip" data-action="selectNone">Clear</button>
        </div>
        <div class="check-grid">
          ${active.map((m) => html`<label class="check"><input type="checkbox" name="members" value="${m.id}" data-team="${m.subteam}" data-change="count"><span>${m.name}</span></label>`)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Quick reasons</legend>
        <div class="chips">
          ${state.settings.behaviorPresets.map((p, i) => html`<button type="button" class="chip ${p.delta < 0 ? 'chip-neg' : 'chip-pos'}" data-action="preset" data-index="${i}">${p.label} <b>${fmtPoints(p.delta)}</b></button>`)}
        </div>
      </fieldset>
      <div class="grid-2">
        <label><span>Points <small>use a minus sign to deduct</small></span><input type="number" name="delta" step="1" required placeholder="e.g. 5 or -5"></label>
        <label>Reason<input name="reason" required maxlength="120" placeholder="What happened?"></label>
      </div>
      <div class="row"><button class="btn btn-primary">Apply points</button></div>
    </form>`;
}

function recentTable(state) {
  const names = new Map(state.members.map((m) => [m.id, m.name]));
  const recent = state.ledger.filter((e) => e.kind === 'behavior').sort((a, b) => b.at - a.at).slice(0, RECENT_LIMIT);
  if (!recent.length) return html`<p class="muted">Nothing yet.</p>`;
  return html`
    <div class="table-wrap"><table class="table">
      <thead><tr><th>When</th><th>Who</th><th>Reason</th><th class="num">Points</th><th></th></tr></thead>
      <tbody>
        ${recent.map((e) => html`
          <tr>
            <td class="nowrap">${fmtDateTime(e.at)}</td>
            <td>${names.get(e.memberId) ?? 'Unknown'}</td>
            <td>${e.reason}</td>
            <td class="num">${delta(e.delta)}</td>
            <td class="actions"><button class="btn btn-sm btn-ghost" data-action="undo" data-id="${e.id}">Undo</button></td>
          </tr>`)}
      </tbody>
    </table></div>`;
}

export default {
  title: () => 'Points',
  render(ctx) {
    const { state } = ctx;
    if (!state.members.some((m) => m.active)) {
      return adminShell(ctx, empty('No members yet', 'Add members before giving out points.', html`<a class="btn btn-primary" href="#/admin/members">Add members</a>`));
    }
    return adminShell(ctx, html`
      <div class="page-head"><div><h1>Points</h1><p class="muted">Reward good behavior, deduct for the bad. Attendance and task points are automatic.</p></div></div>
      <section class="card"><h2>Award or deduct</h2>${adjustForm(state)}</section>
      <section class="card"><h2>Recent behavior points</h2>${recentTable(state)}</section>`);
  },
  actions: adminOnlyAll({
    selectAll: ({ el }) => select(el, () => true),
    selectNone: ({ el }) => select(el, () => false),
    selectTeam: ({ el }) => select(el, (box) => box.checked || box.dataset.team === el.dataset.team),
    preset: ({ el, api }) => {
      const preset = api.state.settings.behaviorPresets[Number(el.dataset.index)];
      const { elements } = el.closest('form');
      elements.delta.value = preset.delta;
      elements.reason.value = preset.label;
    },
    undo: ({ el, api }) => {
      if (!confirm('Remove this entry?')) return;
      api.dispatch({ type: 'points/entryRemoved', id: el.dataset.id });
      api.toast('Removed');
    },
  }),
  changes: { count: ({ el }) => updateCount(el.closest('form')) },
  forms: adminOnlyAll({
    adjust: ({ form, api }) => {
      const memberIds = form.getAll('members').map(String);
      const points = Math.round(Number(form.get('delta')));
      const reason = String(form.get('reason')).trim();
      if (!memberIds.length) return api.toast('Pick at least one member', 'err');
      if (!points) return api.toast("Points can't be zero", 'err');
      if (!reason) return api.toast('Add a reason', 'err');
      api.dispatch({ type: 'points/adjusted', entries: memberIds.map((memberId) => ({ id: newId(), memberId, delta: points, reason })) });
      const who = memberIds.length === 1 ? byId(api.state.members, memberIds[0])?.name : plural(memberIds.length, 'member');
      api.toast(`${fmtPoints(points)} pts → ${who}`);
    },
  }),
};
