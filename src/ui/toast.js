// Toasts follow the open <dialog> into the top layer so they stay visible.
export function toast(message, tone = 'ok') {
  const host = document.getElementById('toasts');
  const dialog = document.getElementById('dialog');
  const parent = dialog?.open ? dialog : document.body;
  if (host.parentElement !== parent) parent.append(host);

  const el = document.createElement('div');
  el.className = `toast toast-${tone}`;
  el.setAttribute('role', tone === 'err' ? 'alert' : 'status');
  el.textContent = message;
  host.append(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3200);
}
