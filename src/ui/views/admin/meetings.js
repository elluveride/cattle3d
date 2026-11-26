import { html } from '../../html.js';
import { adminShell } from './shell.js';
import { adminOnlyAll } from '../../guard.js';
import { meetingEnd, meetingStart } from '../../../domain/attendance.js';
import { expandSchedule } from '../../../domain/schedule.js';
import { at, toDateKey, toTimeKey } from '../../../domain/time.js';
import { countBy } from '../../../domain/util.js';
import { fmtDateKey, fmtHHMM, plural } from '../../format.js';
import { newId } from '../../ids.js';

const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
const UPCOMING_LIMIT = 10;
const FIVE_MINUTES = 5 * 60_000;

function meetingRow(meeting, attendance, { closable = false } = {}) {
  const c = countBy(attendance.filter((r) => r.meetingId === meeting.id), 'status');
  const here = (c.present ?? 0) + (c.late ?? 0);
  return html`
    <li>
      <a class="meeting-link" href="#/admin/meeting/${encodeURIComponent(meeting.id)}">
        <span class="meeting-date"><b>${fmtDateKey(meeting.date)}</b><small>${fmtHHMM(meeting.start)}–${fmtHHMM(meeting.end)}</small></span>
        <span class="meeting-title">${meeting.title}</span>
        <span class="meeting-counts">
          ${here ? html`<span class="pill status-present">${here} here</span>` : ''}
          ${c.excused ? html`<span class="pill status-excused">${c.excused} excused</span>` : ''}
          ${c.absent ? html`<span class="pill status-absent">${c.absent} absent</span>` : ''}
        </span>
      </a>
      ${closable ? html`<button class="btn btn-sm btn-primary" data-action="close" data-id="${meeting.id}">Close</button>` : ''}
    </li>`;
}

function scheduleForm(last, today) {
  return html`
    <form data-form="schedule" class="stack">
      <div class="grid-4">
        <label>Title<input name="title" required maxlength="60" value="${last?.title ?? 'Team meeting'}"></label>
        <label>First date<input type="date" name="date" required value="${today}"></label>
        <label>Start<input type="time" name="start" required value="${last?.start ?? '15:30'}"></label>
        <label>End<input type="time" name="end" required value="${last?.end ?? '18:00'}"></label>
      </div>
      <fieldset>
        <legend>Repeat every week on <small class="muted">· leave blank for a one-time meeting</small></legend>
        <div class="chips">${WEEKDAYS.map(([n, label]) => html`<label class="check-chip"><input type="checkbox" name="weekday" value="${n}"><span>${label}</span></label>`)}</div>
      </fieldset>
      <div class="row row-end wrap">
        <label>For how many weeks<input type="number" name="weeks" min="1" max="52" value="8"></label>
        <span class="spacer"></span>
        <button class="btn btn-primary">Schedule</button>
      </div>
    </form>`;
}

export default {
  title: () => 'Meetings',
  render(ctx) {
    const { state, now } = ctx;
    const sorted = [...state.meetings].sort((a, b) => meetingStart(a) - meetingStart(b));
    const needsClosing = sorted.filter((m) => !m.closed && meetingEnd(m) < now);
    const upcoming = sorted.filter((m) => !m.closed && meetingEnd(m) >= now);
    const past = sorted.filter((m) => m.closed).reverse();

    return adminShell(ctx, html`
      <div class="page-head"><h1>Meetings</h1><button class="btn btn-primary" data-action="startNow">▶ Start a meeting now</button></div>
      ${needsClosing.length
        ? html`<section class="card attention">
            <h2>Needs closing</h2>
            <p class="muted">Closing a meeting marks anyone who didn't check in as absent.</p>
            <ul class="meeting-list">${needsClosing.map((m) => meetingRow(m, state.attendance, { closable: true }))}</ul>
          </section>`
        : ''}
      <section class="card">
        <h2>Now &amp; upcoming</h2>
        ${upcoming.length
          ? html`<ul class="meeting-list">${upcoming.slice(0, UPCOMING_LIMIT).map((m) => meetingRow(m, state.attendance))}</ul>
              ${upcoming.length > UPCOMING_LIMIT ? html`<p class="muted list-more">+ ${upcoming.length - UPCOMING_LIMIT} more scheduled</p>` : ''}`
          : html`<p class="muted">Nothing scheduled.</p>`}
      </section>
      <section class="card">
        <h2>Schedule meetings</h2>
        ${scheduleForm(sorted.at(-1), toDateKey(now))}
      </section>
      <section class="card">
        <h2>Past meetings</h2>
        ${past.length ? html`<ul class="meeting-list">${past.map((m) => meetingRow(m, state.attendance))}</ul>` : html`<p class="muted">None yet.</p>`}
      </section>`);
  },
  forms: adminOnlyAll({
    schedule({ form, api }) {
      const start = String(form.get('start'));
      const end = String(form.get('end'));
      if (end <= start) return api.toast('End time must be after the start time', 'err');
      const dates = expandSchedule({
        startDate: String(form.get('date')),
        weekdays: form.getAll('weekday').map(Number),
        weeks: Number(form.get('weeks')) || 1,
      });
      const taken = new Set(api.state.meetings.map((m) => `${m.date} ${m.start}`));
      const title = String(form.get('title')).trim() || 'Team meeting';
      const meetings = dates.filter((date) => !taken.has(`${date} ${start}`)).map((date) => ({ id: newId(), title, date, start, end }));
      if (!meetings.length) return api.toast('Those meetings already exist', 'warn');
      api.dispatch({ type: 'meetings/scheduled', meetings });
      api.toast(`Scheduled ${plural(meetings.length, 'meeting')}`);
    },
  }),
  actions: adminOnlyAll({
    startNow({ api }) {
      const now = Date.now();
      const startMs = now - (now % FIVE_MINUTES);
      const date = toDateKey(startMs);
      const end = toTimeKey(Math.min(startMs + 3 * 3_600_000, at(date, '23:59')));
      api.dispatch({ type: 'meetings/scheduled', meetings: [{ id: newId(), title: 'Team meeting', date, start: toTimeKey(startMs), end }] });
      api.navigate('#/');
      api.toast('Meeting started. Check-in is open.');
    },
    close({ el, api }) {
      api.dispatch({ type: 'meeting/closed', id: el.dataset.id });
      api.toast('Meeting closed');
    },
  }),
};
