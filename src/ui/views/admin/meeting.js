import { html } from '../../html.js';
import { adminShell } from './shell.js';
import { adminOnlyAll } from '../../guard.js';
import { hoursOf, STATUS_LABELS, STATUSES } from '../../../domain/attendance.js';
import { byId, byName, countBy } from '../../../domain/util.js';
import { fmtDateKey, fmtHHMM, fmtPoints, fmtTime } from '../../format.js';
import { avatar, empty, tile } from '../../components.js';

const meetingIdOf = (ctx) => ctx.route.parts[2];

const editDialog = (m) => html`
  <form data-form="save" class="dialog-form">
    <h2>Edit meeting</h2>
    <label>Title<input name="title" required maxlength="60" value="${m.title}" autofocus></label>
    <div class="grid-3">
      <label>Date<input type="date" name="date" required value="${m.date}"></label>
      <label>Start<input type="time" name="start" required value="${m.start}"></label>
      <label>End<input type="time" name="end" required value="${m.end}"></label>
    </div>
    <div class="dialog-actions">
      <span class="spacer"></span>
      <button type="button" class="btn" data-action="closeDialog">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </form>`;

function statusSelect(member, record) {
  const current = record?.status ?? '';
  return html`
    <select class="status-select status-${current || 'none'}" data-change="setStatus" data-member="${member.id}" aria-label="Status for ${member.name}">
      <option value="">—</option>
      ${STATUSES.map((s) => html`<option value="${s}" ${s === current ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`)}
    </select>`;
}

function rosterRow(member, record) {
  const hours = record ? hoursOf(record) : 0;
  return html`
    <tr>
      <td><span class="who-cell">${avatar(member.name, 'sm')}${member.name}</span></td>
      <td>${statusSelect(member, record)}${record?.auto ? html` <small class="muted">auto</small>` : ''}</td>
      <td>${record?.checkIn ? fmtTime(record.checkIn) : html`<span class="muted">—</span>`}</td>
      <td>${record?.checkOut ? fmtTime(record.checkOut) : record?.checkIn ? html`<span class="pill status-present">still here</span>` : html`<span class="muted">—</span>`}</td>
      <td class="num">${hours ? hours.toFixed(1) : html`<span class="muted">—</span>`}</td>
    </tr>`;
}

export default {
  title: (ctx) => byId(ctx.state.meetings, meetingIdOf(ctx))?.title ?? 'Meeting',
  render(ctx) {
    const { state } = ctx;
    const meeting = byId(state.meetings, meetingIdOf(ctx));
    if (!meeting) {
      return adminShell(ctx, empty('Meeting not found', 'It may have been deleted.', html`<a class="btn" href="#/admin/meetings">Back to meetings</a>`));
    }
    const records = new Map(state.attendance.filter((r) => r.meetingId === meeting.id).map((r) => [r.memberId, r]));
    const roster = state.members.filter((m) => m.active || records.has(m.id)).sort(byName);
    const counts = countBy([...records.values()], 'status');
    const pts = state.settings.points;

    return adminShell(ctx, html`
      <a class="back" href="#/admin/meetings">← All meetings</a>
      <div class="page-head">
        <div>
          <h1>${meeting.title}</h1>
          <p class="muted">${fmtDateKey(meeting.date)} · ${fmtHHMM(meeting.start)}–${fmtHHMM(meeting.end)} · ${meeting.closed ? 'Closed' : 'Open'}</p>
        </div>
        <div class="row wrap">
          ${meeting.closed
            ? html`<button class="btn" data-action="reopen">Reopen</button>`
            : html`<button class="btn btn-primary" data-action="close">Close meeting</button>`}
          <button class="btn" data-action="edit">Edit</button>
          <button class="btn btn-danger-ghost" data-action="remove">Delete</button>
        </div>
      </div>
      <div class="tiles">${STATUSES.map((s) => tile(STATUS_LABELS[s], counts[s] ?? 0, `${fmtPoints(pts[s])} pts each`))}</div>
      ${meeting.closed
        ? ''
        : html`<p class="note">Closing checks out anyone still here and marks everyone without a check-in as <b>absent</b> (${fmtPoints(pts.absent)} pts). Mark excused absences first.</p>`}
      <section class="card">
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Member</th><th>Status</th><th>In</th><th>Out</th><th class="num">Hours</th></tr></thead>
          <tbody>${roster.map((m) => rosterRow(m, records.get(m.id)))}</tbody>
        </table></div>
      </section>`);
  },
  actions: adminOnlyAll({
    close: ({ api, ctx }) => {
      api.dispatch({ type: 'meeting/closed', id: meetingIdOf(ctx) });
      api.toast('Meeting closed');
    },
    reopen: ({ api, ctx }) => {
      api.dispatch({ type: 'meeting/reopened', id: meetingIdOf(ctx) });
      api.toast('Meeting reopened. Automatic absences were removed.');
    },
    edit: ({ api, ctx }) => api.openDialog(editDialog(byId(api.state.meetings, meetingIdOf(ctx)))),
    remove: ({ api, ctx }) => {
      if (!confirm('Delete this meeting and all of its attendance points?')) return;
      api.dispatch({ type: 'meeting/removed', id: meetingIdOf(ctx) });
      api.navigate('#/admin/meetings');
      api.toast('Meeting deleted');
    },
  }),
  forms: adminOnlyAll({
    save: ({ form, api, ctx }) => {
      const patch = Object.fromEntries(['title', 'date', 'start', 'end'].map((k) => [k, String(form.get(k)).trim()]));
      if (patch.end <= patch.start) return api.toast('End time must be after the start time', 'err');
      api.dispatch({ type: 'meeting/updated', id: meetingIdOf(ctx), patch });
      api.closeDialog();
      api.toast('Saved');
    },
  }),
  changes: adminOnlyAll({
    setStatus: ({ el, api, ctx }) => {
      api.dispatch({ type: 'attendance/statusSet', meetingId: meetingIdOf(ctx), memberId: el.dataset.member, status: el.value || null });
    },
  }),
};
