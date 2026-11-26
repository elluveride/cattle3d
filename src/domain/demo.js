import { reducer } from './reducer.js';
import { emptyState } from './state.js';
import { addDaysToKey, at, days, minutes, toDateKey, toTimeKey, weekdayOf } from './time.js';

const PEOPLE = [
  ['Ava Ramirez', 'Programming'],
  ['Ben Tran', 'Build'],
  ['Chloe Martin', 'CAD'],
  ['Diego Santos', 'Build'],
  ['Emma Walsh', 'Outreach'],
  ['Finn Kowalski', 'Programming'],
  ['Grace Liu', 'CAD'],
  ['Hiro Nakamura', 'Build'],
  ['Isla Patel', 'Programming'],
  ['Jonah Brooks', 'Build'],
];

// [title, subsystem, points, status, assignee indexes, description]
const TASKS = [
  ['Assemble drivetrain chassis', 'Drivetrain', 20, 'done', [1, 3], 'Square the frame and mount bearings.'],
  ['Mount drive motors & gearboxes', 'Drivetrain', 15, 'done', [3, 7]],
  ['Tune drivetrain PID', 'Programming', 15, 'review', [0, 5]],
  ['Field-centric driving', 'Programming', 20, 'done', [0]],
  ['Auto: leave the starting zone', 'Programming', 10, 'done', [5, 8]],
  ['Auto: score the preload', 'Programming', 25, 'doing', [8, 0], 'Use the odometry pods once they are mounted.'],
  ['CAD intake v2', 'CAD', 15, 'done', [2, 6]],
  ['Build intake prototype', 'Intake', 15, 'doing', [1, 9]],
  ['Intake roller compression test', 'Intake', 10, 'todo', []],
  ['Design arm pivot', 'CAD', 20, 'review', [6]],
  ['Build arm / lift', 'Arm / Lift', 25, 'todo', [7, 9]],
  ['Wire main controller & battery', 'Electronics', 15, 'done', [3]],
  ['Cable management pass', 'Electronics', 5, 'todo', []],
  ['Update team website', 'Outreach', 10, 'done', [4]],
  ['Plan elementary school demo', 'Outreach', 15, 'doing', [4, 2]],
];

// [member index, reason, points]
const BEHAVIOR = [
  [1, 'Helped a teammate', 5],
  [4, 'Outreach / volunteering', 10],
  [7, 'Safety glasses not worn', -10],
  [2, 'Cleaned up the shop', 3],
  [9, 'Left tools out', -3],
  [5, 'Helped a teammate', 5],
  [4, 'Outreach / volunteering', 10],
  [3, 'Off task / on phone', -2],
];

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MWF = [1, 3, 5];

function pastMeetingActions(today, members, rand) {
  const dates = Array.from({ length: 21 }, (_, i) => addDaysToKey(today, i - 21)).filter((d) => MWF.includes(weekdayOf(d)));
  return dates.flatMap((date, i) => {
    const id = `demo-meet-${i}`;
    const start = at(date, '15:30');
    const end = at(date, '18:00');
    const visits = members.flatMap((m) => {
      const roll = rand();
      if (roll < 0.1) return [];
      if (roll < 0.17) return [{ type: 'attendance/statusSet', meetingId: id, memberId: m.id, status: 'excused' }];
      const arrive = start + minutes(roll < 0.3 ? 12 + rand() * 30 : -10 + rand() * 18);
      const leave = end - minutes(rand() * 45);
      return [
        { type: 'attendance/checkedIn', meetingId: id, memberId: m.id, at: arrive },
        { type: 'attendance/checkedOut', meetingId: id, memberId: m.id, at: leave },
      ];
    });
    return [
      { type: 'meetings/scheduled', meetings: [{ id, title: 'Build meeting', date, start: '15:30', end: '18:00' }] },
      ...visits,
      { type: 'meeting/closed', id, at: end },
    ];
  });
}

function liveMeetingActions(now, members) {
  const date = toDateKey(now);
  const startMs = now - minutes(40);
  const start = toDateKey(startMs) === date ? toTimeKey(startMs - (startMs % minutes(5))) : '00:00';
  const end = toTimeKey(Math.min(now + minutes(150), at(date, '23:59')));
  const id = 'demo-meet-live';
  const arrivals = members.slice(0, 6).map((m, i) => ({
    type: 'attendance/checkedIn', meetingId: id, memberId: m.id, at: Math.min(now, at(date, start) + minutes(i * 4 - 6)),
  }));
  return [{ type: 'meetings/scheduled', meetings: [{ id, title: 'Build meeting', date, start, end }] }, ...arrivals];
}

function upcomingMeetingActions(today) {
  const meetings = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i + 1))
    .filter((d) => MWF.includes(weekdayOf(d)))
    .map((date, i) => ({ id: `demo-next-${i}`, title: 'Build meeting', date, start: '15:30', end: '18:00' }));
  return [{ type: 'meetings/scheduled', meetings }];
}

function taskActions(now, members, rand) {
  return TASKS.flatMap(([title, subsystem, points, status, who, description = ''], i) => {
    const id = `demo-task-${i}`;
    const created = now - days(24 - i);
    const finished = created + rand() * (now - created - days(0.5));
    const assigneeIds = who.map((n) => members[n].id);
    const create = { type: 'task/saved', at: created, task: { id, title, subsystem, points, description, assigneeIds, status: 'todo' } };
    const move = { type: 'task/saved', at: status === 'done' ? finished : created, task: { id, status } };
    return status === 'todo' ? [create] : [create, move];
  });
}

const behaviorActions = (now, members, rand) =>
  BEHAVIOR.map(([n, reason, delta], i) => ({
    type: 'points/adjusted',
    at: now - days(rand() * 20),
    entries: [{ id: `demo-behavior-${i}`, memberId: members[n].id, delta, reason }],
  }));

export function buildDemoState(now, seed = 2026) {
  const rand = mulberry32(seed);
  const members = PEOPLE.map(([name, subteam], i) => ({ id: `demo-m${i + 1}`, name, subteam, code: String(1001 + i) }));
  const today = toDateKey(now);
  return [
    { type: 'settings/updated', patch: { teamName: 'Demo Robotics' } },
    { type: 'members/added', at: now - days(35), members },
    ...pastMeetingActions(today, members, rand),
    ...liveMeetingActions(now, members),
    ...upcomingMeetingActions(today),
    ...taskActions(now, members, rand),
    ...behaviorActions(now, members, rand),
  ].reduce(reducer, emptyState());
}
