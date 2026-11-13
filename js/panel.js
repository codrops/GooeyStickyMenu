// A panel of sliders for the effect's settings, to tune it by eye. Each control
// writes straight into SETTINGS (js/strands.js) or GLASS (js/goo.js), and the
// next frame is drawn with the new value.

import { SETTINGS } from './strands.js';
import { GLASS } from './goo.js';

// [label, the object that holds the value, its key or index, min, max, step];
// a colour is [label, the object, its key, 'colour']
const GROUPS = [
  [
    'liquid',
    [
      ['foot width', SETTINGS.foot, 0, 0, 1.2],
      ['foot width, stretched', SETTINGS.foot, 1, 0, 1.2],
      ['foot narrows over', SETTINGS, 'bell', 0.2, 2],
      ['foot on a corner', SETTINGS, 'corner', 0, 1],
      ['flare into the menu', GLASS, 'flare', 0.2, 3],
      ['neck thickness', SETTINGS.waist, 0, 0.05, 0.6],
      ['neck, stretched', SETTINGS.waist, 1, 0.02, 0.3],
      ['ends thicker by', SETTINGS, 'flare', 0, 0.3],
      ['stretch before snap', SETTINGS, 'length', 1, 14, 0.1],
      ['breaks from the top at', SETTINGS, 'breakAt', 0.05, 0.5],
      ['thinnest before it breaks', SETTINGS, 'neck', 0.01, 0.2],
      ['drop at a snapped tip', SETTINGS, 'bead', 0, 0.4],
      ['more threads per picture', SETTINGS, 'strings', 0, 2],
      ['corner rounding', GLASS.soften, 0, 0, 1.5],
      ['rounding from', GLASS.soften, 1, 0.5, 5, 0.1],
    ],
  ],
  [
    'motion',
    [
      ['picture pull', SETTINGS, 'pull', 0, 2],
      ['menu lean', SETTINGS, 'lean', 0, 0.6],
      ['menu wobble', SETTINGS, 'wobble', 0, 6, 0.1],
      ['grip time, s', SETTINGS, 'grip', 0, 1],
      ['snap-back stiffness', SETTINGS.tip, 0, 10, 800, 1],
      ['snap-back damping', SETTINGS.tip, 1, 1, 40, 0.5],
      ['mound levels in, s', SETTINGS, 'level', 0.05, 1.5],
      ['wobble stiffness', SETTINGS.squash, 0, 20, 500, 1],
      ['wobble damping', SETTINGS.squash, 1, 1, 40, 0.5],
      ['lean stiffness', SETTINGS.sway, 0, 20, 400, 1],
      ['lean damping', SETTINGS.sway, 1, 1, 40, 0.5],
    ],
  ],
  [
    'material',
    [
      ['colour', GLASS, 'tint', 'colour'],
      ['colour depth', GLASS, 'depth', 0, 3],
      ['milkiness', GLASS, 'veil', 0, 0.9],
      ['milk colour', GLASS, 'veilColor', 'colour'],
      ['frost at the rim', GLASS.frost, 0, 0, 1],
      ['frost in the middle', GLASS.frost, 1, 0, 1.5],
      ['lens bend', GLASS, 'bend', 0, 1.5],
      ['rim width', GLASS, 'rim', 0.2, 1.5],
      ['gloss', GLASS, 'gloss', 5, 120, 1],
      ['sheen', GLASS, 'sheen', 0, 1.5],
      ['bright edge', GLASS, 'bright', 0, 1.5],
      ['far rim shade', GLASS.dark, 0, 0, 0.6],
      ['outline', GLASS.dark, 1, 0, 0.3],
      ['shadow', GLASS, 'shadow', 0, 0.5],
      ['light in the shadow', GLASS, 'caustic', 0, 3],
      ['bubbles', GLASS, 'bubbles', 0, 1],
    ],
  ],
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

const toHex = (rgb) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

export function createPanel() {
  const panel = el('aside', 'panel');
  panel.setAttribute('aria-label', 'Settings');

  const toggle = el('button', 'panel__toggle', 'settings');
  toggle.type = 'button';
  const body = el('div', 'panel__body');
  body.id = 'panel-body';
  toggle.setAttribute('aria-controls', body.id);
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', open);
    body.hidden = !open;
  };
  toggle.addEventListener('click', () => setOpen(body.hidden));
  setOpen(false);

  const controls = [];
  for (const [title, rows] of GROUPS) {
    const group = el('fieldset', 'panel__group');
    group.append(el('legend', 'panel__title', title));
    for (const [label, target, key, min, max, step = 0.01] of rows) {
      const row = el('label', 'panel__row');
      const output = el('output', 'panel__value');
      let input;
      let control;
      if (min === 'colour') {
        // colours are written into their array in place, like every other value
        input = el('input', 'panel__colour');
        Object.assign(input, { type: 'color', value: toHex(target[key]) });
        const show = () => (output.textContent = input.value.slice(1));
        input.addEventListener('input', () => {
          fromHex(input.value).forEach((c, i) => (target[key][i] = c));
          show();
        });
        const initial = [...target[key]];
        control = {
          show,
          sync: () => (input.value = toHex(target[key])),
          reset: () => {
            initial.forEach((c, i) => (target[key][i] = c));
            input.value = toHex(initial);
          },
        };
      } else {
        input = el('input', 'panel__range');
        Object.assign(input, { type: 'range', min, max, step, value: target[key] });
        const show = () => (output.textContent = Number(target[key]).toFixed(step < 1 ? 2 : 0));
        input.addEventListener('input', () => {
          target[key] = Number(input.value);
          show();
        });
        const initial = target[key];
        control = {
          show,
          sync: () => (input.value = target[key]),
          reset: () => {
            target[key] = initial;
            input.value = initial;
          },
        };
      }
      control.show();
      row.append(el('span', 'panel__label', label), input, output);
      group.append(row);
      controls.push(control);
    }
    body.append(group);
  }

  const actions = el('div', 'panel__actions');
  const copy = el('button', 'panel__button', 'copy values');
  copy.type = 'button';
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(JSON.stringify({ strands: SETTINGS, glass: GLASS }, null, 2));
    copy.textContent = 'copied';
    setTimeout(() => (copy.textContent = 'copy values'), 1500);
  });
  const reset = el('button', 'panel__button', 'reset');
  reset.type = 'button';
  reset.addEventListener('click', () => {
    for (const c of controls) {
      c.reset();
      c.show();
    }
    panel.dispatchEvent(new Event('reset'));
  });
  actions.append(copy, reset);
  body.append(actions);

  // The controls follow values that something else has changed (a material that changes with the
  // scroll), while the panel is open
  panel.sync = () => {
    if (body.hidden) return;
    for (const c of controls) {
      c.sync();
      c.show();
    }
  };
  toggle.addEventListener('click', () => panel.sync());

  panel.append(toggle, body);
  document.body.append(panel);
  return panel;
}
