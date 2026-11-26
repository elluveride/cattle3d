import { createStore } from './store.js';
import { reducer } from './domain/reducer.js';
import { emptyState, normalize } from './domain/state.js';
import { buildDemoState } from './domain/demo.js';
import { toDateKey } from './domain/time.js';
import * as auth from './ui/auth.js';
import { html } from './ui/html.js';
import { isKioskRoute, parseHash, resolveView } from './ui/router.js';
import { layout } from './ui/layout.js';
import { toast } from './ui/toast.js';
import { closeDialog, isDialogOpen, openDialog, wireDialog } from './ui/dialog.js';

const store = createStore({ key: 'robotics-tracker/v1', reducer, init: emptyState, normalize });
const root = document.getElementById('app');
let view = null;
let ctx = null;
let warnedAboutSaving = false;

const api = {
  get state() {
    return store.get();
  },
  dispatch(action) {
    const saved = store.dispatch({ at: Date.now(), ...action });
    if (!saved && !warnedAboutSaving) {
      warnedAboutSaving = true;
      toast("This browser isn't saving data. Export a backup before closing the tab.", 'err');
    }
  },
  replaceState(next) {
    const admin = store.get().settings.admin;
    api.dispatch({ type: 'state/replaced', state: { ...next, settings: { ...next.settings, admin } } });
  },
  navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
  render: () => render(),
  toast,
  openDialog,
  closeDialog,
  auth,
};

function downloadBackup() {
  const blob = new Blob([JSON.stringify(store.get(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: `team-tracker-backup-${toDateKey(Date.now())}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const shared = {
  actions: {
    closeDialog: () => closeDialog(),
    print: () => window.print(),
    lock: () => {
      auth.lock();
      closeDialog();
      toast('Admin locked');
      render();
    },
    exportData: () => {
      if (!auth.isUnlocked()) return toast('Unlock admin first', 'err');
      downloadBackup();
      api.dispatch({ type: 'settings/updated', patch: { lastBackupAt: Date.now() } });
      toast('Backup downloaded');
    },
    loadDemo: () => {
      const hasData = store.get().members.length > 0;
      if (hasData && !auth.isUnlocked()) return toast('Unlock admin first', 'err');
      if (hasData && !confirm('Replace ALL current data with demo data? Export a backup first if you need it.')) return;
      api.replaceState(buildDemoState(Date.now()));
      toast('Demo loaded. Try check-in code 1001.');
      api.navigate('#/leaderboard');
    },
  },
};

function render({ focus = false } = {}) {
  const route = parseHash(location.hash);
  if (isKioskRoute(route) && auth.isUnlocked()) {
    auth.lock();
    toast('Admin locked: this is the check-in screen');
  }
  ctx = { state: store.get(), route, admin: auth.isUnlocked(), now: Date.now() };
  view = resolveView(route, ctx.admin);

  let content;
  try {
    content = view.render(ctx);
  } catch (error) {
    console.error(error);
    content = html`<div class="empty"><h3>Something went wrong</h3><p>${error.message}</p></div>`;
  }
  root.innerHTML = String(layout(ctx, content));
  document.title = [view.title?.(ctx), store.get().settings.teamName].filter(Boolean).join(' · ');
  if (focus) root.querySelector('[autofocus]')?.focus();
}

// One delegated listener per event type; views declare handlers by name.
const DELEGATES = { click: ['action', 'actions'], submit: ['form', 'forms'], change: ['change', 'changes'] };

function delegate(event) {
  const [attr, group] = DELEGATES[event.type];
  const el = event.target.closest?.(`[data-${attr}]`);
  if (!el) return;
  const name = el.dataset[attr];
  const handler = view?.[group]?.[name] ?? shared[group]?.[name];
  if (!handler) return;
  if (event.type === 'submit') event.preventDefault();
  handler({
    el,
    event,
    api,
    ctx: { ...ctx, state: store.get(), now: Date.now() },
    form: event.type === 'submit' ? new FormData(el) : null,
  });
}

Object.keys(DELEGATES).forEach((type) => document.addEventListener(type, delegate));

document.addEventListener('keydown', (event) => {
  auth.touch();
  if (isDialogOpen() || event.target.closest?.('input, textarea, select')) return;
  view?.keydown?.(event, api);
});
document.addEventListener('pointerdown', () => auth.touch());

// Don't wipe a half-typed form when another tab saves; render once focus leaves.
let pendingRender = false;
const isEditing = () => document.activeElement?.matches?.('input, textarea, select') && root.contains(document.activeElement);

store.subscribe((_state, meta) => {
  if (meta.external && isEditing()) {
    pendingRender = true;
    return;
  }
  render();
});

root.addEventListener('focusout', () => setTimeout(() => {
  if (pendingRender && !isEditing()) {
    pendingRender = false;
    render();
  }
}));

window.addEventListener('hashchange', () => {
  closeDialog();
  render({ focus: true });
  window.scrollTo(0, 0);
});

setInterval(() => {
  if (ctx && ctx.admin !== auth.isUnlocked()) render();
  view?.tick?.(api);
}, 1000);

navigator.storage?.persist?.().catch(() => {});
wireDialog();
render({ focus: true });
