import { html } from '../html.js';

export const welcome = () => html`
  <section class="welcome">
    <div class="card welcome-card">
      <div class="welcome-mark" aria-hidden="true">⚙</div>
      <h1>Your team tracker</h1>
      <p class="lead">Attendance, robot tasks and points in one place, with a leaderboard to keep it competitive.</p>
      <ol class="steps">
        <li><b>Create an admin PIN.</b> Mentors and captains use it to manage everything.</li>
        <li><b>Add your members.</b> Each person gets a 4-digit check-in code.</li>
        <li><b>Schedule meetings and add tasks.</b> Members check in on this screen; points add up automatically.</li>
      </ol>
      <div class="row wrap">
        <a class="btn btn-primary" href="#/admin">Set up my team</a>
        <button class="btn" data-action="loadDemo">Try it with demo data</button>
      </div>
    </div>
  </section>`;
