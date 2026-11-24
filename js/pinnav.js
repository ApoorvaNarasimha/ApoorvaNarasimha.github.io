// Side nav: a strip of pins on the left edge that rises to spell the current section, like a
// shape display. Hovering or focusing an item previews its name; a change ripples through the
// pins as they reshape into the new word. The links underneath are ordinary anchors.
import { itemIcon, SECTION_ITEM } from './voxel-items.js';

// 3 x 5 letters, enough for the section names
const G = {
  A: ['###', '#.#', '###', '#.#', '#.#'], C: ['###', '#..', '#..', '#..', '###'], E: ['###', '#..', '###', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'], P: ['###', '#.#', '###', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['###', '#..', '###', '..#', '###'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  "'": ['.#.', '.#.', '...', '...', '...'], ' ': ['...', '...', '...', '...', '...'],
};

// The word is set left to right in a 5-row bitmap, then turned 90° so it reads bottom to top.
function bitmap(word, rows) {
  const glyphs = [...word.toUpperCase()].map((ch) => G[ch] || G[' ']);
  const cols = [];
  glyphs.forEach((g, k) => {
    for (let c = 0; c < 3; c++) cols.push(g.map((row) => row[c] === '#'));
    if (k < glyphs.length - 1) cols.push([false, false, false, false, false]);
  });
  const pad = Math.floor((rows - cols.length) / 2), on = [];
  for (let r = 0; r < rows; r++) { const col = cols[rows - 1 - r - pad]; for (let c = 0; c < 5; c++) on.push(col ? col[c] : false); }
  return on;
}

export function createPinNav(nav) {
  const strip = nav.querySelector('.pinnav-strip');
  const links = [...nav.querySelectorAll('[data-map]')];
  const names = links.map((a) => a.textContent.trim());
  const rows = Math.max(...names.map((n) => n.length * 4 - 1));
  strip.style.setProperty('--rows', rows);
  strip.innerHTML = '<span class="pin"></span>'.repeat(rows * 5);
  const pins = [...strip.children];
  links.forEach((a) => a.prepend(itemIcon(SECTION_ITEM[a.dataset.map], 20)));

  let cur = -1;
  const show = (i, { wave = true, preview = false } = {}) => {
    const on = bitmap(names[i], rows);
    pins.forEach((p, k) => {
      p.style.setProperty('--d', wave ? (rows - Math.floor(k / 5)) * 8 + 'ms' : '0ms');
      p.classList.toggle('up', on[k]);
    });
    nav.classList.toggle('is-preview', preview);
  };
  links.forEach((a, i) => {
    const enter = () => { if (i !== cur) show(i, { preview: true }); };
    const leave = () => { if (cur >= 0 && !links.some((l) => l.matches(':hover, :focus-visible'))) show(cur); };
    a.addEventListener('mouseenter', enter); a.addEventListener('focus', enter);
    a.addEventListener('mouseleave', leave); a.addEventListener('blur', leave);
  });

  return {
    links,
    select(id, { instant = false } = {}) {
      const i = links.findIndex((a) => a.dataset.map === id);
      if (i < 0 || i === cur) return;
      cur = i;
      links.forEach((a, j) => (j === i ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      show(i, { wave: !instant });
    },
    iconFor: (id) => links.find((a) => a.dataset.map === id)?.querySelector('.vx-icon'),
  };
}
