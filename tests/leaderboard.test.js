import { test } from 'node:test';
import assert from 'node:assert/strict';
import { team, run, T } from './helpers.js';
import { leaderboard, periodStart, rankByPoints } from '../src/domain/leaderboard.js';

test('ties share a rank: 30, 20, 20, 10 -> 1, 2, 2, 4', () => {
  const row = (name, points) => ({ member: { name }, points });
  const ranked = rankByPoints([row('D', 10), row('C', 20), row('A', 30), row('B', 20)]);
  assert.deepEqual(ranked.map((r) => [r.member.name, r.rank]), [['A', 1], ['B', 2], ['C', 2], ['D', 4]]);
});

test('period and subteam filters; inactive members are hidden', () => {
  const s = run([
    { type: 'points/adjusted', at: T('09:00', '2026-01-05'), entries: [{ id: 'e1', memberId: 'a', delta: 50, reason: 'old' }] },
    { type: 'points/adjusted', at: T('09:00'), entries: [{ id: 'e2', memberId: 'b', delta: 5, reason: 'new' }] },
    { type: 'member/updated', id: 'c', patch: { active: false } },
  ], team());

  assert.deepEqual(leaderboard(s).map((r) => [r.member.id, r.points]), [['a', 50], ['b', 5]]);
  assert.deepEqual(leaderboard(s, { since: T('00:00') }).map((r) => [r.member.id, r.points]), [['b', 5], ['a', 0]]);
  assert.deepEqual(leaderboard(s, { subteam: 'Build' }).map((r) => r.member.id), ['a']);
});

test('weeks start on Monday', () => {
  assert.equal(periodStart('week', T('12:00', '2026-03-04')), T('00:00', '2026-03-02'));
  assert.equal(periodStart('week', T('12:00', '2026-03-08')), T('00:00', '2026-03-02'));
  assert.equal(periodStart('all', Date.now()), 0);
});
