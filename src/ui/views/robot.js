import { html } from '../html.js';
import { subsystemProgress, TASK_STATUS_LABELS, TASK_STATUSES } from '../../domain/tasks.js';
import { byId, byName, countBy } from '../../domain/util.js';
import { firstName, fmtPoints } from '../format.js';
import { avatar, empty, progress } from '../components.js';
import { adminOnlyAll } from '../guard.js';
import { newId } from '../ids.js';

const statusOptions = (current) =>
  TASK_STATUSES.map((s) => html`<option value="${s}" ${s === current ? 'selected' : ''}>${TASK_STATUS_LABELS[s]}</option>`);

function taskCard(task, members, admin) {
  const people = task.assigneeIds.map((id) => members.get(id)).filter(Boolean);
  return html`
    <article class="task">
      <div class="task-top"><span class="tag">${task.subsystem || 'General'}</span><span class="task-pts">${task.points} pts</span></div>
      <h4>${task.title}</h4>
      ${task.description ? html`<p class="task-desc">${task.description}</p>` : ''}
      <div class="people">
        ${people.length
          ? people.map((m) => html`<span class="person" title="${m.name}">${avatar(m.name, 'xs')}${firstName(m.name)}</span>`)
          : html`<span class="muted">Unassigned</span>`}
      </div>
      ${admin
        ? html`<div class="task-admin">
            <select data-change="moveTask" data-id="${task.id}" aria-label="Move ${task.title}">${statusOptions(task.status)}</select>
            <button class="btn btn-sm" data-action="editTask" data-id="${task.id}">Edit</button>
          </div>`
        : ''}
    </article>`;
}

function taskDialog(state, task, defaultSubsystem) {
  const t = task ?? { title: '', description: '', subsystem: defaultSubsystem || state.settings.subsystems[0] || '', points: 10, assigneeIds: [], status: 'todo' };
  const subsystems = [...new Set([...state.settings.subsystems, t.subsystem].filter(Boolean))];
  const people = state.members.filter((m) => m.active || t.assigneeIds.includes(m.id)).sort(byName);
  return html`
    <form data-form="saveTask" class="dialog-form">
      <h2>${task ? 'Edit task' : 'New task'}</h2>
      <input type="hidden" name="id" value="${task?.id ?? ''}">
      <label>Title<input name="title" required maxlength="100" value="${t.title}" autofocus></label>
      <div class="grid-3">
        <label>Subsystem<select name="subsystem">${subsystems.map((s) => html`<option ${s === t.subsystem ? 'selected' : ''}>${s}</option>`)}</select></label>
        <label>Points<input type="number" name="points" min="0" step="1" value="${t.points}"></label>
        <label>Status<select name="status">${statusOptions(t.status)}</select></label>
      </div>
      <label><span>Details <small>optional</small></span><textarea name="description" rows="2" maxlength="400">${t.description}</textarea></label>
      <fieldset>
        <legend>Assigned to <small class="muted">each person gets the full points when it's done</small></legend>
        <div class="check-grid">
          ${people.map((m) => html`<label class="check"><input type="checkbox" name="assignees" value="${m.id}" ${t.assigneeIds.includes(m.id) ? 'checked' : ''}><span>${m.name}</span></label>`)}
        </div>
      </fieldset>
      <div class="dialog-actions">
        ${task ? html`<button type="button" class="btn btn-danger-ghost" data-action="deleteTask" data-id="${task.id}">Delete</button>` : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-action="closeDialog">Cancel</button>
        <button class="btn btn-primary">${task ? 'Save' : 'Add task'}</button>
      </div>
    </form>`;
}

function commitTask(api, patch) {
  const before = byId(api.state.tasks, patch.id);
  api.dispatch({ type: 'task/saved', task: patch });
  const after = byId(api.state.tasks, patch.id);
  const finished = after.status === 'done' && before?.status !== 'done';
  if (finished && after.points && after.assigneeIds.length) {
    const names = after.assigneeIds.map((id) => byId(api.state.members, id)?.name).filter(Boolean).map(firstName);
    api.toast(`${fmtPoints(after.points)} pts to ${names.join(', ')} 🎉`);
  }
}

const sortColumn = (status) => (a, b) =>
  status === 'done' ? (b.completedAt ?? 0) - (a.completedAt ?? 0) : (a.createdAt ?? 0) - (b.createdAt ?? 0);

function overall(tasks) {
  const done = tasks.filter((t) => t.status === 'done').length;
  const counts = countBy(tasks, 'status');
  return html`
    <section class="card overall">
      <div class="overall-num">${Math.round((done / tasks.length) * 100)}<small>%</small></div>
      <div class="grow">
        ${progress(done / tasks.length, 'Overall robot progress')}
        <div class="legend">${TASK_STATUSES.map((s) => html`<span><i class="swatch task-${s}"></i>${TASK_STATUS_LABELS[s]} <b>${counts[s] ?? 0}</b></span>`)}</div>
      </div>
    </section>`;
}

export default {
  title: () => 'Robot',
  render(ctx) {
    const { state, route, admin } = ctx;
    const sub = route.params.sub ?? '';
    const members = new Map(state.members.map((m) => [m.id, m]));
    const visible = state.tasks.filter((t) => !sub || t.subsystem === sub);
    const done = state.tasks.filter((t) => t.status === 'done').length;
    const newButton = admin ? html`<button class="btn btn-primary" data-action="newTask">New task</button>` : '';

    if (!state.tasks.length) {
      return html`
        <div class="page-head"><h1>Robot progress</h1>${newButton}</div>
        ${empty('No tasks yet', admin ? 'Break the robot into tasks and assign them. Assignees earn the points when a task is marked done.' : 'An admin can add tasks for each subsystem of the robot.', admin ? html`<button class="btn btn-primary" data-action="newTask">Create the first task</button>` : '')}`;
    }

    return html`
      <div class="page-head"><div><h1>Robot progress</h1><p class="muted">${done} of ${state.tasks.length} tasks done</p></div>${newButton}</div>
      ${overall(state.tasks)}
      <section class="subsystems">
        ${subsystemProgress(state.tasks, state.settings.subsystems).map((p) => html`
          <a class="card subsystem ${sub === p.name ? 'on' : ''} ${p.total ? '' : 'idle'}" href="${sub === p.name ? '#/robot' : `#/robot?sub=${encodeURIComponent(p.name)}`}">
            <div class="subsystem-head"><b>${p.name}</b><span>${p.done}/${p.total}</span></div>
            ${progress(p.pct, `${p.name} progress`)}
          </a>`)}
      </section>
      <div class="board-head"><h2>${sub ? `${sub} tasks` : 'Task board'}</h2>${sub ? html`<a class="chip" href="#/robot">Show all ✕</a>` : ''}</div>
      <section class="kanban">
        ${TASK_STATUSES.map((status) => {
          const column = visible.filter((t) => t.status === status).sort(sortColumn(status));
          return html`
            <div class="column col-${status}">
              <h3>${TASK_STATUS_LABELS[status]} <span class="count">${column.length}</span></h3>
              ${column.length ? column.map((t) => taskCard(t, members, admin)) : html`<p class="column-empty">Nothing here</p>`}
            </div>`;
        })}
      </section>`;
  },
  actions: adminOnlyAll({
    newTask: ({ api, ctx }) => api.openDialog(taskDialog(api.state, null, ctx.route.params.sub)),
    editTask: ({ el, api }) => api.openDialog(taskDialog(api.state, byId(api.state.tasks, el.dataset.id))),
    deleteTask: ({ el, api }) => {
      if (!confirm('Delete this task? Any points it awarded will be removed.')) return;
      api.dispatch({ type: 'task/removed', id: el.dataset.id });
      api.closeDialog();
      api.toast('Task deleted');
    },
  }),
  forms: adminOnlyAll({
    saveTask: ({ form, api }) => {
      const title = String(form.get('title')).trim();
      if (!title) return api.toast('Give the task a title', 'err');
      commitTask(api, {
        id: String(form.get('id')) || newId(),
        title,
        description: String(form.get('description')).trim(),
        subsystem: String(form.get('subsystem')),
        points: Math.max(0, Math.round(Number(form.get('points')) || 0)),
        status: String(form.get('status')),
        assigneeIds: form.getAll('assignees').map(String),
      });
      api.closeDialog();
    },
  }),
  changes: adminOnlyAll({
    moveTask: ({ el, api }) => commitTask(api, { id: el.dataset.id, status: el.value }),
  }),
};
