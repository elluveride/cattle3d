import { replaceSource } from './ledger.js';
import { byId, countBy } from './util.js';

export const TASK_STATUSES = ['todo', 'doing', 'review', 'done'];
export const TASK_STATUS_LABELS = { todo: 'To do', doing: 'In progress', review: 'Needs review', done: 'Done' };

export const taskSource = (id) => `task:${id}`;

export function taskEntries(task) {
  if (task.status !== 'done' || !task.points) return [];
  const source = taskSource(task.id);
  return task.assigneeIds.map((memberId) => ({
    id: `${source}:${memberId}`,
    memberId,
    delta: task.points,
    kind: 'task',
    source,
    reason: `Task · ${task.title}`,
    at: task.completedAt,
  }));
}

export function applyTaskPatch(prev, patch, time) {
  const next = { ...prev, ...patch };
  const becameDone = next.status === 'done' && prev.status !== 'done';
  const completedAt = next.status !== 'done' ? null : becameDone ? time : prev.completedAt;
  return { ...next, completedAt };
}

const blankTask = (id, time) => ({
  id, title: '', description: '', subsystem: '', points: 0, assigneeIds: [], status: 'todo', createdAt: time, completedAt: null,
});

export function saveTask(state, patch, time) {
  const prev = byId(state.tasks, patch.id);
  const task = applyTaskPatch(prev ?? blankTask(patch.id, time), patch, time);
  return {
    ...state,
    tasks: prev ? state.tasks.map((t) => (t.id === task.id ? task : t)) : [...state.tasks, task],
    ledger: replaceSource(state.ledger, taskSource(task.id), taskEntries(task)),
  };
}

export const removeTask = (state, id) => ({
  ...state,
  tasks: state.tasks.filter((t) => t.id !== id),
  ledger: replaceSource(state.ledger, taskSource(id), []),
});

export function subsystemProgress(tasks, subsystems) {
  const names = [...new Set([...subsystems, ...tasks.map((t) => t.subsystem).filter(Boolean)])];
  return names.map((name) => {
    const mine = tasks.filter((t) => t.subsystem === name);
    const done = mine.filter((t) => t.status === 'done').length;
    return { name, total: mine.length, done, pct: mine.length ? done / mine.length : 0 };
  });
}

export function memberTaskSummary(tasks, memberId) {
  const mine = tasks.filter((t) => t.assigneeIds.includes(memberId));
  const done = mine.filter((t) => t.status === 'done');
  return {
    open: mine.filter((t) => t.status !== 'done'),
    done,
    points: done.reduce((total, t) => total + t.points, 0),
    bySubsystem: countBy(done, 'subsystem'),
  };
}

export const tasksDoneBy = (tasks, memberId, since = 0) =>
  tasks.filter((t) => t.status === 'done' && t.assigneeIds.includes(memberId) && (t.completedAt ?? 0) >= since).length;
