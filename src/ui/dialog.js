const dialog = () => document.getElementById('dialog');
const content = () => document.getElementById('dialog-content');

export function openDialog(markup) {
  content().innerHTML = String(markup);
  if (!dialog().open) dialog().showModal();
  content().querySelector('[autofocus]')?.focus();
}

export function closeDialog() {
  if (dialog().open) dialog().close();
  content().innerHTML = '';
}

export const isDialogOpen = () => dialog().open;

export function wireDialog() {
  dialog().addEventListener('click', (event) => {
    if (event.target === dialog()) closeDialog();
  });
  dialog().addEventListener('close', () => {
    content().innerHTML = '';
  });
}
