import * as attendance from './attendance.js';
import { saveTask, removeTask } from './tasks.js';
import { removeMember } from './members.js';
import { normalize } from './state.js';
import { pick } from './util.js';

const MEMBER_FIELDS = ['name', 'subteam', 'code', 'active'];
const MEETING_FIELDS = ['title', 'date', 'start', 'end'];

// Every change to the app is one of these events. The reducer is pure:
// ids and timestamps arrive on the action, so replaying actions replays state.
const handlers = {
  'members/added': (s, a) => ({
    ...s,
    members: [
      ...s.members,
      ...a.members.map((m) => ({ subteam: '', ...pick(m, ['id', ...MEMBER_FIELDS]), active: true, createdAt: a.at })),
    ],
  }),
  'member/updated': (s, a) => ({
    ...s,
    members: s.members.map((m) => (m.id === a.id ? { ...m, ...pick(a.patch, MEMBER_FIELDS) } : m)),
  }),
  'member/removed': (s, a) => removeMember(s, a.id),

  'meetings/scheduled': (s, a) => ({
    ...s,
    meetings: [...s.meetings, ...a.meetings.map((m) => ({ ...pick(m, ['id', ...MEETING_FIELDS]), closed: false }))],
  }),
  'meeting/updated': (s, a) => attendance.updateMeeting(s, a.id, pick(a.patch, MEETING_FIELDS)),
  'meeting/removed': (s, a) => attendance.removeMeeting(s, a.id),
  'meeting/closed': (s, a) => attendance.closeMeeting(s, a.id, a.at),
  'meeting/reopened': (s, a) => attendance.reopenMeeting(s, a.id),

  'attendance/checkedIn': (s, a) => attendance.checkIn(s, a),
  'attendance/checkedOut': (s, a) => attendance.checkOut(s, a),
  'attendance/statusSet': (s, a) => attendance.setStatus(s, a),
  'attendance/rescored': (s) => attendance.rescore(s),

  'task/saved': (s, a) => saveTask(s, a.task, a.at),
  'task/removed': (s, a) => removeTask(s, a.id),

  'points/adjusted': (s, a) => ({
    ...s,
    ledger: [
      ...s.ledger,
      ...a.entries.map((e) => ({
        id: e.id, memberId: e.memberId, delta: e.delta, reason: e.reason, kind: 'behavior', source: null, at: a.at,
      })),
    ],
  }),
  'points/entryRemoved': (s, a) => ({ ...s, ledger: s.ledger.filter((e) => e.id !== a.id || e.source) }),

  'settings/updated': (s, a) => ({ ...s, settings: { ...s.settings, ...a.patch } }),
  'state/replaced': (_s, a) => normalize(a.state),
};

export const reducer = (state, action) => handlers[action.type]?.(state, action) ?? state;
