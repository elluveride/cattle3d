import { html } from '../html.js';
import { empty } from '../components.js';

export default {
  title: () => 'Not found',
  render: () => empty('Page not found', "That link doesn't go anywhere.", html`<a class="btn" href="#/">Go to check-in</a>`),
};
