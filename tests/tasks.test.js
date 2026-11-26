import { test } from 'node:test';
import assert from 'node:assert/strict';
import { team, run, T } from './helpers.js';
import { memberTaskSummary, subsystemProgress } from '../src/domain/tasks.js';
import { totalsByMember } from '../src/domain/ledger.js';

const totals = (state) => Object.fromEntries(totalsByMember(state.ledger));
const save = (task, time) => ({ type: 'task/saved', at: time, task });

test('a done task pays every assignee; leaving done takes it back', () => {
  let s = run([save({ id: 't1', title: 'Chassis', subsystem: 'Drivetrain', points: 20, assigneeIds: ['a', 'b'], status: 'doing' }, T('10:00'))], team());
  assert.equal(s.ledger.length, 0);

  s = run([save({ id: 't1', status: 'done' }, T('11:00'))], s);
  assert.deepEqual(totals(s), { a: 20, b: 20 });
  assert.equal(s.tasks[0].completedAt, T('11:00'));

  s = run([save({ id: 't1', points: 25, assigneeIds: ['a'] }, T('12:00'))], s);
  assert.deepEqual(totals(s), { a: 25 });
  assert.equal(s.tasks[0].completedAt, T('11:00'), 'editing a done task keeps its completion time');

  s = run([save({ id: 't1', status: 'review' }, T('13:00'))], s);
  assert.equal(s.ledger.length, 0);
  assert.equal(s.tasks[0].completedAt, null);
});

test('a task created as done pays immediately', () => {
  const s = run([save({ id: 't1', title: 'Wire it', points: 5, assigneeIds: ['c'], status: 'done' }, T('09:00'))], team());
  assert.deepEqual(totals(s), { c: 5 });
});

test('deleting a task removes its points', () => {
  const s = run([
    save({ id: 't1', title: 'X', points: 10, assigneeIds: ['a'], status: 'done' }, T('09:00')),
    { type: 'task/removed', id: 't1' },
  ], team());
  assert.equal(s.tasks.length, 0);
  assert.equal(s.ledger.length, 0);
});

test('subsystem progress includes configured and ad-hoc subsystems', () => {
  const tasks = [
    { subsystem: 'Drivetrain', status: 'done' },
    { subsystem: 'Drivetrain', status: 'todo' },
    { subsystem: 'Shooter', status: 'done' },
  ];
  assert.deepEqual(subsystemProgress(tasks, ['Drivetrain', 'Intake']), [
    { name: 'Drivetrain', total: 2, done: 1, pct: 0.5 },
    { name: 'Intake', total: 0, done: 0, pct: 0 },
    { name: 'Shooter', total: 1, done: 1, pct: 1 },
  ]);
});

test('member task summary splits open and done work', () => {
  const tasks = [
    { id: 1, subsystem: 'CAD', status: 'done', points: 10, assigneeIds: ['a'] },
    { id: 2, subsystem: 'CAD', status: 'done', points: 5, assigneeIds: ['a', 'b'] },
    { id: 3, subsystem: 'Intake', status: 'doing', points: 5, assigneeIds: ['a'] },
    { id: 4, subsystem: 'Intake', status: 'done', points: 5, assigneeIds: ['b'] },
  ];
  const summary = memberTaskSummary(tasks, 'a');
  assert.deepEqual(summary.done.map((t) => t.id), [1, 2]);
  assert.deepEqual(summary.open.map((t) => t.id), [3]);
  assert.equal(summary.points, 15);
  assert.deepEqual(summary.bySubsystem, { CAD: 2 });
});
