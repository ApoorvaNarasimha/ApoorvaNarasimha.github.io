// Isometric cubes: every object on the site is a list of cubes [x, y, z, colour] drawn as one SVG.
// x runs right, y up, z toward the viewer's left; only faces with nothing in front of them are drawn.
const PAL = {
  Y: '#ffd21f', B: '#2f7bff', R: '#ff4d4d', G: '#2ed573', W: '#ffffff', K: '#3a4663', N: '#9a6237', S: '#f0b78c', C: '#dbe8ff', D: '#1336a0',
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h, f) => `rgb(${hex(h).map((v) => Math.round(f > 1 ? v + (255 - v) * (f - 1) : v * f)).join(',')})`;

// a flat drawing, one letter per cube, stood upright and given depth
const upright = (rows, depth = 2) => {
  const out = [];
  rows.forEach((row, r) => [...row].forEach((ch, x) => { if (PAL[ch]) for (let z = 0; z < depth; z++) out.push([x, rows.length - 1 - r, z, ch]); }));
  return out;
};
const box = (x0, y0, z0, w, h, d, c) => {
  const out = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) out.push([x0 + x, y0 + y, z0 + z, c]);
  return out;
};

const MODELS = {
  // ---------------------------------------------------- small objects: nav, wipe, achievements
  grass: () => [...box(0, 0, 0, 3, 2, 3, 'N'), ...box(0, 2, 0, 3, 1, 3, 'G')],
  pickaxe: () => upright(['.CCCC..', 'CC..CC.', '...NC.C', '..N...C', '.N.....', 'N......'], 1),
  compass: () => upright(['.BBBBB.', 'BWWWRWB', 'BWWRRWB', 'BWWKWWB', 'BWYYWWB', 'BWYWWWB', '.BBBBB.'], 2),
  heart: () => upright(['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], 2),
  book: () => upright(['RRRRR', 'RWWWR', 'RRRRR', 'RRRRR', 'RRRRR', 'WWWWW'], 2),
  gem: () => upright(['.GGGG.', 'GGGGGG', '.GGGG.', '..GG..'], 2),
  bulb: () => upright(['.YYY.', 'YYYYY', 'YYYYY', '.YYY.', '.KKK.', '..K..'], 2),
  basket: () => [...box(0, 0, 0, 5, 2, 3, 'B'), [1, 2, 1, 'R'], [2, 2, 1, 'G'], [3, 2, 1, 'Y'], [0, 2, 0, 'B'], [4, 2, 0, 'B'], [2, 2, 0, 'R']],
  coil: () => upright(['YYYYY.', 'Y....Y', 'Y.YY.Y', 'Y.Y..Y', '.YYYY.'], 2),
  cube: () => { const c = 'YBRG', out = []; for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 3; z++) out.push([x * 1.5, y * 1.5, z * 1.5, c[(x + y * 2 + z * 3) % 4]]); return out; },
  // ---------------------------------------------------- scenes: one per illustrated project
  judges: () => { // agreement: a human bar beside a model bar, three times
    const out = box(-1, -1, -1, 10, 1, 5, 'K');
    [[4, 3], [2, 3], [5, 5]].forEach(([h, m], i) => out.push(...box(i * 3, 0, 0, 1, h, 2, 'G'), ...box(i * 3 + 1, 0, 0, 1, m, 2, 'R')));
    return out;
  },
  chords: () => [ // a hand with sensor rings, and two notes
    ...upright(['..S.S...', 'S.S.S.S.', 'S.S.S.S.', 'G.G.G.G.', 'S.S.S.S.', 'SSSSSSS.', 'SSSSSSSS', 'SSSSSSSS', '.SSSSS..', '.SSSSS..'], 2),
    ...upright(['YY', 'Y.', 'Y.', 'Y.'], 1).map(([x, y, z, c]) => [x + 10, y + 7, z, c]), [9, 7, 0, 'Y'],
    ...upright(['R', 'R', 'R'], 1).map(([x, y, z, c]) => [x + 13, y + 3, z, c]), [12, 3, 0, 'R'],
  ],
  lift: () => { // a bent strip with a printed sensor along it
    const out = [], h = [1, 2, 3, 4, 4, 4, 4, 3, 2, 1];
    h.forEach((y, x) => { for (let z = 0; z < 4; z++) { const c = z === 1 || z === 2 ? (x % 2 ? 'K' : 'G') : 'C'; out.push([x, y, z, c], [x, y - 1, z, 'C']); } }); // two thick, so each step meets the next
    return [...out, ...box(-1, 0, 0, 1, 1, 4, 'Y'), ...box(10, 0, 0, 1, 1, 4, 'Y')];
  },
  dashboard: () => [ // a small car and the camera watching it
    ...box(0, 1, 0, 9, 2, 4, 'R'), ...box(2, 3, 0, 5, 2, 4, 'B'), ...box(1, 0, 3, 2, 1, 1, 'K'), ...box(6, 0, 3, 2, 1, 1, 'K'), ...box(8, 0, 0, 1, 1, 2, 'K'),
    [8, 2, 3, 'Y'], [8, 2, 0, 'Y'], ...box(11, 5, 0, 2, 2, 2, 'W'), [11, 5, 2, 'G'],
  ],
  eyes: () => [ // an eye, and the fixations it leaves behind
    ...upright(['...WWWWW...', '.WWWBBBWWW.', 'WWWBBKBBWWW', 'WWWBKKKBWWW', 'WWWBBKBBWWW', '.WWWBBBWWW.', '...WWWWW...'], 2),
    [1, 8, 0, 'Y'], [4, 9, 0, 'Y'], [8, 8, 0, 'R'], [11, 9, 0, 'Y'], [13, 6, 0, 'R'],
  ],
  lunim: () => { // interviews sorted into themes
    const out = box(-1, -1, -1, 9, 1, 8, 'K'), c = 'YRGBYRGBY', h = [1, 2, 1, 3, 2, 1, 4, 2, 3];
    for (let i = 0; i < 9; i++) out.push(...box((i % 3) * 3, 0, Math.floor(i / 3) * 2.5, 2, h[i], 1, c[i]));
    return out;
  },
};

const NS = 'http://www.w3.org/2000/svg';
const COS = 0.866;
const P = (x, y, z) => [(x - z) * COS, (x + z) * 0.5 - y];

function draw(name) {
  const cubes = (MODELS[name] || MODELS.cube)();
  const has = new Set(cubes.map(([x, y, z]) => `${x},${y},${z}`));
  cubes.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  const parts = [];
  for (const [x, y, z, c] of cubes) {
    const face = (pts, f) => `<path d="M${pts.map((p) => { const [u, v] = P(...p); x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); return u.toFixed(2) + ' ' + v.toFixed(2); }).join('L')}Z" fill="${shade(PAL[c], f)}"/>`;
    let s = '';
    if (!has.has(`${x},${y},${z + 1}`)) s += face([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], 0.86);
    if (!has.has(`${x + 1},${y},${z}`)) s += face([[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]], 0.64);
    if (!has.has(`${x},${y + 1},${z}`)) s += face([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], 1.22);
    if (s) parts.push(`<g style="--w:${(((x + z) * 0.11) % 1).toFixed(2)}">${s}</g>`);
  }
  const m = 0.4;
  return { vb: `${(x0 - m).toFixed(2)} ${(y0 - m).toFixed(2)} ${(x1 - x0 + 2 * m).toFixed(2)} ${(y1 - y0 + 2 * m).toFixed(2)}`, body: parts.join('') };
}

const LINE = 'stroke="#10141c" stroke-width=".05" stroke-linejoin="round"';
/** An inline SVG whose cubes can be moved one by one. */
export function isoSVG(name) {
  const { vb, body } = draw(name);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', vb);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'iso');
  svg.innerHTML = body;
  for (const [k, v] of [['stroke', '#10141c'], ['stroke-width', '.05'], ['stroke-linejoin', 'round']]) svg.setAttribute(k, v);
  return svg;
}
const urls = new Map();
/** The same drawing as an image URL, for small icons. */
export function isoURL(name) {
  if (!urls.has(name)) { const { vb, body } = draw(name); urls.set(name, 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="${NS}" viewBox="${vb}" width="64" height="64" ${LINE}>${body}</svg>`)); }
  return urls.get(name);
}

/** Put the objects on the page: scenes in the project cards, icons, the hero cube. */
export function setupObjects() {
  document.querySelectorAll('[data-iso]').forEach((el) => {
    if (el.dataset.isoMode !== 'corner') el.replaceChildren();
    const svg = isoSVG(el.dataset.iso);
    if (el.dataset.isoMode === 'corner') svg.classList.add('iso--corner');
    el.append(svg);
  });
  document.querySelectorAll('[data-icon]').forEach((el) => el.style.setProperty('--icon', `url("${isoURL(el.dataset.icon)}")`));
}
