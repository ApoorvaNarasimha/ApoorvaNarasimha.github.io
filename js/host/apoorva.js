// Apoorva, the voxel host.
// A procedurally built character: every part is a stack of boxes, shaded by a patched
// MeshStandardMaterial that draws soft voxel seams and per-voxel colour jitter. The face is a
// 24 x 20 pixel-art texture redrawn only when it changes, so expressions stay crisp and cheap.
// Poses are spring-driven: states describe target joint angles, springs supply the follow-through.
import * as THREE from 'three';

export const VOXEL = 0.5;
const FPX = 0.375; // one face pixel, in model units (9 units / 24 px)

export const COLORS = {
  skin: 0xf7dcc6, skinShade: 0xe7c2a8, // light neutral: neither pink nor orange
  hair: 0x1b1621, hairSheen: 0x3d3352, hairTip: 0x272030,
  shirt: 0xf6f7fb, shirtShade: 0xdde2ee, collar: 0xffffff, button: 0xe6dfd2,
  jeans: 0x33508c, jeansDark: 0x253b6a, jeansLight: 0x5878b6,
  belt: 0x6b4331, gold: 0xe7b54d,
  shoe: 0xfaf6ef, sole: 0xe4d8c4, clip: 0xff7a2e, clipDark: 0xd8571a,
  pencil: 0xffcf3f, eraser: 0xf49ab3, ink: 0x1b1730,
};

const FACE = {
  skin: '#f7dcc6', shade: '#e6c0a5', lash: '#1d1622', brow: '#2b1f26',
  white: '#fffaf4', irisDark: '#4b2a1a', iris: '#8a5534', irisLight: '#b97d4c', pupil: '#22130b', hl: '#ffffff',
  lip: '#b8485e', dark: '#5a1b2a', tongue: '#ec7f88', teeth: '#ffffff', blush: '#f0857f',
};

// World-space rest positions of every joint, shared by the 3D rig and the flat sprite.
const RIG = {
  hips: [null, [0, 12, 0]],
  legL: ['hips', [1.5, 0, 0]], kneeL: ['legL', [0, -5.5, 0]],
  legR: ['hips', [-1.5, 0, 0]], kneeR: ['legR', [0, -5.5, 0]],
  spine: ['hips', [0, 1, 0]],
  armL: ['spine', [3.75, 6.5, 0]], elbowL: ['armL', [0, -4, 0]],
  armR: ['spine', [-3.75, 6.5, 0]], elbowR: ['armR', [0, -4, 0]],
  head: ['spine', [0, 8.5, 0]],
  hairBack: ['head', [0, 1.5, -4.0]],
  lockL: ['head', [4.6, 4.2, 2.6]], lockR: ['head', [-4.75, 4.2, 2.4]],
  handL: ['elbowL', [0, -3.4, 0.5]], handR: ['elbowR', [0, -3.4, 0.5]],
};

// ---------------------------------------------------------------- geometry

class VoxelBuilder {
  constructor() { this.boxes = []; this.quads = []; }
  box(x0, y0, z0, x1, y1, z1, color) {
    this.boxes.push([Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), color]);
    return this;
  }
  quad(x0, y0, x1, y1, z) { this.quads.push([x0, y0, x1, y1, z]); return this; }

  geometry(expand = 0) {
    const P = [], N = [], C = [], B = [], U = [], I = [];
    const col = new THREE.Color();
    const push = (corners, nrm, color, min) => {
      const base = P.length / 3;
      col.set(color);
      corners.forEach((v, k) => {
        P.push(v[0], v[1], v[2]); N.push(nrm[0], nrm[1], nrm[2]);
        C.push(col.r, col.g, col.b); B.push(min[0], min[1], min[2]);
        U.push(k === 1 || k === 2 ? 1 : 0, k >= 2 ? 1 : 0);
      });
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (const b of this.boxes) {
      const e = expand;
      const [x0, y0, z0, x1, y1, z1] = [b[0] - e, b[1] - e, b[2] - e, b[3] + e, b[4] + e, b[5] + e];
      const min = [b[0], b[1], b[2]], c = b[6];
      push([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], c, min);
      push([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], c, min);
      push([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], c, min);
      push([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], c, min);
      push([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], c, min);
      push([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], c, min);
    }
    if (!expand) for (const [x0, y0, x1, y1, z] of this.quads) {
      push([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], 0xffffff, [x0, y0, z]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('boxMin', new THREE.Float32BufferAttribute(B, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    g.computeBoundingSphere();
    return g;
  }
}

// MeshStandardMaterial + voxel seams + per-voxel jitter + a white "flash" used when she inflates.
export function voxelMaterial({ roughness = 0.72, metalness = 0, map = null, seam = 0.05, jitter = 0.06, voxel = VOXEL, alphaTest = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, map, alphaTest });
  const uniforms = { uVoxel: { value: voxel }, uSeam: { value: seam }, uJitter: { value: jitter }, uFlash: { value: 0 } };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 boxMin;\nvarying vec3 vVoxPos;\nvarying vec3 vVoxNrm;\nvarying vec3 vBoxMin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvVoxPos = position; vVoxNrm = normal; vBoxMin = boxMin;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uVoxel; uniform float uSeam; uniform float uJitter; uniform float uFlash;
varying vec3 vVoxPos; varying vec3 vVoxNrm; varying vec3 vBoxMin;
float vhash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 an = abs(vVoxNrm);
  vec3 q = (vVoxPos - vBoxMin) / uVoxel - vVoxNrm * 0.5;
  vec3 cell = floor(q + 1e-3);
  diffuseColor.rgb *= 1.0 + (vhash(cell + vBoxMin * 7.31) - 0.5) * uJitter;
  vec3 f = fract(q + 1e-3);
  vec3 e = min(f, 1.0 - f);
  float m = min(an.x > 0.5 ? 1.0 : e.x, min(an.y > 0.5 ? 1.0 : e.y, an.z > 0.5 ? 1.0 : e.z));
  diffuseColor.rgb *= mix(1.0 - uSeam, 1.0, smoothstep(0.0, 0.16, m));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uFlash);
}`);
  };
  m.customProgramCacheKey = () => 'voxel' + (map ? '-map' : '');
  return m;
}

// ---------------------------------------------------------------- face

// 24 x 20 grid. Eyes 5 wide on rows 9-12, brows on row 7, mouth from (10, 15).
const EYE_L = 4, EYE_R = 15, EYE_Y = 9, BROW_Y = 7, MOUTH_X = 10, MOUTH_Y = 15;
const BROWS = { // per-column row offsets, outer -> inner (4 columns)
  neutral: [1, 0, 0, 0], raised: [0, -1, -1, -1], arch: [0, -1, -1, 0], worried: [1, 1, 0, -1],
  angry: [-1, 0, 0, 1], soft: [1, 0, 0, 0], low: [1, 1, 1, 1], one: [0, -1, -1, -1],
};
const MOUTHS = { // [dx, dy, colour] relative to (MOUTH_X, MOUTH_Y)
  smile: [[0, 0, 'lip'], [3, 0, 'lip'], [1, 1, 'lip'], [2, 1, 'lip']],
  grin: [[0, 0, 'dark'], [1, 0, 'teeth'], [2, 0, 'teeth'], [3, 0, 'dark'], [1, 1, 'tongue'], [2, 1, 'tongue']],
  laugh: [[-1, 0, 'dark'], [0, 0, 'teeth'], [1, 0, 'teeth'], [2, 0, 'teeth'], [3, 0, 'teeth'], [4, 0, 'dark'], [0, 1, 'dark'], [1, 1, 'tongue'], [2, 1, 'tongue'], [3, 1, 'dark'], [1, 2, 'dark'], [2, 2, 'dark']],
  o: [[1, 0, 'dark'], [2, 0, 'dark'], [1, 1, 'dark'], [2, 1, 'dark']],
  O: [[1, -1, 'dark'], [2, -1, 'dark'], [0, 0, 'dark'], [1, 0, 'dark'], [2, 0, 'dark'], [3, 0, 'dark'], [0, 1, 'dark'], [1, 1, 'tongue'], [2, 1, 'tongue'], [3, 1, 'dark'], [1, 2, 'dark'], [2, 2, 'dark']],
  flat: [[1, 1, 'lip'], [2, 1, 'lip'], [3, 1, 'lip']],
  smirk: [[3, 0, 'lip'], [0, 1, 'lip'], [1, 1, 'lip'], [2, 1, 'lip']],
  hmm: [[1, 1, 'lip'], [2, 1, 'lip']],
  wobbly: [[0, 1, 'lip'], [1, 0, 'lip'], [2, 1, 'lip'], [3, 0, 'lip']],
  tongue: [[0, 0, 'lip'], [3, 0, 'lip'], [1, 1, 'lip'], [2, 1, 'lip'], [2, 2, 'tongue']],
  talkA: [[0, 0, 'dark'], [1, 0, 'dark'], [2, 0, 'dark'], [3, 0, 'dark'], [1, 1, 'tongue'], [2, 1, 'dark']],
  talkB: [[1, 0, 'dark'], [2, 0, 'dark'], [1, 1, 'dark'], [2, 1, 'dark']],
};

export const EXPRESSIONS = {
  neutral: { eyes: 'open', brows: 'neutral', mouth: 'smile', blush: 0.4 },
  happy: { eyes: 'open', brows: 'soft', mouth: 'grin', blush: 0.55 },
  joy: { eyes: 'happy', brows: 'soft', mouth: 'grin', blush: 0.7 },
  laugh: { eyes: 'happy', brows: 'soft', mouth: 'laugh', blush: 0.85 },
  surprised: { eyes: 'wide', brows: 'raised', mouth: 'O', blush: 0.45 },
  curious: { eyes: 'open', brows: 'one', mouth: 'smirk', blush: 0.4 },
  thinking: { eyes: 'open', brows: 'one', mouth: 'hmm', blush: 0.35, gazeY: -1, gazeX: 1 },
  wink: { eyes: 'wink', brows: 'soft', mouth: 'tongue', blush: 0.6 },
  sleepy: { eyes: 'half', brows: 'low', mouth: 'flat', blush: 0.3 },
  asleep: { eyes: 'closed', brows: 'low', mouth: 'o', blush: 0.35 },
  determined: { eyes: 'open', brows: 'angry', mouth: 'smirk', blush: 0.3 },
  sheepish: { eyes: 'happy', brows: 'worried', mouth: 'wobbly', blush: 0.95 },
  impressed: { eyes: 'wide', brows: 'raised', mouth: 'smile', blush: 0.55 },
  worried: { eyes: 'open', brows: 'worried', mouth: 'wobbly', blush: 0.4 },
};

class Face {
  constructor() {
    this.w = 24; this.h = 20;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.state = { ...EXPRESSIONS.neutral, gazeX: 0, gazeY: 0, blink: false, talk: null };
    this.key = '';
    this.draw();
  }
  set(partial) { Object.assign(this.state, partial); this.draw(); }
  px(x, y, c, a = 1) { const g = this.ctx; g.globalAlpha = a; g.fillStyle = c; g.fillRect(x, y, 1, 1); g.globalAlpha = 1; }

  draw() {
    const s = this.state;
    const eyes = s.blink && !['happy', 'closed', 'wink'].includes(s.eyes) ? 'closed' : s.eyes;
    const mouth = s.talk || s.mouth;
    const key = [eyes, s.brows, mouth, s.blush.toFixed(2), s.gazeX, s.gazeY].join('|');
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    g.clearRect(0, 0, this.w, this.h);
    g.fillStyle = FACE.skin; g.fillRect(0, 0, this.w, this.h);
    // the jaw steps in by one pixel on the bottom three rows
    g.clearRect(0, 17, 1, 3); g.clearRect(23, 17, 1, 3);
    // soft shadow under the curtain fringe
    for (const [x0, x1, y] of [[0, 3, 11], [4, 7, 5], [8, 10, 2], [11, 12, 1], [13, 15, 2], [16, 19, 5], [20, 23, 11]]) {
      for (let x = x0; x <= x1; x++) this.px(x, y, FACE.shade, 0.5);
    }
    this.px(12, 14, FACE.shade, 0.75); // nose
    for (const [x, y] of [[3, 13], [4, 13], [5, 13], [4, 14], [18, 13], [19, 13], [20, 13], [19, 14]]) this.px(x, y, FACE.blush, s.blush * (y === 14 ? 0.6 : 1));
    this.drawBrow(EYE_L + 1, -1, s.brows);
    this.drawBrow(EYE_R, 1, s.brows);
    const left = eyes === 'wink' ? 'happy' : eyes;
    const right = eyes === 'wink' ? 'open' : eyes;
    this.drawEye(EYE_L, -1, left, s.gazeX, s.gazeY);
    this.drawEye(EYE_R, 1, right, s.gazeX, s.gazeY);
    for (const [dx, dy, k] of MOUTHS[mouth] || MOUTHS.smile) this.px(MOUTH_X + dx, MOUTH_Y + dy, FACE[k]);
    this.texture.needsUpdate = true;
  }

  drawBrow(ox, side, shape) {
    const offs = BROWS[shape] || BROWS.neutral;
    for (let i = 0; i < 4; i++) {
      const col = side < 0 ? ox + i : ox + 3 - i; // index 0 is the outer end
      this.px(col, BROW_Y + offs[i], FACE.brow);
    }
  }

  drawEye(ox, side, kind, gx, gy) {
    const oy = EYE_Y;
    const outer = side < 0 ? ox - 1 : ox + 5;
    const lash = (x, y) => this.px(x, y, FACE.lash);
    if (kind === 'closed') {
      for (let i = 0; i < 5; i++) lash(ox + i, oy + 2);
      lash(outer, oy + 1);
      return;
    }
    if (kind === 'happy') {
      lash(ox + 1, oy + 1); lash(ox + 2, oy + 1); lash(ox + 3, oy + 1);
      lash(ox, oy + 2); lash(ox + 4, oy + 2);
      return;
    }
    if (kind === 'half') {
      for (let i = 0; i < 5; i++) lash(ox + i, oy + 1);
      lash(outer, oy + 1);
      for (let i = 0; i < 5; i++) this.px(ox + i, oy + 2, FACE.white);
      const ix = ox + 1 + Math.max(-1, Math.min(1, gx));
      this.px(ix, oy + 2, FACE.irisDark); this.px(ix + 1, oy + 2, FACE.pupil); this.px(ix + 2, oy + 2, FACE.irisDark);
      return;
    }
    const wide = kind === 'wide';
    // lash line with a small outer wing
    for (let i = 0; i < 5; i++) lash(ox + i, oy);
    lash(outer, oy); lash(outer, oy - 1);
    // white of the eye
    const mask = [[1, 1, 1, 1, 1], [1, 1, 1, 1, 1], [0, 1, 1, 1, 0]];
    if (wide) mask[2] = [1, 1, 1, 1, 1];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) if (mask[r][c]) this.px(ox + c, oy + 1 + r, FACE.white);
    // iris block, 3 wide, moved by the gaze
    const ixc = 1 + Math.max(-1, Math.min(1, gx));
    const shift = gy < 0 ? -1 : 0;
    const iris = wide
      ? [[FACE.irisDark, FACE.pupil, FACE.hl], [FACE.iris, FACE.irisDark, FACE.iris]]
      : [[FACE.irisDark, FACE.pupil, FACE.hl], [FACE.irisDark, FACE.pupil, FACE.irisDark], [FACE.irisLight, FACE.iris, FACE.iris]];
    iris.forEach((row, r) => row.forEach((colr, c) => {
      const my = r + 1 + shift + (wide ? 0 : 0) - 1; // row inside the 3-row eye
      const mx = ixc + c;
      if (my >= 0 && my < 3 && mx >= 0 && mx < 5 && mask[my][mx]) this.px(ox + mx, oy + 1 + my, colr);
    }));
    if (wide) { lash(ox + 1, oy + 4); lash(ox + 2, oy + 4); lash(ox + 3, oy + 4); }
  }
}

// ---------------------------------------------------------------- the model

function buildModel() {
  const C = COLORS;
  const parts = {};
  const part = (name) => (parts[name] = parts[name] || { matte: new VoxelBuilder(), gloss: new VoxelBuilder(), metal: new VoxelBuilder() });

  // Legs: thigh hangs from the hip joint, shin + shoe from the knee.
  for (const side of [1, -1]) {
    const L = side > 0;
    const thigh = part(L ? 'legL' : 'legR').matte;
    thigh.box(-1.25, -5.75, -1.25, 1.25, 0.5, 1.25, C.jeans);
    thigh.box(L ? 1.25 : -1.25, -5.5, -0.25, L ? 1.3 : -1.3, 0, 0.25, C.jeansDark); // outer seam
    const shin = part(L ? 'kneeL' : 'kneeR');
    shin.matte.box(-1.0, -4.5, -1.0, 1.0, 0.25, 1.0, C.jeans);
    shin.matte.box(-1.25, -4.5, -1.25, 1.25, -3.75, 1.25, C.jeansLight); // rolled hem
    shin.gloss.box(-1.25, -6.5, -1.5, 1.25, -5.0, 2.5, C.shoe);
    shin.gloss.box(-1.0, -5.0, -1.25, 1.0, -4.5, 1.0, C.shoe);           // ankle collar
    shin.gloss.box(-1.3, -6.5, -1.55, 1.3, -6.0, 2.55, C.sole);
    shin.gloss.box(-0.5, -5.75, -1.75, 0.5, -4.75, -1.5, C.clip);        // heel tab
    shin.gloss.box(-0.75, -5.25, 1.5, 0.75, -5.0, 2.0, C.sole);          // laces
  }
  // Pelvis.
  const hips = part('hips');
  hips.matte.box(-3.0, -0.5, -1.75, 3.0, 2.0, 1.75, C.jeans);
  hips.matte.box(-3.05, 1.5, -1.8, 3.05, 2.0, 1.8, C.belt);
  hips.metal.box(-0.5, 1.45, 1.75, 0.5, 2.05, 1.95, C.gold);
  hips.matte.box(-0.15, -0.5, 1.75, 0.15, 1.5, 1.8, C.jeansDark);

  // Torso: fitted shirt, tucked in.
  const sp = part('spine');
  sp.matte.box(-2.5, 0.5, -1.75, 2.5, 2.5, 1.75, C.shirt);      // waist
  sp.matte.box(-3.0, 2.5, -1.9, 3.0, 7.0, 1.9, C.shirt);        // chest
  sp.matte.box(-2.75, 7.0, -1.75, 2.75, 7.5, 1.6, C.shirt);     // shoulders, slightly rounded
  sp.matte.box(-0.25, 0.5, 1.9, 0.25, 6.5, 2.0, C.shirtShade);  // placket
  for (const y of [1.75, 3.5, 5.25]) sp.gloss.box(-0.25, y - 0.2, 1.95, 0.25, y + 0.2, 2.1, C.button);
  // collar points and band
  sp.matte.box(-2.0, 6.25, 1.6, -0.25, 7.6, 2.15, C.collar);
  sp.matte.box(-1.5, 5.75, 1.9, -0.5, 6.25, 2.15, C.collar);
  sp.matte.box(0.25, 6.25, 1.6, 2.0, 7.6, 2.15, C.collar);
  sp.matte.box(0.5, 5.75, 1.9, 1.5, 6.25, 2.15, C.collar);
  sp.matte.box(-1.75, 7.0, -1.6, 1.75, 8.0, 0.75, C.collar);
  sp.matte.box(-0.25, 6.4, 1.9, 0.25, 7.5, 2.0, C.skin);        // open neck
  // breast pocket with a pencil (her left)
  sp.matte.box(0.75, 3.75, 1.9, 2.25, 5.25, 2.02, C.shirtShade);
  sp.gloss.box(1.25, 4.75, 1.95, 1.75, 6.25, 2.35, C.pencil);
  sp.gloss.box(1.25, 6.25, 1.95, 1.75, 6.75, 2.35, C.eraser);
  sp.matte.box(-0.75, 7.5, -0.75, 0.75, 9.0, 0.75, C.skin);     // neck

  // Arms: rolled sleeves, slim forearms, small hands.
  for (const side of [1, -1]) {
    const L = side > 0;
    const up = part(L ? 'armL' : 'armR').matte;
    up.box(-1.0, -3.75, -1.0, 1.0, 0.75, 1.0, C.shirt);
    up.box(-1.25, -4.0, -1.25, 1.25, -3.0, 1.25, C.collar);     // rolled cuff
    const fore = part(L ? 'elbowL' : 'elbowR').matte;
    fore.box(-0.75, -2.75, -0.75, 0.75, 0.5, 0.75, C.skin);
    fore.box(-1.0, -4.25, -0.9, 1.0, -2.75, 1.1, C.skin);       // hand
    fore.box(L ? -1.25 : 1.0, -3.75, 0.1, L ? -1.0 : 1.25, -3.0, 0.85, C.skin); // thumb
  }

  // Head: a stepped, rounded block. Front face 9 x 7.5, jaw steps in at the bottom.
  const head = part('head');
  head.matte.box(-4.5, 1.125, -3.5, 4.5, 7.5, 4.0, C.skin);
  head.matte.box(-4.125, 0.0, -3.0, 4.125, 1.125, 4.0, C.skin);
  head.matte.box(-4.0, 1.0, -4.0, 4.0, 7.0, -3.5, C.skin);
  head.matte.quad(-4.5, 0, 4.5, 7.5, 4.02);
  const hair = head.gloss;
  // crown and back, a little larger than the skull for volume
  hair.box(-5.0, 6.0, -4.25, 5.0, 8.0, 4.25, C.hair);
  hair.box(-4.5, 8.0, -3.75, 4.5, 8.75, 3.9, C.hair);
  hair.box(-3.5, 8.75, -2.75, 3.5, 9.25, 3.0, C.hair);
  hair.box(-5.0, 0.75, -4.6, 5.0, 6.5, -3.4, C.hair);
  hair.box(-5.0, 1.5, -3.5, -4.5, 6.5, 3.25, C.hair);
  hair.box(4.5, 1.5, -3.5, 5.0, 6.5, 3.25, C.hair);
  // curtain fringe on the face-pixel grid: long at the temples, parted in the centre
  const fz0 = 4.0, fz1 = 4.55;
  const F = (c0, c1, rows) => hair.box(-4.5 + c0 * FPX, 7.5 - rows * FPX, fz0, -4.5 + (c1 + 1) * FPX, 7.5, fz1, C.hair);
  F(0, 3, 11); F(4, 7, 5); F(8, 10, 2); F(11, 12, 1); F(13, 15, 2); F(16, 19, 5); F(20, 23, 11);
  hair.box(-4.75, 7.25, 3.6, 4.75, 8.25, 4.55, C.hair);
  // sheen
  hair.box(-3.25, 9.25, 0.25, -1.0, 9.3, 2.25, C.hairSheen);
  hair.box(1.25, 9.25, 0.5, 3.0, 9.3, 2.0, C.hairSheen);
  hair.box(-4.25, 8.75, 2.5, -3.5, 8.8, 3.5, C.hairSheen);
  hair.box(-4.4, 6.4, 4.55, -3.2, 7.1, 4.6, C.hairSheen);
  // the half-up twist and the claw clip that holds it
  // (it sits high on the back of the crown so its teeth crest over her head from the front)
  hair.box(-1.75, 6.5, -5.25, 1.75, 9.5, -3.25, C.hair);
  hair.box(-1.25, 9.5, -4.75, 1.25, 10.0, -3.5, C.hair);
  hair.box(-2.75, 8.25, -5.6, 2.75, 9.75, -4.6, C.clip);
  for (const x of [-2.75, -1.75, -0.75, 0.25, 1.25, 2.25]) hair.box(x, 9.75, -5.45, x + 0.5, 10.9, -4.75, C.clip);
  for (const x of [-2.25, -1.25, -0.25, 0.75, 1.75]) hair.box(x, 7.25, -5.45, x + 0.5, 8.25, -4.75, C.clipDark);
  hair.box(-2.75, 8.25, -5.65, 2.75, 8.5, -5.55, C.clipDark);
  head.metal.box(-5.2, 1.0, 0.75, -4.8, 1.4, 1.15, C.gold);
  head.metal.box(4.8, 1.0, 0.75, 5.2, 1.4, 1.15, C.gold);

  // Long hair down the back.
  const back = part('hairBack').gloss; // layered and tapered so it reads as hair, not a cape
  back.box(-4.75, -3.0, -1.5, 4.75, 1.0, 0.0, C.hair);
  back.box(-4.25, -7.0, -1.25, 4.25, -3.0, 0.0, C.hair);
  back.box(-3.5, -9.5, -1.0, 3.5, -7.0, 0.0, C.hair);
  back.box(-3.0, -10.5, -0.9, -1.0, -9.5, 0.0, C.hairTip);
  back.box(-0.5, -11.0, -0.9, 1.5, -9.5, 0.0, C.hairTip);
  back.box(2.0, -10.25, -0.9, 3.25, -9.5, 0.0, C.hairTip);
  back.box(-4.8, -2.5, -1.2, -4.5, 0.5, -0.6, C.hairSheen);
  back.box(-4.3, -6.5, -1.0, -4.0, -3.5, -0.5, C.hairSheen);
  // A thick strand swept forward over her left shoulder, and a short one on the right.
  const lockL = part('lockL').gloss; // a gentle S-wave
  lockL.box(-0.6, -3.0, -0.6, 0.6, 0.5, 0.6, C.hair);
  lockL.box(-0.1, -6.0, -0.55, 1.1, -3.0, 0.55, C.hair);
  lockL.box(-0.4, -8.0, -0.5, 0.7, -6.0, 0.5, C.hair);
  lockL.box(0.0, -8.75, -0.4, 0.6, -8.0, 0.4, C.hairTip);
  lockL.box(0.95, -5.5, -0.2, 1.15, -3.5, 0.3, C.hairSheen);
  const lockR = part('lockR').gloss;
  lockR.box(-0.5, -3.5, -0.55, 0.5, 0.5, 0.5, C.hair);
  lockR.box(-0.25, -4.75, -0.45, 0.45, -3.5, 0.35, C.hairTip);
  return parts;
}

// ---------------------------------------------------------------- props

export function buildProp(name) {
  const C = COLORS;
  const m = new VoxelBuilder(), g = new VoxelBuilder();
  switch (name) {
    case 'lens': // magnifying glass
      g.box(-0.4, -3, -0.4, 0.4, 0.5, 0.4, C.belt);
      g.box(-1.75, 0.5, -0.3, 1.75, 1.0, 0.3, C.gold); g.box(-1.75, 3.5, -0.3, 1.75, 4.0, 0.3, C.gold);
      g.box(-1.75, 1.0, -0.3, -1.25, 3.5, 0.3, C.gold); g.box(1.25, 1.0, -0.3, 1.75, 3.5, 0.3, C.gold);
      m.box(-1.25, 1.0, -0.1, 1.25, 3.5, 0.1, 0xbfe6ff);
      break;
    case 'widget': // a soft pneumatic actuator with motion-capture markers
      for (let i = 0; i < 5; i++) m.box(-2 + i * 0.8, 0, -1, -1.3 + i * 0.8, 1.6 + (i % 2) * 0.6, 1, 0xf3ead8);
      for (const x of [-1.6, 0.0, 1.6]) g.box(x - 0.3, 2.3, -0.3, x + 0.3, 2.9, 0.3, 0xc3c9d1);
      g.box(-3.2, 0.3, -0.25, -2.0, 0.8, 0.25, 0x6fa8ff);
      break;
    case 'plug':
      g.box(-1.25, 0, -1.25, 1.25, 2.5, 1.25, 0xfbfbf8);
      g.box(-0.75, 2.5, -0.25, -0.25, 3.25, 0.25, C.gold);
      g.box(0.25, 2.5, -0.25, 0.75, 3.25, 0.25, C.gold);
      g.box(-0.5, 1.0, 1.25, 0.5, 1.5, 1.35, 0x3fd28b);
      break;
    case 'phone':
      g.box(-1.0, 0, -0.25, 1.0, 3.75, 0.25, 0x23202c);
      m.box(-0.75, 0.25, 0.25, 0.75, 3.5, 0.3, 0x86d39b);
      break;
    case 'leaf':
      for (const [x0, x1, y] of [[-0.5, 0.5, 0], [-1, 1, 0.5], [-1.5, 1.5, 1], [-1.5, 1.5, 1.5], [-1, 1, 2], [-0.5, 0.5, 2.5]]) m.box(x0, y, -0.15, x1, y + 0.5, 0.15, 0x5fbf6a);
      m.box(-0.1, -1, -0.1, 0.1, 0.5, 0.1, 0x3d7f45);
      break;
    case 'controller':
      g.box(-2, 0, -0.5, 2, 1.5, 0.5, 0x2b2a3a);
      g.box(-2.5, -0.5, -0.5, -1, 0.5, 0.5, 0x2b2a3a);
      g.box(1, -0.5, -0.5, 2.5, 0.5, 0.5, 0x2b2a3a);
      g.box(1, 0.75, 0.5, 1.5, 1.25, 0.6, C.clip);
      g.box(-1.5, 0.75, 0.5, -1.0, 1.25, 0.6, 0xf2f2f2);
      break;
    case 'notebook':
      m.box(-1.5, 0, -0.25, 1.5, 3.5, 0.25, C.clip);
      m.box(-1.25, 0.25, 0.25, 1.25, 3.25, 0.3, 0xfff6e8);
      break;
    case 'heart':
      for (const [x0, x1, y] of [[-0.5, 0.5, 0], [-1, 1, 0.5], [-1.5, 1.5, 1], [-2, 2, 1.5], [-2, 2, 2], [-2, -0.25, 2.5], [0.25, 2, 2.5]]) g.box(x0, y, -0.3, x1, y + 0.5, 0.3, 0xff6f91);
      break;
    default: return null;
  }
  const group = new THREE.Group();
  const mats = sharedMaterials();
  if (m.boxes.length) { const a = new THREE.Mesh(m.geometry(), mats.matte); a.castShadow = true; group.add(a); }
  if (g.boxes.length) { const b = new THREE.Mesh(g.geometry(), mats.gloss); b.castShadow = true; group.add(b); }
  return group;
}

let _mats = null;
function sharedMaterials() {
  if (_mats) return _mats;
  _mats = {
    matte: voxelMaterial({ roughness: 0.82 }),
    gloss: voxelMaterial({ roughness: 0.45, seam: 0.04 }),
    metal: voxelMaterial({ roughness: 0.3, metalness: 0.8, seam: 0.02 }),
    outline: new THREE.MeshBasicMaterial({ color: COLORS.ink, side: THREE.BackSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 7000 }) /* pushed back so it shows at the silhouette, never through a seam */,
  };
  return _mats;
}

// ---------------------------------------------------------------- springs + poses

class Spring {
  constructor(v = 0) { this.v = v; this.vel = 0; this.target = v; }
  step(dt, k, z) {
    const c = 2 * Math.sqrt(k) * z;
    this.vel += (k * (this.target - this.v) - c * this.vel) * dt;
    this.v += this.vel * dt;
    return this.v;
  }
}

const CHANNELS = [
  'root.py', 'root.px', 'root.ry', 'root.sx', 'root.sy',
  'hips.x', 'hips.y', 'hips.z', 'hips.py',
  'spine.x', 'spine.y', 'spine.z',
  'head.x', 'head.y', 'head.z',
  'armL.x', 'armL.y', 'armL.z', 'armL.py', 'elbowL.x', 'elbowL.y', 'elbowL.z',
  'armR.x', 'armR.y', 'armR.z', 'armR.py', 'elbowR.x', 'elbowR.y', 'elbowR.z',
  'legL.x', 'legL.z', 'kneeL.x', 'legR.x', 'legR.z', 'kneeR.x',
  'hairBack.x', 'hairBack.z', 'lockL.x', 'lockL.z', 'lockR.x', 'lockR.z',
];
const DEFAULTS = { 'root.sx': 1, 'root.sy': 1 };
const SPRING_CONFIG = CHANNELS.map((ch) => {
  const hair = ch.startsWith('hair') || ch.startsWith('lock'), root = ch.startsWith('root');
  return [ch, hair ? 70 : root ? 260 : 170, hair ? .32 : root ? .55 : .78];
});

const ease = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Each state returns target channel values for a time t (seconds since entering the state).
export const STATES = {
  idle: { face: 'neutral', pose: (t) => {
    const b = Math.sin(t * 2.0);
    return { // a relaxed contrapposto: weight on the left leg, right knee soft
      'spine.x': 0.03 + b * 0.015, 'spine.z': -0.035, 'hips.z': 0.045 + Math.sin(t * 0.8) * 0.02, 'hips.py': b * 0.05,
      'armL.z': 0.1 + b * 0.02, 'armR.z': -0.16 - b * 0.02, 'armL.x': 0.05, 'armR.x': 0.02,
      'elbowL.x': -0.2, 'elbowR.x': -0.3, 'head.z': 0.05 + Math.sin(t * 0.6) * 0.03,
      'legL.z': -0.02, 'legR.z': -0.06, 'legR.x': -0.1, 'kneeR.x': 0.22,
    };
  } },
  wave: { face: 'joy', pose: (t) => {
    const hop = t < 0.45 ? Math.sin((t / 0.45) * Math.PI) * 1.4 : 0;
    return {
      'root.py': hop, 'spine.z': 0.05, 'head.z': 0.12, 'head.x': -0.04,
      'armR.z': -1.95, 'armR.x': 0.32, 'elbowR.x': -0.1, 'elbowR.z': -1.05 + Math.sin(t * 12) * 0.42,
      'armL.z': 0.18, 'elbowL.x': -0.3, 'legL.z': 0.03, 'legR.z': -0.05, 'legR.x': -0.08, 'kneeR.x': 0.18,
    };
  } },
  talk: { face: 'happy', pose: (t) => ({
    'spine.x': 0.02, 'spine.z': -0.03, 'head.x': Math.sin(t * 4.2) * 0.035, 'head.z': 0.04 + Math.sin(t * 1.3) * 0.05,
    'armL.z': 0.3 + Math.sin(t * 2.1) * 0.08, 'armL.x': -0.5, 'elbowL.x': -1.1 + Math.sin(t * 3.3) * 0.12, 'elbowL.y': 0.5,
    'armR.z': -0.16, 'elbowR.x': -0.3, 'legL.z': 0.0, 'legR.z': -0.05, 'legR.x': -0.08, 'kneeR.x': 0.18,
    'hips.z': 0.04 + Math.sin(t * 1.1) * 0.02,
  }) },
  point: { face: 'curious', pose: (t, ctx) => {
    const a = ctx.pointAngle ?? 0; // screen-space angle of the target, 0 = to the right
    const right = Math.cos(a) >= 0;
    const theta = Math.atan2(Math.cos(a), -Math.sin(a));
    const out = { 'spine.z': right ? -0.06 : 0.06, 'head.z': right ? -0.08 : 0.08, 'legL.z': 0.03, 'legR.z': -0.03 };
    if (right) Object.assign(out, { 'armL.z': theta, 'armL.x': 0.2, 'elbowL.x': -0.05, 'armR.z': -0.18, 'elbowR.x': -0.4 });
    else Object.assign(out, { 'armR.z': theta, 'armR.x': 0.2, 'elbowR.x': -0.05, 'armL.z': 0.18, 'elbowL.x': -0.4 });
    out['root.py'] = t < 0.3 ? Math.sin((t / 0.3) * Math.PI) * 0.6 : 0;
    return out;
  } },
  think: { face: 'thinking', pose: (t) => ({ // right hand to chin, left arm folded underneath
    'head.z': -0.12 + Math.sin(t * 1.4) * 0.03, 'head.x': -0.1, 'spine.z': 0.03, 'spine.x': 0.02,
    'armR.x': -1.25, 'armR.z': 0.12, 'armR.y': 0.25, 'elbowR.x': -2.15, 'elbowR.y': 0.5,
    'armL.x': -0.55, 'armL.z': 0.12, 'elbowL.x': -1.5, 'elbowL.y': -0.85,
    'legL.z': 0.02, 'legR.x': -0.14, 'kneeR.x': 0.25, 'legR.z': -0.05,
  }) },
  celebrate: { face: 'joy', pose: (t) => {
    const cyc = (t % 0.62) / 0.62;
    const air = Math.sin(cyc * Math.PI);
    return {
      'root.py': air * 3.2, 'root.sy': 1 + (air - 0.4) * 0.08, 'root.sx': 1 - (air - 0.4) * 0.05,
      'armL.z': 2.5 + Math.sin(t * 13) * 0.18, 'armR.z': -2.5 - Math.sin(t * 13) * 0.18,
      'elbowL.x': -0.2, 'elbowR.x': -0.2, 'legL.x': -air * 0.55, 'kneeL.x': air * 1.1,
      'legR.x': -air * 0.35, 'kneeR.x': air * 0.8, 'head.x': -0.08, 'spine.x': -0.05,
    };
  } },
  laugh: { face: 'laugh', pose: (t) => ({
    'spine.x': -0.12 + Math.sin(t * 15) * 0.035, 'head.x': -0.14 + Math.sin(t * 15) * 0.03,
    'armL.z': 0.28, 'armR.z': -0.28, 'armL.x': -0.35, 'armR.x': -0.35,
    'elbowL.x': -1.35, 'elbowR.x': -1.35, 'elbowL.y': -0.6, 'elbowR.y': 0.6,
    'hips.py': Math.abs(Math.sin(t * 15)) * 0.2, 'legL.z': 0.04, 'legR.z': -0.04,
  }) },
  surprised: { face: 'surprised', pose: (t) => ({
    'root.py': t < 0.35 ? Math.sin((t / 0.35) * Math.PI) * 1.6 : 0,
    'spine.x': -0.14, 'head.x': -0.1,
    'armL.z': 0.55, 'armR.z': -0.55, 'armL.x': -0.45, 'armR.x': -0.45, 'elbowL.x': -1.9, 'elbowR.x': -1.9,
    'legL.z': 0.08, 'legR.z': -0.08,
  }) },
  shrug: { face: 'sheepish', pose: (t) => ({
    'armL.z': 0.62, 'armR.z': -0.62, 'armL.py': 0.45, 'armR.py': 0.45, 'armL.x': -0.25, 'armR.x': -0.25,
    'elbowL.x': -1.25, 'elbowR.x': -1.25, 'elbowL.y': -0.7, 'elbowR.y': 0.7,
    'head.z': 0.14 + Math.sin(t * 2) * 0.03, 'spine.z': -0.03, 'legL.z': 0.04, 'legR.z': -0.04,
  }) },
  walk: { face: 'neutral', pose: (t, ctx) => {
    const ph = t * (ctx.walkSpeed || 9);
    const s = Math.sin(ph), c = Math.cos(ph);
    return {
      'legL.x': -s * 0.62, 'legR.x': s * 0.62, 'kneeL.x': Math.max(0, c) * 0.9, 'kneeR.x': Math.max(0, -c) * 0.9,
      'armL.x': s * 0.5, 'armR.x': -s * 0.5, 'armL.z': 0.12, 'armR.z': -0.12, 'elbowL.x': -0.4, 'elbowR.x': -0.4,
      'hips.py': -Math.abs(c) * 0.35, 'spine.x': 0.08, 'spine.y': s * 0.06, 'head.y': -s * 0.04,
    };
  } },
  jump: { face: 'joy', pose: (t, ctx) => {
    const p = clamp(ctx.jumpProgress ?? (t / 0.9), 0, 1);
    if (p < 0.16) { // anticipation
      const k = ease(p / 0.16);
      return { 'hips.py': -1.4 * k, 'legL.x': -0.6 * k, 'legR.x': -0.6 * k, 'kneeL.x': 1.1 * k, 'kneeR.x': 1.1 * k, 'spine.x': 0.3 * k, 'armL.x': 0.7 * k, 'armR.x': 0.7 * k, 'root.sy': 1 - 0.08 * k, 'root.sx': 1 + 0.05 * k };
    }
    if (p < 0.84) { // airborne
      const a = (p - 0.16) / 0.68;
      return { 'root.sy': 1 + 0.07 * (1 - a), 'legL.x': -0.75, 'kneeL.x': 1.25, 'legR.x': -0.25, 'kneeR.x': 0.6, 'armL.z': 1.7, 'armR.z': -1.7, 'armL.x': -0.3, 'armR.x': -0.3, 'elbowL.x': -0.5, 'elbowR.x': -0.5, 'spine.x': -0.06, 'hairBack.x': 0.5 * a };
    }
    const k = 1 - ease((p - 0.84) / 0.16); // landing squash
    return { 'hips.py': -1.1 * k, 'legL.x': -0.5 * k, 'legR.x': -0.5 * k, 'kneeL.x': 0.9 * k, 'kneeR.x': 0.9 * k, 'root.sy': 1 - 0.1 * k, 'root.sx': 1 + 0.06 * k, 'armL.z': 0.6 * k, 'armR.z': -0.6 * k };
  } },
  sit: { face: 'neutral', pose: (t) => ({
    'root.py': -10.5, 'legL.x': -1.5, 'legR.x': -1.5,
    'kneeL.x': 1.45 + Math.sin(t * 2.4) * 0.28, 'kneeR.x': 1.45 + Math.sin(t * 2.4 + Math.PI) * 0.28,
    'legL.z': 0.06, 'legR.z': -0.06, 'spine.x': -0.05 + Math.sin(t * 2.0) * 0.012,
    'armL.z': 0.42, 'armR.z': -0.42, 'armL.x': 0.3, 'armR.x': 0.3, 'elbowL.x': -0.15, 'elbowR.x': -0.15,
    'head.z': Math.sin(t * 0.7) * 0.04,
  }) },
  sleep: { face: 'asleep', pose: (t) => ({
    'root.py': -10.5, 'legL.x': -1.5, 'legR.x': -1.5, 'kneeL.x': 1.5, 'kneeR.x': 1.5,
    'spine.x': 0.12 + Math.sin(t * 1.2) * 0.02, 'head.x': 0.42 + Math.sin(t * 1.2) * 0.03, 'head.z': 0.12,
    'armL.z': 0.3, 'armR.z': -0.3, 'armL.x': -0.3, 'armR.x': -0.3, 'elbowL.x': -0.9, 'elbowR.x': -0.9,
  }) },
  clip: { face: 'sleepy', pose: (t) => ({
    'armR.z': -2.3, 'armR.x': 0.55, 'elbowR.x': -1.9, 'elbowR.z': 0.4, 'head.x': 0.12, 'head.z': -0.06,
    'armL.z': 0.14, 'elbowL.x': -0.2, 'spine.z': 0.03, 'hairBack.z': Math.sin(t * 6) * 0.06,
  }) },
  stretch: { face: 'asleep', pose: (t) => ({
    'armL.z': 2.95, 'armR.z': -2.95, 'elbowL.x': 0, 'elbowR.x': 0, 'spine.x': -0.12, 'head.x': -0.18,
    'root.sy': 1.035, 'hips.z': Math.sin(t * 2) * 0.04,
  }) },
  lookAround: { face: 'curious', pose: (t) => ({
    'head.y': Math.sin(t * 1.3) * 0.55, 'spine.y': Math.sin(t * 1.3) * 0.12, 'armL.z': 0.13, 'armR.z': -0.13,
    'elbowL.x': -0.2, 'elbowR.x': -0.2,
  }) },
  hold: { face: 'happy', pose: (t) => ({ // presenting the prop in her right hand
    'armR.x': -1.05, 'armR.z': -0.25, 'elbowR.x': -0.85, 'elbowR.y': 0.2,
    'armL.z': 0.16, 'elbowL.x': -0.25, 'head.x': 0.06, 'head.z': 0.05 + Math.sin(t * 1.5) * 0.03,
    'spine.x': 0.04, 'legR.x': -0.08, 'kneeR.x': 0.18,
  }) },
  dance: { face: 'joy', pose: (t) => {
    const s = Math.sin(t * 7), c = Math.cos(t * 7);
    return {
      'hips.z': s * 0.12, 'spine.z': -s * 0.16, 'head.z': s * 0.12, 'root.py': Math.abs(c) * 0.9,
      'armL.z': 1.2 + s * 0.8, 'armR.z': -1.2 + s * 0.8, 'elbowL.x': -0.9, 'elbowR.x': -0.9,
      'legL.x': -Math.max(0, s) * 0.4, 'kneeL.x': Math.max(0, s) * 0.7, 'legR.x': -Math.max(0, -s) * 0.4, 'kneeR.x': Math.max(0, -s) * 0.7,
    };
  } },
};

// ---------------------------------------------------------------- host object

export function createApoorva({ outline = true, shadows = true } = {}) {
  const mats = sharedMaterials();
  const face = new Face();
  const faceMat = voxelMaterial({ roughness: 0.78, map: face.texture, seam: 0.05, jitter: 0.035, voxel: FPX, alphaTest: 0.5 });
  const parts = buildModel();

  const J = {};
  const root = new THREE.Group(); root.name = 'apoorva'; J.root = root;
  const body = new THREE.Group(); root.add(body); J.body = body;
  for (const [name, [parent, pos]] of Object.entries(RIG)) {
    const g = new THREE.Group(); g.name = name; g.position.set(...pos);
    (parent ? J[parent] : body).add(g); J[name] = g;
  }

  for (const [name, kinds] of Object.entries(parts)) {
    const bone = J[name];
    for (const kind of ['matte', 'gloss', 'metal']) {
      const b = kinds[kind];
      if (b.quads.length) {
        const fb = new VoxelBuilder(); fb.quads = b.quads; b.quads = [];
        const fm = new THREE.Mesh(fb.geometry(), faceMat); fm.receiveShadow = shadows; bone.add(fm);
      }
      if (!b.boxes.length) continue;
      const mesh = new THREE.Mesh(b.geometry(), mats[kind]);
      mesh.castShadow = shadows; mesh.receiveShadow = shadows;
      bone.add(mesh);
      if (outline) {
        const o = new THREE.Mesh(b.geometry(0.13), mats.outline);
        o.userData.outline = true; bone.add(o);
      }
    }
  }

  const springs = Object.fromEntries(CHANNELS.map((ch) => [ch, new Spring(DEFAULTS[ch] ?? 0)]));
  const ctx = { lookX: 0, lookY: 0, pointAngle: 0, walkSpeed: 9, jumpProgress: null, vx: 0, vy: 0 };
  let state = 'idle', stateT = 0, override = null, overrideUntil = 0, time = 0;
  let blinkAt = 2 + Math.random() * 3, blinkEnd = 0;
  let talkUntil = 0, talkFlap = 0;
  let inflate = 1, inflateVel = 0, inflateTarget = 1, flashAmount = 0;
  const prop = { name: null, obj: null };
  const propCache = new Map(); // props are built once and reused (no geometry left behind)
  const target = {};           // reused every frame

  function setFace(name) {
    const e = EXPRESSIONS[name] || EXPRESSIONS.neutral;
    face.set({ eyes: e.eyes, brows: e.brows, mouth: e.mouth, blush: e.blush });
    host.expression = name;
  }

  const host = {
    group: root, joints: J, face, ctx, expression: 'neutral',
    get state() { return state; },
    get time() { return time; },
    get talking() { return time < talkUntil; },
    play(name, { face: faceName } = {}) {
      if (!STATES[name]) return;
      if (name !== state) { state = name; stateT = 0; }
      if (!override) setFace(faceName || STATES[name].face);
    },
    // Show an expression for a while without changing the pose.
    express(name, seconds = 2.2) { override = name; overrideUntil = time + seconds; setFace(name); },
    clearExpression() { override = null; setFace(STATES[state].face); },
    say(seconds) { talkUntil = time + seconds; },
    stopTalking() { talkUntil = 0; },
    lookAt(x, y) { ctx.lookX = clamp(x, -1, 1); ctx.lookY = clamp(y, -1, 1); },
    pointAt(angle) { ctx.pointAngle = angle; },
    setInflate(v, instant = false) { inflateTarget = v; if (instant) { inflate = v; inflateVel = 0; } },
    setProp(name) {
      if ((name || null) === prop.name) return;
      if (prop.obj) { prop.obj.removeFromParent(); prop.obj = null; }
      prop.name = name || null;
      if (!name) return;
      let p = propCache.get(name);
      if (!p) { p = buildProp(name); if (!p) return; p.position.set(0, -0.6, 0.4); propCache.set(name, p); }
      J.handR.add(p); prop.obj = p;
    },
    get prop() { return prop.name; },
    flash(v) { flashAmount = v; for (const m of [mats.matte, mats.gloss, mats.metal, faceMat]) m.userData.uniforms.uFlash.value = v; },
    setOutline(on) { root.traverse((o) => { if (o.userData.outline) o.visible = on; }); },
    update(dt) {
      dt = Math.min(dt, 1 / 20);
      time += dt; stateT += dt;
      if (override && time > overrideUntil) { override = null; setFace(STATES[state].face); }

      // the white flash that accompanies inflation fades out on its own
      if (flashAmount > 0.002) host.flash(flashAmount * Math.exp(-dt * 9)); else if (flashAmount) host.flash(0);
      // calm (reduced motion): poses are evaluated at t = 0, so every state becomes a still pose
      const calm = !!ctx.calm, sway = calm ? 0 : 1;
      if (calm && flashAmount) host.flash(0);
      for (const ch of CHANNELS) target[ch] = DEFAULTS[ch] ?? 0;
      Object.assign(target, STATES[state].pose(calm ? 0 : stateT, ctx));
      // look-at layer: the head leads, the body follows a little
      target['head.y'] += clamp(ctx.lookX * 0.42, -0.42, 0.42);
      target['head.x'] += clamp(-ctx.lookY * 0.28, -0.3, 0.28);
      target['spine.y'] += clamp(ctx.lookX * 0.06, -0.06, 0.06);
      // hair: gravity, motion and a slow sway
      target['hairBack.x'] += clamp(-ctx.vy * 0.004, -0.1, 0.55) + Math.sin(time * 1.7) * 0.02 * sway - (target['spine.x'] + target['head.x']) * 0.6;
      target['hairBack.z'] += clamp(ctx.vx * 0.0025, -0.35, 0.35) - target['head.z'] * 0.5;
      target['lockL.x'] = -target['head.x'] * 0.8 - target['spine.x'] * 0.6;
      target['lockR.x'] = target['lockL.x'];
      target['lockL.z'] = -target['head.z'] * 0.7 + clamp(ctx.vx * 0.002, -0.25, 0.25) + Math.sin(time * 1.9) * 0.015 * sway;
      target['lockR.z'] = target['lockL.z'];

      for (const [ch, stiffness, damping] of SPRING_CONFIG) {
        const s = springs[ch]; s.target = target[ch];
        if (calm) { s.v = s.target; s.vel = 0; }
        else s.step(dt, stiffness, damping);
      }
      inflateVel += (220 * (inflateTarget - inflate) - 2 * Math.sqrt(220) * 0.38 * inflateVel) * dt;
      inflate += inflateVel * dt;
      if (calm) { inflate = inflateTarget; inflateVel = 0; }
      const v = (ch) => springs[ch].v;
      body.position.set(v('root.px'), v('root.py'), 0);
      body.scale.set(v('root.sx'), v('root.sy'), v('root.sx') * Math.max(0.02, inflate));
      body.rotation.y = v('root.ry');
      J.hips.rotation.set(v('hips.x'), v('hips.y'), v('hips.z')); J.hips.position.y = 12 + v('hips.py');
      J.spine.rotation.set(v('spine.x'), v('spine.y'), v('spine.z'));
      J.head.rotation.set(v('head.x'), v('head.y'), v('head.z'));
      J.armL.rotation.set(v('armL.x'), v('armL.y'), v('armL.z')); J.armL.position.y = 6.5 + v('armL.py');
      J.armR.rotation.set(v('armR.x'), v('armR.y'), v('armR.z')); J.armR.position.y = 6.5 + v('armR.py');
      J.elbowL.rotation.set(v('elbowL.x'), v('elbowL.y'), v('elbowL.z'));
      J.elbowR.rotation.set(v('elbowR.x'), v('elbowR.y'), v('elbowR.z'));
      J.legL.rotation.set(v('legL.x'), 0, v('legL.z')); J.kneeL.rotation.x = v('kneeL.x');
      J.legR.rotation.set(v('legR.x'), 0, v('legR.z')); J.kneeR.rotation.x = v('kneeR.x');
      J.hairBack.rotation.set(v('hairBack.x'), 0, v('hairBack.z'));
      J.lockL.rotation.set(v('lockL.x'), 0, v('lockL.z'));
      J.lockR.rotation.set(v('lockR.x'), 0, v('lockR.z'));

      // (inflation, integrated above, squashes the body flat along z when she is "just a pixel")

      // eyes: gaze and blinking; mouth: talking flaps
      const expr = EXPRESSIONS[host.expression] || {};
      const gx = expr.gazeX ?? Math.round(clamp(ctx.lookX * 1.6, -1, 1));
      const gy = expr.gazeY ?? (ctx.lookY > 0.5 ? -1 : 0);
      if (!calm && time > blinkAt) { blinkEnd = time + 0.12; blinkAt = time + 2.2 + Math.random() * 3.6; if (Math.random() < 0.18) blinkAt = time + 0.28; }
      if (!calm && time < talkUntil) {
        talkFlap -= dt;
        if (talkFlap <= 0) { talkFlap = 0.07 + Math.random() * 0.08; face.state.talk = ['talkA', 'talkB', 'smile', 'talkA'][Math.floor(Math.random() * 4)]; }
      } else face.state.talk = null;
      face.set({ blink: !calm && !ctx.resting && time < blinkEnd, gazeX: gx, gazeY: gy });
    },
  };
  host.play('idle');
  return host;
}

// A flat, front-facing pixel portrait of the same model: the no-WebGL fallback and avatar marks.
export function drawSprite(canvas, { scale = 4, expression = 'neutral' } = {}) {
  const parts = buildModel();
  const world = {};
  const resolve = (name) => {
    if (world[name]) return world[name];
    const [parent, pos] = RIG[name];
    const base = parent ? resolve(parent) : [0, 0, 0];
    return (world[name] = [base[0] + pos[0], base[1] + pos[1], base[2] + pos[2]]);
  };
  const all = [];
  for (const [name, kinds] of Object.entries(parts)) {
    const o = resolve(name);
    for (const kind of ['matte', 'gloss', 'metal']) for (const b of kinds[kind].boxes) {
      all.push({ x0: b[0] + o[0], y0: b[1] + o[1], x1: b[3] + o[0], y1: b[4] + o[1], z: b[5] + o[2], c: b[6] });
    }
  }
  all.sort((a, b) => a.z - b.z);
  const W = 8, Htop = 31.5, Hbot = -0.5, U = FPX;
  canvas.width = Math.round((W * 2) / U) * scale; canvas.height = Math.round((Htop - Hbot) / U) * scale;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const X = (x) => Math.round(((x + W) / U)) * scale, Y = (y) => Math.round(((Htop - y) / U)) * scale;
  const hex = (c) => '#' + new THREE.Color(c).getHexString();
  const headZ = resolve('head')[2] + 4.0;
  let faceDrawn = false;
  const face = new Face();
  face.set(EXPRESSIONS[expression] || EXPRESSIONS.neutral);
  for (const b of all) {
    if (!faceDrawn && b.z > headZ + 0.01) {
      const h = resolve('head');
      g.drawImage(face.canvas, X(h[0] - 4.5), Y(h[1] + 7.5), (9 / U) * scale, (7.5 / U) * scale);
      faceDrawn = true;
    }
    g.fillStyle = hex(b.c);
    g.fillRect(X(b.x0), Y(b.y1), Math.max(scale, X(b.x1) - X(b.x0)), Math.max(scale, Y(b.y0) - Y(b.y1)));
  }
  return canvas;
}
