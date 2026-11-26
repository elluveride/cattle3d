import { html } from './html.js';

const TABS = [
  { key: 'kiosk', label: 'Check in', href: '#/' },
  { key: 'leaderboard', label: 'Leaderboard', href: '#/leaderboard' },
  { key: 'robot', label: 'Robot', href: '#/robot' },
  { key: 'admin', label: 'Admin', href: '#/admin' },
];

const SECTION_OF = { member: 'leaderboard' };

export function layout(ctx, content) {
  const top = ctx.route.parts[0] ?? 'kiosk';
  const section = SECTION_OF[top] ?? top;
  return html`
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#/"><span class="brand-mark" aria-hidden="true">⚙</span><span class="brand-name">${ctx.state.settings.teamName}</span></a>
        <nav class="tabs" aria-label="Main">
          ${TABS.map((t) => html`<a href="${t.href}" class="${t.key === section ? 'on' : ''}" aria-current="${t.key === section ? 'page' : 'false'}">${t.label}</a>`)}
        </nav>
        ${ctx.admin ? html`<button class="admin-pill" data-action="lock" title="Lock admin mode">🔓 Admin · Lock</button>` : ''}
      </div>
    </header>
    <main class="page page-${section}">${content}</main>`;
}
