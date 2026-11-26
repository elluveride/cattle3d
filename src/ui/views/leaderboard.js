import { html } from '../html.js';
import { leaderboard, PERIODS, periodStart } from '../../domain/leaderboard.js';
import { subteamsOf } from '../../domain/members.js';
import { fmtPct } from '../format.js';
import { avatar, empty } from '../components.js';
import { welcome } from './welcome.js';

const MEDALS = ['🥇', '🥈', '🥉'];

const hrefFor = (period, team) => {
  const query = new URLSearchParams();
  if (period !== 'all') query.set('period', period);
  if (team) query.set('team', team);
  const qs = query.toString();
  return `#/leaderboard${qs ? `?${qs}` : ''}`;
};

function row(r, top) {
  const medal = r.rank <= 3 && r.points > 0;
  const width = top > 0 ? (Math.max(0, r.points) / top) * 100 : 0;
  return html`
    <li class="board-row ${medal ? `top top-${r.rank}` : ''}">
      <a href="#/member/${encodeURIComponent(r.member.id)}" style="--w:${width.toFixed(1)}%">
        <span class="rank">${medal ? MEDALS[r.rank - 1] : r.rank}</span>
        ${avatar(r.member.name)}
        <span class="who"><b>${r.member.name}</b><small>${r.member.subteam || 'No subteam'}</small></span>
        <span class="board-stats"><span><b>${fmtPct(r.attendance.rate)}</b> attendance</span><span><b>${r.tasksDone}</b> ${r.tasksDone === 1 ? 'task' : 'tasks'}</span></span>
        <span class="points ${r.points < 0 ? 'neg' : ''}">${r.points}<small>pts</small></span>
      </a>
    </li>`;
}

export default {
  title: () => 'Leaderboard',
  render(ctx) {
    const { state, route, now } = ctx;
    if (!state.members.length) return welcome();
    const period = Object.hasOwn(PERIODS, route.params.period ?? '') ? route.params.period : 'all';
    const teams = subteamsOf(state.members.filter((m) => m.active));
    const team = teams.includes(route.params.team) ? route.params.team : '';
    const rows = leaderboard(state, { since: periodStart(period, now), subteam: team || null });
    const top = Math.max(0, ...rows.map((r) => r.points));
    return html`
      <div class="page-head"><div><h1>Leaderboard</h1><p class="muted">${PERIODS[period]}${team ? ` · ${team}` : ''}</p></div></div>
      <div class="filters">
        <nav class="seg" aria-label="Time period">
          ${Object.entries(PERIODS).map(([key, label]) => html`<a href="${hrefFor(key, team)}" class="${key === period ? 'on' : ''}">${label}</a>`)}
        </nav>
        ${teams.length > 1
          ? html`<nav class="chips" aria-label="Subteam">
              <a class="chip ${team ? '' : 'on'}" href="${hrefFor(period, '')}">Everyone</a>
              ${teams.map((t) => html`<a class="chip ${t === team ? 'on' : ''}" href="${hrefFor(period, t)}">${t}</a>`)}
            </nav>`
          : ''}
      </div>
      ${rows.length ? html`<ol class="board">${rows.map((r) => row(r, top))}</ol>` : empty('Nobody here yet', 'No active members match this filter.')}`;
  },
};
