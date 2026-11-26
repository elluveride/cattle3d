import { html } from '../../html.js';

const SECTIONS = [
  ['members', 'Members'],
  ['meetings', 'Meetings'],
  ['points', 'Points'],
  ['settings', 'Settings'],
];
const ALIASES = { meeting: 'meetings', codes: 'members' };
const WEEK = 7 * 86_400_000;

function backupBanner({ state, now }) {
  const { lastBackupAt } = state.settings;
  const stale = state.members.length > 0 && (!lastBackupAt || now - lastBackupAt > WEEK);
  if (!stale) return '';
  return html`
    <div class="banner">
      <span>💾 ${lastBackupAt ? 'Your last backup is over a week old.' : 'No backup yet.'} Data lives only in this browser.</span>
      <button class="btn btn-sm" data-action="exportData">Export backup</button>
    </div>`;
}

export function adminShell(ctx, content) {
  const sub = ctx.route.parts[1] ?? 'members';
  const active = ALIASES[sub] ?? sub;
  return html`
    <nav class="subnav" aria-label="Admin">
      ${SECTIONS.map(([key, label]) => html`<a href="#/admin/${key}" class="${key === active ? 'on' : ''}">${label}</a>`)}
      <a href="#/robot">Tasks →</a>
    </nav>
    ${backupBanner(ctx)}
    ${content}`;
}
