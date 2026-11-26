import { html } from '../../html.js';
import { adminShell } from './shell.js';
import { byName } from '../../../domain/util.js';

export default {
  title: () => 'Check-in codes',
  render(ctx) {
    const members = ctx.state.members.filter((m) => m.active).sort(byName);
    return adminShell(ctx, html`
      <a class="back no-print" href="#/admin/members">← Members</a>
      <div class="page-head no-print">
        <div><h1>Check-in codes</h1><p class="muted">Print and cut these out, or read them off to the team.</p></div>
        <button class="btn btn-primary" data-action="print">Print</button>
      </div>
      <div class="code-cards">
        ${members.map((m) => html`
          <div class="code-card">
            <span class="code-team">${ctx.state.settings.teamName}</span>
            <b>${m.name}</b>
            <span class="code-num">${m.code}</span>
          </div>`)}
      </div>`);
  },
};
