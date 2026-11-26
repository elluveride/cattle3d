import { html } from '../../html.js';
import { adminShell } from './shell.js';
import { adminOnlyAll } from '../../guard.js';
import { parseMemberLines, sortMembers, subteamsOf } from '../../../domain/members.js';
import { generateCode, isValidCode } from '../../../domain/codes.js';
import { totalsByMember } from '../../../domain/ledger.js';
import { byId } from '../../../domain/util.js';
import { newId } from '../../ids.js';
import { avatar } from '../../components.js';

const COMMON_SUBTEAMS = ['Build', 'Programming', 'CAD', 'Electrical', 'Outreach', 'Drive team'];

const subteamOptions = (members) => html`
  <datalist id="subteam-options">
    ${[...new Set([...subteamsOf(members), ...COMMON_SUBTEAMS])].map((t) => html`<option value="${t}"></option>`)}
  </datalist>`;

const editDialog = (m) => html`
  <form data-form="save" class="dialog-form">
    <h2>Edit member</h2>
    <input type="hidden" name="id" value="${m.id}">
    <label>Name<input name="name" required maxlength="60" value="${m.name}" autofocus></label>
    <label>Subteam<input name="subteam" maxlength="40" list="subteam-options" value="${m.subteam}"></label>
    <div class="field">
      <label for="member-code">Check-in code</label>
      <div class="row"><input id="member-code" name="code" required inputmode="numeric" pattern="[0-9]{4}" maxlength="4" value="${m.code}"><button type="button" class="btn" data-action="regenCode" data-id="${m.id}">New code</button></div>
    </div>
    <label class="check"><input type="checkbox" name="active" ${m.active ? 'checked' : ''}><span>Active <small class="muted">· on the leaderboard and counted for attendance</small></span></label>
    <div class="dialog-actions">
      <button type="button" class="btn btn-danger-ghost" data-action="remove" data-id="${m.id}">Delete</button>
      <span class="spacer"></span>
      <button type="button" class="btn" data-action="closeDialog">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </form>`;

function roster(members, totals) {
  return html`
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Name</th><th>Subteam</th><th>Code</th><th class="num">Points</th><th></th></tr></thead>
      <tbody>
        ${members.map((m) => html`
          <tr class="${m.active ? '' : 'inactive'}">
            <td><a class="who-cell" href="#/member/${encodeURIComponent(m.id)}">${avatar(m.name, 'sm')}${m.name}</a>${m.active ? '' : html` <span class="badge">Inactive</span>`}</td>
            <td>${m.subteam || html`<span class="muted">—</span>`}</td>
            <td><code>${m.code}</code></td>
            <td class="num">${totals.get(m.id) ?? 0}</td>
            <td class="actions"><button class="btn btn-sm" data-action="edit" data-id="${m.id}">Edit</button></td>
          </tr>`)}
      </tbody>
    </table></div>`;
}

export default {
  title: () => 'Members',
  render(ctx) {
    const { state } = ctx;
    const members = sortMembers(state.members);
    const activeCount = members.filter((m) => m.active).length;
    return adminShell(ctx, html`
      ${subteamOptions(state.members)}
      <div class="page-head"><h1>Members</h1>${activeCount ? html`<a class="btn" href="#/admin/codes">🖨 Print check-in codes</a>` : ''}</div>
      <section class="card">
        <h2>Add members</h2>
        <form data-form="add" class="stack">
          <label><span>Names <small>One per line. Add a subteam after a comma, like “Ava Ramirez, Programming”.</small></span>
            <textarea name="lines" rows="3" required placeholder="Ava Ramirez, Programming&#10;Ben Tran, Build"></textarea>
          </label>
          <div class="row row-end wrap">
            <label class="grow">Subteam for lines without one<input name="subteam" list="subteam-options" maxlength="40" placeholder="Optional"></label>
            <button class="btn btn-primary">Add members</button>
          </div>
        </form>
      </section>
      <section class="card">
        <h2>Roster <span class="muted">· ${activeCount} active</span></h2>
        ${members.length ? roster(members, totalsByMember(state.ledger)) : html`<p class="muted">No members yet. Add some above.</p>`}
      </section>`);
  },
  forms: adminOnlyAll({
    add({ form, api }) {
      const parsed = parseMemberLines(form.get('lines'), String(form.get('subteam') ?? ''));
      if (!parsed.length) return api.toast('Type at least one name', 'err');
      const taken = api.state.members.map((m) => m.code);
      const members = parsed.map((p) => {
        const code = generateCode(taken);
        taken.push(code);
        return { id: newId(), name: p.name, subteam: p.subteam, code };
      });
      api.dispatch({ type: 'members/added', members });
      api.toast(members.length === 1 ? `Added ${members[0].name} · code ${members[0].code}` : `Added ${members.length} members`);
    },
    save({ form, api }) {
      const id = String(form.get('id'));
      const code = String(form.get('code')).trim();
      const name = String(form.get('name')).trim();
      if (!name) return api.toast('Name is required', 'err');
      if (!isValidCode(code)) return api.toast('Code must be 4 digits', 'err');
      if (api.state.members.some((m) => m.id !== id && m.code === code)) return api.toast('Someone else already has that code', 'err');
      api.dispatch({
        type: 'member/updated',
        id,
        patch: { name, subteam: String(form.get('subteam')).trim(), code, active: form.get('active') === 'on' },
      });
      api.closeDialog();
      api.toast('Saved');
    },
  }),
  actions: adminOnlyAll({
    edit: ({ el, api }) => api.openDialog(editDialog(byId(api.state.members, el.dataset.id))),
    regenCode: ({ el, api }) => {
      const others = api.state.members.filter((m) => m.id !== el.dataset.id).map((m) => m.code);
      el.closest('form').elements.code.value = generateCode(others);
    },
    remove: ({ el, api }) => {
      const member = byId(api.state.members, el.dataset.id);
      if (!member) return;
      if (!confirm(`Delete ${member.name} and all of their attendance and points?\n\nTip: unchecking "Active" hides them but keeps history.`)) return;
      api.dispatch({ type: 'member/removed', id: member.id });
      api.closeDialog();
      api.toast(`${member.name} deleted`);
    },
  }),
};
