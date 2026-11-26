import { test } from 'node:test';
import assert from 'node:assert/strict';
import { team, run, T, DAY } from './helpers.js';
import {
  attendanceStats, currentMeeting, decideScan, findRecord, statusForCheckIn,
} from '../src/domain/attendance.js';
import { totalsByMember } from '../src/domain/ledger.js';

const totals = (state) => Object.fromEntries(totalsByMember(state.ledger));
const checkIn = (memberId, time, meetingId = 'm1') => ({ type: 'attendance/checkedIn', meetingId, memberId, at: time });
const checkOut = (memberId, time, meetingId = 'm1') => ({ type: 'attendance/checkedOut', meetingId, memberId, at: time });
const setStatus = (memberId, status, meetingId = 'm1') => ({ type: 'attendance/statusSet', meetingId, memberId, status });

test('on time within the grace period, late after it', () => {
  const meeting = { date: DAY, start: '15:30', end: '18:00' };
  assert.equal(statusForCheckIn(meeting, T('15:40'), 10), 'present');
  assert.equal(statusForCheckIn(meeting, T('15:41'), 10), 'late');
});

test('check-in opens early and closes at the scheduled end', () => {
  const { meetings } = team();
  assert.equal(currentMeeting(meetings, T('14:59'), 30), null);
  assert.equal(currentMeeting(meetings, T('15:00'), 30)?.id, 'm1');
  assert.equal(currentMeeting(meetings, T('18:01'), 30), null);
});

test('scan flow: unknown code, check in, check out, already out', () => {
  let s = team();
  assert.equal(decideScan(s, '9999', T('15:35')).reason, 'unknown-code');

  const first = decideScan(s, '1111', T('15:35'));
  assert.deepEqual([first.ok, first.kind, first.status], [true, 'check-in', 'present']);

  s = run([checkIn('a', T('15:35'))], s);
  assert.equal(decideScan(s, '1111', T('17:00')).kind, 'check-out');

  s = run([checkOut('a', T('17:00'))], s);
  assert.equal(decideScan(s, '1111', T('17:05')).reason, 'already-out');
  assert.equal(findRecord(s.attendance, 'm1', 'a').checkOut, T('17:00'));
  assert.deepEqual(totals(s), { a: 10 });
});

test('no open meeting still identifies the member', () => {
  const d = decideScan(team(), '1111', T('09:00'));
  assert.equal(d.reason, 'no-meeting');
  assert.equal(d.member.id, 'a');
});

test('inactive members cannot check in', () => {
  const s = run([{ type: 'member/updated', id: 'a', patch: { active: false } }], team());
  assert.equal(decideScan(s, '1111', T('15:35')).reason, 'unknown-code');
});

test('check-out still works after the scheduled end, until the meeting is closed', () => {
  const s = run([checkIn('a', T('15:20'))], team());
  assert.equal(decideScan(s, '1111', T('18:30')).kind, 'check-out');
});

test('an excused mark is overridden if the member shows up', () => {
  let s = run([setStatus('a', 'excused')], team());
  assert.equal(decideScan(s, '1111', T('15:45')).kind, 'check-in');
  s = run([checkIn('a', T('15:45'))], s);
  assert.equal(findRecord(s.attendance, 'm1', 'a').status, 'late');
});

test('closing marks no-shows absent and checks out stragglers; reopening undoes both', () => {
  let s = run([
    checkIn('a', T('15:30')),
    checkIn('b', T('15:50')),
    checkOut('b', T('17:00')),
    { type: 'meeting/closed', id: 'm1', at: T('19:00') },
  ], team());

  assert.equal(findRecord(s.attendance, 'm1', 'c').status, 'absent');
  assert.equal(findRecord(s.attendance, 'm1', 'a').checkOut, T('18:00'));
  assert.deepEqual(totals(s), { a: 10, b: 5, c: -5 });
  assert.equal(decideScan(s, '1111', T('19:05')).reason, 'no-meeting');

  s = run([{ type: 'meeting/reopened', id: 'm1' }], s);
  assert.equal(findRecord(s.attendance, 'm1', 'c'), null);
  assert.equal(findRecord(s.attendance, 'm1', 'a').checkOut, null);
  assert.equal(findRecord(s.attendance, 'm1', 'b').checkOut, T('17:00'));
  assert.deepEqual(totals(s), { a: 10, b: 5 });
});

test('closing early checks people out at the close time', () => {
  const s = run([checkIn('a', T('15:30')), { type: 'meeting/closed', id: 'm1', at: T('17:15') }], team());
  assert.equal(findRecord(s.attendance, 'm1', 'a').checkOut, T('17:15'));
});

test('members who joined after a meeting are not marked absent for it', () => {
  const s = run([
    { type: 'members/added', at: T('20:00'), members: [{ id: 'new', name: 'New Kid', code: '4444' }] },
    { type: 'meeting/closed', id: 'm1', at: T('21:00') },
  ], team());
  assert.equal(findRecord(s.attendance, 'm1', 'new'), null);
  assert.equal(findRecord(s.attendance, 'm1', 'a').status, 'absent');
});

test('changing a status replaces its points instead of stacking them', () => {
  let s = run([setStatus('a', 'absent'), setStatus('a', 'late')], team());
  assert.deepEqual(s.ledger.map((e) => e.delta), [5]);
  s = run([setStatus('a', 'excused')], s);
  assert.equal(s.ledger.length, 0);
  s = run([setStatus('a', null)], s);
  assert.equal(s.attendance.length, 0);
});

test('attendance rate ignores excused meetings', () => {
  const s = run([
    {
      type: 'meetings/scheduled',
      meetings: [
        { id: 'm2', title: 'B', date: '2026-03-04', start: '15:30', end: '18:00' },
        { id: 'm3', title: 'C', date: '2026-03-06', start: '15:30', end: '18:00' },
      ],
    },
    checkIn('a', T('15:30')),
    checkOut('a', T('17:30')),
    setStatus('a', 'excused', 'm2'),
    setStatus('a', 'absent', 'm3'),
  ], team());
  const stats = attendanceStats(s, 'a');
  assert.equal(stats.rate, 0.5);
  assert.equal(stats.excused, 1);
  assert.equal(stats.hours, 2);
  assert.equal(attendanceStats(s, 'a', T('00:00', '2026-03-04')).rate, 0);
});

test('re-scoring applies new point values to past meetings', () => {
  let s = run([setStatus('a', 'present')], team());
  s = run([{ type: 'settings/updated', patch: { points: { ...s.settings.points, present: 15 } } }], s);
  assert.deepEqual(totals(s), { a: 10 });
  s = run([{ type: 'attendance/rescored' }], s);
  assert.deepEqual(totals(s), { a: 15 });
});

test('deleting a meeting removes its records and points', () => {
  const s = run([setStatus('a', 'present'), { type: 'meeting/removed', id: 'm1' }], team());
  assert.equal(s.meetings.length, 0);
  assert.equal(s.attendance.length, 0);
  assert.equal(s.ledger.length, 0);
});
