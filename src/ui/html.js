// Tagged template that escapes every interpolated value unless it is
// already safe markup produced by another html`` call.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

class SafeHtml {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const fragment = (value) => {
  if (value == null || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(fragment).join('');
  if (value instanceof SafeHtml) return value.value;
  return escapeHtml(value);
};

export const html = (strings, ...values) =>
  new SafeHtml(strings.reduce((out, str, i) => out + fragment(values[i - 1]) + str));
