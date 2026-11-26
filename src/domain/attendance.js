import { at, minutes } from './time.js';
import { replaceSource } from './ledger.js';
import { byId } from './util.js';

export const STATUSES = ['present', 'late', 'excused', 'absent'];
export const STATUS_LABELS = { present: 'Present', late: 'Late', excused: 'Excused', absent: 'Absent' };
const HOUR = 3_600_000;

export const recordId = (meetingId, memberId) => `${meetingId}~${memberId}`;
export const attendanceSource = (id) => `att:${id}`;

export const meetingStart = (meeting) => at(meeting.date, meeting.start);
export const meetingEnd = (meeting) => at(meeting.date, meeting.end);

export const isCheckInOpen = (meeting, time, earlyMinutes) =>
  !meeting.closed &&
  time >= meetingStart(meeting) - minutes(earlyMinutes) &&
  time <= meetingEnd(meeting);

export const currentMeeting = (meetings, time, earlyMinutes) =>
  meetings
    .filter((m) => isCheckInOpen(m, time, earlyMinutes))
    .sort((a, b) => meetingStart(b) - meetingStart(a))[0] ?? null;

export const nextMeeting = (meetings, time) =>
  meetings
    .filter((m) => !m.closed && meetingStart(m) > time)
    .sort((a, b) => meetingStart(a) - meetingStart(b))[0] ?? null;

export const statusForCheckIn = (meeting, time, graceMinutes) =>
  time <= meetingStart(meeting) + minutes(graceMinutes) ? 'present' : 'late';

export const findRecord = (attendance, meetingId, memberId) =>
  byId(attendance, recordId(meetingId, memberId));

export const hoursOf = (record) =>
  record.checkIn && record.checkOut ? Math.max(0, record.checkOut - record.checkIn) / HOUR : 0;

const openRecordFor = (state, memberId) =>
  state.attendance.find((r) => {
    if (r.memberId !== memberId || !r.checkIn || r.checkOut) return false;
    const meeting = byId(state.meetings, r.meetingId);
    return meeting && !meeting.closed;
  }) ?? null;

// What should happen when someone types their code at the kiosk?
export function decideScan(state, code, time) {
  const member = state.members.find((m) => m.active && m.code === code);
  if (!member) return { ok: false, reason: 'unknown-code' };

  const open = openRecordFor(state, member.id);
  if (open) {
    return { ok: true, kind: 'check-out', member, record: open, meeting: byId(state.meetings, open.meetingId) };
  }

  const meeting = currentMeeting(state.meetings, time, state.settings.checkInOpensMinutes);
  if (!meeting) return { ok: false, reason: 'no-meeting', member };

  const existing = findRecord(state.attendance, meeting.id, member.id);
  if (existing?.checkOut) return { ok: false, reason: 'already-out', member, meeting, record: existing };

  const status = statusForCheckIn(meeting, time, state.settings.lateGraceMinutes);
  return { ok: true, kind: 'check-in', member, meeting, status };
}

export function attendanceEntries(record, meeting, pointsTable) {
  const delta = pointsTable[record.status] ?? 0;
  if (!delta || !meeting) return [];
  const source = attendanceSource(record.id);
  return [{
    id: source,
    memberId: record.memberId,
    delta,
    kind: 'attendance',
    source,
    reason: `${STATUS_LABELS[record.status]} · ${meeting.title}`,
    at: meetingStart(meeting),
  }];
}

export function upsertRecord(state, record) {
  const meeting = byId(state.meetings, record.meetingId);
  return {
    ...state,
    attendance: [...state.attendance.filter((r) => r.id !== record.id), record],
    ledger: replaceSource(state.ledger, attendanceSource(record.id), attendanceEntries(record, meeting, state.settings.points)),
  };
}

export const removeRecord = (state, id) => ({
  ...state,
  attendance: state.attendance.filter((r) => r.id !== id),
  ledger: replaceSource(state.ledger, attendanceSource(id), []),
});

export const rescore = (state, predicate = () => true) =>
  state.attendance.filter(predicate).reduce(upsertRecord, state);

export function checkIn(state, { meetingId, memberId, at: time }) {
  const meeting = byId(state.meetings, meetingId);
  if (!meeting) return state;
  const existing = findRecord(state.attendance, meetingId, memberId);
  return upsertRecord(state, {
    ...existing,
    id: recordId(meetingId, memberId),
    meetingId,
    memberId,
    status: statusForCheckIn(meeting, time, state.settings.lateGraceMinutes),
    checkIn: time,
    checkOut: null,
    auto: false,
  });
}

export function checkOut(state, { meetingId, memberId, at: time }) {
  const record = findRecord(state.attendance, meetingId, memberId);
  return record?.checkIn ? upsertRecord(state, { ...record, checkOut: Math.max(time, record.checkIn) }) : state;
}

export function setStatus(state, { meetingId, memberId, status }) {
  const id = recordId(meetingId, memberId);
  if (!status) return removeRecord(state, id);
  const existing = byId(state.attendance, id);
  return upsertRecord(state, { checkIn: null, checkOut: null, ...existing, id, meetingId, memberId, status, auto: false });
}

const setClosed = (state, id, closed) => ({
  ...state,
  meetings: state.meetings.map((m) => (m.id === id ? { ...m, closed } : m)),
});

const eligibleMembers = (meeting, members) =>
  members.filter((m) => m.active && (m.createdAt ?? 0) <= meetingEnd(meeting));

// Closing a meeting checks out stragglers and marks no-shows absent.
// Both are flagged so reopening can undo exactly what closing did.
export function closeMeeting(state, meetingId, time) {
  const meeting = byId(state.meetings, meetingId);
  if (!meeting || meeting.closed) return state;
  const checkoutAt = Math.min(time ?? meetingEnd(meeting), meetingEnd(meeting));

  const stillHere = state.attendance.filter((r) => r.meetingId === meetingId && r.checkIn && !r.checkOut);
  const noShows = eligibleMembers(meeting, state.members).filter((m) => !findRecord(state.attendance, meetingId, m.id));

  const checkedOut = stillHere.reduce(
    (s, r) => upsertRecord(s, { ...r, checkOut: Math.max(checkoutAt, r.checkIn), autoCheckout: true }),
    state,
  );
  const withAbsences = noShows.reduce(
    (s, m) => upsertRecord(s, {
      id: recordId(meetingId, m.id), meetingId, memberId: m.id, status: 'absent', checkIn: null, checkOut: null, auto: true,
    }),
    checkedOut,
  );
  return setClosed(withAbsences, meetingId, true);
}

export function reopenMeeting(state, meetingId) {
  const undone = state.attendance
    .filter((r) => r.meetingId === meetingId)
    .reduce((s, r) => {
      if (r.auto) return removeRecord(s, r.id);
      if (r.autoCheckout) return upsertRecord(s, { ...r, checkOut: null, autoCheckout: false });
      return s;
    }, state);
  return setClosed(undone, meetingId, false);
}

export function updateMeeting(state, id, patch) {
  const next = { ...state, meetings: state.meetings.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
  return rescore(next, (r) => r.meetingId === id);
}

export function removeMeeting(state, id) {
  const cleared = state.attendance.filter((r) => r.meetingId === id).reduce((s, r) => removeRecord(s, r.id), state);
  return { ...cleared, meetings: cleared.meetings.filter((m) => m.id !== id) };
}

export function attendanceStats({ attendance, meetings }, memberId, since = 0) {
  const starts = new Map(meetings.map((m) => [m.id, meetingStart(m)]));
  const records = attendance.filter((r) => r.memberId === memberId && (starts.get(r.meetingId) ?? -1) >= since);
  const [present, late, excused, absent] = STATUSES.map((s) => records.filter((r) => r.status === s).length);
  const counted = present + late + absent;
  return {
    present,
    late,
    excused,
    absent,
    rate: counted ? (present + late) / counted : null,
    hours: records.reduce((h, r) => h + hoursOf(r), 0),
  };
}
