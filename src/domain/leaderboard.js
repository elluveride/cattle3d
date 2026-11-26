import { totalsByMember } from './ledger.js';
import { attendanceStats } from './attendance.js';
import { tasksDoneBy } from './tasks.js';
import { days, startOfWeek } from './time.js';

export const PERIODS = { week: 'This week', '30d': 'Last 30 days', all: 'All time' };

export function periodStart(period, now) {
  if (period === 'week') return startOfWeek(now);
  if (period === '30d') return now - days(30);
  return 0;
}

// Standard competition ranking: 30, 20, 20, 10 -> 1, 2, 2, 4
export function rankByPoints(rows) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name));
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || sorted[i - 1].points !== row.points) rank = i + 1;
    return { ...row, rank };
  });
}

export function leaderboard(state, { since = 0, subteam = null } = {}) {
  const totals = totalsByMember(state.ledger.filter((e) => e.at >= since));
  const rows = state.members
    .filter((m) => m.active && (!subteam || m.subteam === subteam))
    .map((member) => ({
      member,
      points: totals.get(member.id) ?? 0,
      attendance: attendanceStats(state, member.id, since),
      tasksDone: tasksDoneBy(state.tasks, member.id, since),
    }));
  return rankByPoints(rows);
}
