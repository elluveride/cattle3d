import { html } from '../html.js';
import { currentMeeting, decideScan, nextMeeting } from '../../domain/attendance.js';
import { CODE_LENGTH } from '../../domain/codes.js';
import { firstName, fmtDateKey, fmtHHMM, fmtHours, fmtPoints, fmtTime } from '../format.js';
import { avatar } from '../components.js';
import { welcome } from './welcome.js';

const MESSAGE_MS = 5000;
let buffer = '';
let message = null;
let lastMinute = -1;

const dots = () =>
  html`${Array.from({ length: CODE_LENGTH }, (_, i) => html`<span class="dot ${i < buffer.length ? 'filled' : ''}"></span>`)}`;

const paintDots = () => {
  const el = document.querySelector('[data-code-display]');
  if (el) el.innerHTML = String(dots());
};

function messageFor(decision, settings, now) {
  const name = decision.member ? firstName(decision.member.name) : '';
  if (decision.ok && decision.kind === 'check-in') {
    const onTime = decision.status === 'present';
    const pts = settings.points[decision.status] ?? 0;
    return {
      tone: onTime ? 'ok' : 'warn',
      title: `Welcome, ${name}!`,
      detail: `Checked in ${fmtTime(now)} · ${onTime ? 'On time' : 'Late'}${pts ? ` · ${fmtPoints(pts)} pts` : ''}`,
    };
  }
  if (decision.ok) {
    return { tone: 'ok', title: `See you, ${name}!`, detail: `Checked out ${fmtTime(now)} · ${fmtHours((now - decision.record.checkIn) / 3_600_000)} today` };
  }
  if (decision.reason === 'already-out') {
    return { tone: 'warn', title: `You already checked out, ${name}`, detail: `At ${fmtTime(decision.record.checkOut)}. Ask a mentor if that's wrong.` };
  }
  if (decision.reason === 'no-meeting') {
    return { tone: 'warn', title: `Hi ${name}, no meeting is open`, detail: `Check-in opens ${settings.checkInOpensMinutes} minutes before a scheduled meeting.` };
  }
  return { tone: 'err', title: 'Code not recognized', detail: 'Try again, or ask a mentor for your code.' };
}

function submit(api) {
  const now = Date.now();
  const decision = decideScan(api.state, buffer, now);
  buffer = '';
  message = { ...messageFor(decision, api.state.settings, now), until: now + MESSAGE_MS };
  if (!decision.ok) return api.render();
  api.dispatch({
    type: decision.kind === 'check-in' ? 'attendance/checkedIn' : 'attendance/checkedOut',
    meetingId: decision.meeting.id,
    memberId: decision.member.id,
    at: now,
  });
}

function press(digit, api) {
  if (buffer.length >= CODE_LENGTH) return;
  buffer += digit;
  paintDots();
  if (buffer.length === CODE_LENGTH) setTimeout(() => submit(api), 120);
}

const backspace = () => {
  buffer = buffer.slice(0, -1);
  paintDots();
};

const clear = () => {
  buffer = '';
  paintDots();
};

function meetingLine(meeting, upcoming) {
  if (meeting) return html`<span class="live-dot"></span><b>${meeting.title}</b> · ${fmtHHMM(meeting.start)}–${fmtHHMM(meeting.end)}`;
  if (upcoming) return html`No meeting open · Next: <b>${fmtDateKey(upcoming.date)}, ${fmtHHMM(upcoming.start)}</b>`;
  return 'No meetings scheduled';
}

function whoIsHere(state, meeting) {
  if (!meeting) return '';
  const members = new Map(state.members.map((m) => [m.id, m]));
  const visits = state.attendance
    .filter((r) => r.meetingId === meeting.id && r.checkIn && members.has(r.memberId))
    .sort((a, b) => a.checkIn - b.checkIn);
  const inShop = visits.filter((r) => !r.checkOut).length;
  return html`
    <aside class="card kiosk-here">
      <h2>In the shop <span class="count">${inShop}</span></h2>
      ${visits.length
        ? html`<ul class="here-list">${visits.map((r) => {
          const m = members.get(r.memberId);
          return html`<li class="${r.checkOut ? 'left' : ''}">${avatar(m.name, 'sm')}<span class="here-name">${m.name}</span><small>${r.checkOut ? `left ${fmtTime(r.checkOut)}` : fmtTime(r.checkIn)}</small></li>`;
        })}</ul>`
        : html`<p class="muted">Nobody yet. Be the first!</p>`}
    </aside>`;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export default {
  kiosk: true,
  title: () => 'Check in',
  render(ctx) {
    const { state, now } = ctx;
    if (!state.members.length) return welcome();
    if (message && message.until < now) message = null;
    const meeting = currentMeeting(state.meetings, now, state.settings.checkInOpensMinutes);
    const upcoming = meeting ? null : nextMeeting(state.meetings, now);
    return html`
      <section class="kiosk ${meeting ? 'has-meeting' : ''}">
        <div class="card kiosk-panel">
          <div class="clock" data-clock>${fmtTime(now)}</div>
          <div class="kiosk-meeting">${meetingLine(meeting, upcoming)}</div>
          ${message
            ? html`<button class="scan-result tone-${message.tone}" role="status" data-action="dismiss"><strong>${message.title}</strong><span>${message.detail}</span></button>`
            : html`<p class="kiosk-hint">Type your ${CODE_LENGTH}-digit code to check in or out</p>`}
          <div class="code-display" data-code-display aria-label="Code entry">${dots()}</div>
          <div class="keypad">
            ${KEYS.map((d) => html`<button class="key" data-action="digit" data-digit="${d}">${d}</button>`)}
            <button class="key key-muted" data-action="clear">Clear</button>
            <button class="key" data-action="digit" data-digit="0">0</button>
            <button class="key key-muted" data-action="back" aria-label="Delete last digit">⌫</button>
          </div>
        </div>
        ${whoIsHere(state, meeting)}
      </section>`;
  },
  actions: {
    digit: ({ el, api }) => press(el.dataset.digit, api),
    clear: () => clear(),
    back: () => backspace(),
    dismiss: ({ api }) => {
      message = null;
      api.render();
    },
  },
  keydown(event, api) {
    if (/^\d$/.test(event.key)) press(event.key, api);
    else if (event.key === 'Backspace') backspace();
    else if (event.key === 'Escape') clear();
  },
  tick(api) {
    const now = Date.now();
    const clock = document.querySelector('[data-clock]');
    if (clock) clock.textContent = fmtTime(now);
    const minute = Math.floor(now / 60_000);
    if ((message && message.until < now) || minute !== lastMinute) {
      lastMinute = minute;
      api.render();
    }
  },
};
