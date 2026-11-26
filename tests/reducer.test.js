import { test } from 'node:test';
import assert from 'node:assert/strict';
import { team, run, T } from './helpers.js';
import { reducer } from '../src/domain/reducer.js';
import { normalize, looksLikeBackup } from '../src/domain/state.js';
import { buildDemoState } from '../src/domain/demo.js';
import { currentMeeting, findRecord } from '../src/domain/attendance.js';
import { leaderboard } from '../src/domain/leaderboard.js';

test('removing a member cascades to attendance, points and task assignments', () => {
  const s = run([
    { type: 'attendance/statusSet', meetingId: 'm1', memberId: 'a', status: 'present' },
    { type: 'task/saved', at: T('09:00'), task: { id: 't1', title: 'X', points: 10, assigneeIds: ['a', 'b'], status: 'done' } },
    { type: 'member/removed', id: 'a' },
  ], team());
  assert.equal(s.members.some((m) => m.id === 'a'), false);
  assert.equal(s.attendance.length, 0);
  assert.deepEqual(s.ledger.map((e) => e.memberId), ['b']);
  assert.deepEqual(s.tasks[0].assigneeIds, ['b']);
});

test('only manual entries can be removed directly', () => {
  let s = run([
    { type: 'attendance/statusSet', meetingId: 'm1', memberId: 'a', status: 'present' },
    { type: 'points/adjusted', at: T('09:00'), entries: [{ id: 'p1', memberId: 'a', delta: -3, reason: 'Tools out' }] },
  ], team());
  const auto = s.ledger.find((e) => e.kind === 'attendance');
  s = run([{ type: 'points/entryRemoved', id: auto.id }, { type: 'points/entryRemoved', id: 'p1' }], s);
  assert.deepEqual(s.ledger.map((e) => e.kind), ['attendance']);
});

test('unknown actions leave state untouched', () => {
  const s = team();
  assert.equal(reducer(s, { type: 'nope' }), s);
});

test('normalize fills defaults and survives junk', () => {
  assert.deepEqual(normalize(null).members, []);
  assert.deepEqual(normalize('garbage').ledger, []);
  const n = normalize({ settings: { points: { late: 2 } }, members: [{ id: 'x' }], tasks: 'bad' });
  assert.equal(n.settings.points.late, 2);
  assert.equal(n.settings.points.present, 10);
  assert.equal(n.settings.lateGraceMinutes, 10);
  assert.deepEqual(n.tasks, []);
  assert.equal(looksLikeBackup(n), true);
  assert.equal(looksLikeBackup({ hello: 1 }), false);
});

test('demo data has a live meeting, closed history and a populated board', () => {
  const now = T('16:30', '2026-03-04');
  const s = buildDemoState(now);
  assert.equal(s.members.length, 10);
  assert.ok(currentMeeting(s.meetings, now, 30), 'a meeting is open right now');

  const closed = s.meetings.filter((m) => m.closed);
  assert.ok(closed.length >= 8);
  for (const meeting of closed) {
    for (const member of s.members) assert.ok(findRecord(s.attendance, meeting.id, member.id), 'everyone has a record');
  }

  const board = leaderboard(s);
  assert.ok(board[0].points > 0);
  assert.ok(s.tasks.some((t) => t.status === 'done'));
});

test('demo data works just after midnight', () => {
  const now = T('00:10', '2026-03-04');
  const s = buildDemoState(now);
  assert.ok(currentMeeting(s.meetings, now, 30));
});
