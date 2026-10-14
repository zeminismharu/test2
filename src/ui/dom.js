export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function button(label, onClick, variant = 'primary') {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn btn-${variant}`;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}
