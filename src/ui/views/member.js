import { html } from '../html.js';
import { attendanceStats, meetingStart } from '../../domain/attendance.js';
import { leaderboard } from '../../domain/leaderboard.js';
import { entriesFor } from '../../domain/ledger.js';
import { memberTaskSummary } from '../../domain/tasks.js';
import { byId, sum } from '../../domain/util.js';
import { fmtDateKey, fmtDateTime, fmtHours, fmtPct, fmtTime } from '../format.js';
import { avatar, delta, empty, statusPill, taskPill, tile } from '../components.js';

const KIND_ICONS = { attendance: '📅', task: '🔧', behavior: '⭐' };

function contributions(work) {
  const subsystems = Object.entries(work.bySubsystem).sort((a, b) => b[1] - a[1]);
  const tasks = [...work.open, ...work.done];
  return html`
    <section class="card">
      <h2>Robot contributions</h2>
      ${subsystems.length ? html`<div class="chips">${subsystems.map(([name, n]) => html`<span class="chip">${name} <b>${n}</b></span>`)}</div>` : ''}
      ${tasks.length
        ? html`<ul class="task-list">${tasks.map((t) => html`<li><span class="grow">${t.title}<small>${t.subsystem || 'General'}</small></span>${t.status === 'done' ? delta(t.points) : taskPill(t.status)}</li>`)}</ul>`
        : html`<p class="muted">No tasks assigned yet.</p>`}
    </section>`;
}

const history = (entries) => html`
  <section class="card">
    <h2>Points history</h2>
    ${entries.length
      ? html`<ul class="ledger">${entries.map((e) => html`<li><span class="ledger-kind" title="${e.kind}">${KIND_ICONS[e.kind] ?? '•'}</span><span class="grow">${e.reason}<small>${fmtDateTime(e.at)}</small></span>${delta(e.delta)}</li>`)}</ul>`
      : html`<p class="muted">No points yet.</p>`}
  </section>`;

function visits(state, memberId) {
  const meetings = new Map(state.meetings.map((m) => [m.id, m]));
  const list = state.attendance
    .filter((r) => r.memberId === memberId && meetings.has(r.meetingId))
    .map((r) => ({ r, m: meetings.get(r.meetingId) }))
    .sort((a, b) => meetingStart(b.m) - meetingStart(a.m));
  return html`
    <section class="card">
      <h2>Attendance</h2>
      ${list.length
        ? html`<ul class="visits">${list.map(({ r, m }) => html`<li><span class="grow"><b>${fmtDateKey(m.date)}</b> <span class="muted">${m.title}</span></span>${r.checkIn ? html`<small class="muted">${fmtTime(r.checkIn)}${r.checkOut ? `–${fmtTime(r.checkOut)}` : ''}</small>` : ''}${statusPill(r.status)}</li>`)}</ul>`
        : html`<p class="muted">No meetings recorded yet.</p>`}
    </section>`;
}

export default {
  title: (ctx) => byId(ctx.state.members, ctx.route.parts[1])?.name ?? 'Member',
  render(ctx) {
    const { state, route } = ctx;
    const member = byId(state.members, route.parts[1]);
    if (!member) return empty('Member not found', 'They may have been removed.', html`<a class="btn" href="#/leaderboard">Back to leaderboard</a>`);

    const board = leaderboard(state);
    const rank = board.find((r) => r.member.id === member.id)?.rank;
    const entries = entriesFor(state.ledger, member.id);
    const stats = attendanceStats(state, member.id);
    const work = memberTaskSummary(state.tasks, member.id);
    const counted = stats.present + stats.late + stats.absent;

    return html`
      <a class="back" href="#/leaderboard">← Leaderboard</a>
      <section class="card profile">
        ${avatar(member.name, 'lg')}
        <div class="grow">
          <h1>${member.name}</h1>
          <p class="muted">${member.subteam || 'No subteam'} · ${rank ? `Rank #${rank} of ${board.length}` : html`<span class="badge">Inactive</span>`}</p>
        </div>
        <div class="profile-points"><span>${sum(entries.map((e) => e.delta))}</span><small>points</small></div>
      </section>
      <div class="tiles">
        ${tile('Attendance', fmtPct(stats.rate), `${stats.present + stats.late} of ${counted} meetings`)}
        ${tile('Shop hours', fmtHours(stats.hours))}
        ${tile('Tasks done', work.done.length, `${work.points} pts from tasks`)}
        ${tile('Late arrivals', stats.late, `${stats.excused} excused`)}
      </div>
      <div class="two-col">${contributions(work)}${history(entries)}</div>
      ${visits(state, member.id)}`;
  },
};
