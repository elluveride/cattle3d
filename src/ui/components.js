import { html } from './html.js';
import { fmtPoints, hueOf, initials } from './format.js';
import { STATUS_LABELS } from '../domain/attendance.js';
import { TASK_STATUS_LABELS } from '../domain/tasks.js';

export const avatar = (name, size = '') =>
  html`<span class="avatar ${size}" style="--h:${hueOf(name)}" aria-hidden="true">${initials(name)}</span>`;

export const statusPill = (status) => html`<span class="pill status-${status}">${STATUS_LABELS[status] ?? status}</span>`;

export const taskPill = (status) => html`<span class="pill task-${status}">${TASK_STATUS_LABELS[status] ?? status}</span>`;

export const delta = (n) => html`<span class="delta ${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}">${fmtPoints(n)}</span>`;

export const progress = (ratio, label) => {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return html`<div class="progress" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
};

export const tile = (label, value, hint = '') =>
  html`<div class="tile"><span class="tile-label">${label}</span><span class="tile-value">${value}</span>${hint ? html`<span class="tile-hint">${hint}</span>` : ''}</div>`;

export const empty = (title, body, action = '') =>
  html`<div class="empty"><h3>${title}</h3><p>${body}</p>${action}</div>`;
