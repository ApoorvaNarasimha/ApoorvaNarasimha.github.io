// One particle system behind the whole page. Every dot stores its place in all five shapes, and
// scrolling blends from one shape to the next:
//   0 a sensor wave (hello) -> 1 a neural network (projects heading) -> 2 data streams beside the cards
//   -> 3 a soft-robot spiral (what's next) -> 4 a pixel heart (say hi)
// The dots are square pixels in the site's four colours. With reduced motion they hold still and
// change shape only when the section changes.
import * as THREE from 'three';

const SHAPES = 5;
// four dot colours per background, so none of them disappears into it
const PALETTES = {
  blue: ['#38e1ff', '#4f8cff', '#ffd21f', '#9b8cff'],
  ink: ['#ffd21f', '#4f8cff', '#ff4d4d', '#2ed573'],
  beside: ['#c9b76a', '#5b86c9', '#c0717c', '#58a986'], // softened beside the cards, which carry the bright colour
  tech: ['#38e1ff', '#4f8cff', '#9b8cff', '#4ade9b'],
};
PALETTES.lilac = ['#c9bcff', '#9b8cff', '#38e1ff', '#ff9ad5'];

const VERT = `
  attribute vec3 p0, p1, p2, p3, p4; attribute float seed; attribute float tone;
  uniform float uShape, uTime, uSize, uAspect, uFade; uniform vec2 uPointer, uNet, uSpiral; uniform vec3 uPal[4];
  varying vec3 vCol; varying float vA;
  vec3 at(float i) {
    if (i < .5) { vec3 p = p0; p.y += (sin(p.x * 3. + uTime * .9) + sin(p.x * 1.7 - p.z * 4. + uTime * .6)) * .07 * (1. + p.x / uAspect * .6); return p; }
    if (i < 1.5) { vec3 p = p1; float a = uTime * .12; vec2 c = uNet; vec2 q = vec2(p.x - c.x, p.z); p.x = c.x + q.x * cos(a) - q.y * sin(a); p.z = q.x * sin(a) + q.y * cos(a); return p; }
    if (i < 2.5) { vec3 p = p2; p.y = mod(p.y + uTime * (.05 + seed * .12) + 1.2, 2.4) - 1.2; return p; }
    if (i < 3.5) { vec3 p = p3; float a = uTime * .18; vec2 c = uSpiral; vec2 q = p.xy - c; p.xy = c + vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a)); return p; }
    vec3 p = p4; vec2 h = vec2(0., .47); p.xy = h + (p.xy - h) * (1. + .04 * sin(uTime * 2.2)); return p;
  }
  void main() {
    float a = floor(min(uShape, ${SHAPES - 1}.)), f = clamp(uShape - a, 0., 1.);
    float t = smoothstep(seed * .3, seed * .3 + .7, f); // dots leave one after another
    vec3 p = mix(at(a), at(min(a + 1., ${SHAPES - 1}.)), t);
    float mid = sin(t * 3.14159); mid *= mid; // and swirl on the way
    p += mid * .22 * vec3(sin(seed * 40. + uTime), cos(seed * 57. + uTime * .8), sin(seed * 23.));
    p.xy += .006 * vec2(sin(uTime * 1.3 + seed * 90.), cos(uTime * 1.1 + seed * 70.));
    vec2 d = p.xy - uPointer; float l = length(d); // and step aside for the pointer
    p.xy += d / max(l, .02) * .13 * smoothstep(.34, 0., l);
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (.55 + seed * .9) * (4. / -mv.z);
    vCol = uPal[int(tone + .5)];
    vA = (.55 + .45 * seed) * uFade;
    float head = smoothstep(.1, .35, uShape) * (1. - smoothstep(1.5, 1.95, uShape)); // the projects heading sits on the left
    vA *= mix(1., mix(.14, 1., smoothstep(-.05 * uAspect, .28 * uAspect, p.x)), head);
  }`;
const FRAG = `
  varying vec3 vCol; varying float vA;
  void main() { gl_FragColor = vec4(vCol, vA); }`; // gl_PointCoord is left alone: a point is already a square pixel

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// every shape is drawn in a space 2 units tall and 2 x aspect wide, centred on the screen
// wide screens put the network and the spiral on the right; phones shrink them into the space above the heading
const layout = (aspect) => (aspect < 0.85 ? { net: [0, 0.6], netK: 0.5, spiral: [0, 0.55], spiralK: 0.6 } : { net: [aspect * 0.97 - 0.5, 0.05], netK: 1, spiral: [aspect * 0.6, 0.42], spiralK: 1 });

function build(n, aspect) {
  const L = layout(aspect);
  const r = rng(11), g = () => (r() + r() + r() - 1.5) / 1.5;
  const out = Array.from({ length: SHAPES }, () => new Float32Array(n * 3));
  const nodes = Array.from({ length: 16 }, (_, i) => {
    const layer = i % 4;
    return [L.net[0] + (layer - 1.5) * 0.3 * L.netK, L.net[1] + (Math.floor(i / 4) - 1.5) * 0.34 * L.netK, g() * 0.4 * L.netK];
  });
  const links = [];
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) if (j % 4 === (i % 4) + 1 && r() < 0.6) links.push([nodes[i], nodes[j]]);
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  const cells = [];
  HEART.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') cells.push([x - 3, 2.5 - y]); }));
  for (let i = 0; i < n; i++) {
    const set = (k, x, y, z) => { out[k][i * 3] = x; out[k][i * 3 + 1] = y; out[k][i * 3 + 2] = z; };
    const wx = (r() * 2 - 1) * aspect * 1.1, d = r();
    set(0, wx, -1.12 + d * 0.06 + Math.max(0, wx / aspect) * 0.24, -d * 1.2);
    if (i % 5 < 3) { const c = nodes[i % 16], k = 0.055 * L.netK; set(1, c[0] + g() * k, c[1] + g() * k, c[2] + g() * k); }
    else { const [a, b] = links[i % links.length], t = r(); set(1, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t); }
    const lane = i % 5 < 2 ? Math.pow(r(), 1.6) * 0.16 * aspect : (0.1 + r() * 0.9) * aspect; // most pass behind the cards
    set(2, (i % 2 ? 1 : -1) * (aspect * 1.01 - lane), r() * 2.4 - 1.2, g() * 0.2);
    const th = r() * Math.PI * 6.5, rad = (0.04 + th * 0.019) * L.spiralK;
    set(3, L.spiral[0] + Math.cos(th) * rad + g() * 0.02, L.spiral[1] + Math.sin(th) * rad + g() * 0.02, g() * 0.12);
    if (i % 3) { const c = cells[(r() * cells.length) | 0], s = 0.1; set(4, (c[0] + (r() - 0.5) * 0.88) * s, (c[1] + (r() - 0.5) * 0.88) * s + 0.47, g() * 0.1); }
    else { const a = r() * Math.PI * 2, q = 1 + g() * 0.12; set(4, Math.cos(a) * aspect * 0.97 * q, Math.sin(a) * 0.9 * q, g() * 0.3); } // a loose halo around the card
  }
  return out;
}

export function setupParticles({ sections, themeOf, isReduced }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'particles'; canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch { return; }
  document.body.append(canvas);
  const N = innerWidth < 700 ? 2200 : 6000;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(0.25) * 180) / Math.PI, 1, 0.1, 20);
  camera.position.z = 4;
  const geo = new THREE.BufferGeometry(), r = rng(5);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(Float32Array.from({ length: N }, r), 1));
  geo.setAttribute('tone', new THREE.BufferAttribute(Float32Array.from({ length: N }, (_, i) => i % 4), 1));
  const color = (h) => new THREE.Color().setStyle(h, THREE.LinearSRGBColorSpace); // written straight to the screen
  const pal = PALETTES.blue.map(color);
  const u = { uShape: { value: 0 }, uTime: { value: 0 }, uSize: { value: 4 }, uAspect: { value: 1 }, uFade: { value: 1 }, uPointer: { value: new THREE.Vector2(99, 99) }, uPal: { value: pal }, uNet: { value: new THREE.Vector2() }, uSpiral: { value: new THREE.Vector2() } };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false }));
  points.frustumCulled = false;
  scene.add(points);

  let keys = [], aspect = 0, W = 0, H = 0;
  function measure() { // scroll positions at which each shape is fully formed
    const top = (el) => el.getBoundingClientRect().top + scrollY, v = innerHeight, id = (s) => document.getElementById(s);
    const stack = document.querySelector('.folders');
    keys = [[0, 0], [v * 0.12, 0], [top(id('projects')) - v * 0.05, 1], [top(stack) + v * 0.15, 2], [top(id('next')) - v * 1.25, 2], [top(id('next')) - v * 0.05, 3], [top(id('contact')) - v * 1.15, 3], [top(id('contact')) - v * 0.05, 4]];
  }
  function resize() {
    W = document.documentElement.clientWidth; H = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(W, H, false);
    const a = W / H;
    camera.aspect = a; camera.updateProjectionMatrix();
    u.uSize.value = Math.max(2.4, Math.min(4.6, W / 320)) * renderer.getPixelRatio();
    if (Math.abs(a - aspect) > 0.01) { aspect = a; u.uAspect.value = a; u.uNet.value.set(...layout(a).net); u.uSpiral.value.set(...layout(a).spiral); build(N, a).forEach((arr, k) => geo.setAttribute('p' + k, new THREE.BufferAttribute(arr, 3))); }
    measure(); wake();
  }
  const shapeAt = (y) => {
    for (let i = 1; i < keys.length; i++) if (y < keys[i][0]) { const [a, s] = keys[i - 1], [b, e] = keys[i]; return s + (e - s) * Math.max(0, (y - a) / (b - a || 1)); }
    return SHAPES - 1;
  };
  let shape = 0, want = PALETTES.blue.map(color), theme = '', raf = 0, last = 0, pointer = new THREE.Vector2(99, 99);
  function retheme() {
    const sec = sections.find((s) => { const b = s.getBoundingClientRect(); return b.top <= H * 0.55 && b.bottom > H * 0.55; });
    let t = sec ? themeOf(sec) : theme;
    if (t === 'ink' && beside) t = 'beside';
    if (t && t !== theme) { theme = t; want = (PALETTES[t] || PALETTES.ink).map(color); }
  }
  let beside = false;
  // dots step back wherever there is something to read in "what's next"
  function fadeAt() {
    const top = (s) => document.getElementById(s).getBoundingClientRect().top, small = aspect < 0.85;
    const c01 = (v) => Math.max(0, Math.min(1, v));
    const inNext = c01((H * 0.5 - top('next')) / (H * 0.4)), past = c01((H * 0.04 - top('next')) / (H * 0.3)), back = c01((H * 0.95 - top('contact')) / (H * 0.6));
    const next = (small ? 0.22 : 1 - 0.35 * inNext) * (1 - past) + 0.1 * past;
    const inHead = small ? c01((H * 0.45 - top('projects')) / (H * 0.3)) * c01((document.querySelector('.folders').getBoundingClientRect().top) / (H * 0.2)) : 0;
    const inProj = c01((H * 0.7 - top('projects')) / (H * 0.5)), inStack = c01((H * 0.45 - document.querySelector('.folders').getBoundingClientRect().top) / (H * 0.35));
    beside = inProj * inStack > 0.5;
    const proj = 1 - inProj * 0.9 * inStack * (1 - inNext); // full strength at the heading, a quarter beside the cards
    const inAbout = c01((H * 0.9 - top('about')) / (H * 0.4)) * c01((top('projects') - H * 0.3) / (H * 0.25)); // the about text reads on clear ground
    const pastHero = c01((H * 0.85 - top('about')) / (H * 0.45)); // the hero has its code background instead
    return pastHero * (1 - 0.92 * inAbout) * proj * (1 - 0.6 * inHead) * (1 - inNext + next * inNext) * (1 - back) + (small ? 0.7 : 1) * back;
  }
  function frame(now) {
    raf = 0;
    if (document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    const still = isReduced(), target = shapeAt(scrollY);
    if (still) shape = Math.round(target); else { shape += (target - shape) * (1 - Math.exp(-dt * 2.6)); u.uTime.value += dt; }
    u.uShape.value = shape;
    const fade = fadeAt();
    retheme();
    u.uFade.value += (fade - u.uFade.value) * (still ? 1 : 1 - Math.exp(-dt * 5));
    pal.forEach((c, i) => c.lerp(want[i], still ? 1 : 1 - Math.exp(-dt * 3)));
    if (still) u.uPointer.value.set(99, 99); else if (pointer.x > 50) u.uPointer.value.copy(pointer); else if (u.uPointer.value.x > 50) u.uPointer.value.copy(pointer); else u.uPointer.value.lerp(pointer, Math.min(1, dt * 9));
    renderer.render(scene, camera);
    if (!still) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', resize, { passive: true });
  addEventListener('pointermove', (e) => { pointer.set((e.clientX / W * 2 - 1) * aspect, 1 - e.clientY / H * 2); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => pointer.set(99, 99));
  document.addEventListener('visibilitychange', wake);
  new MutationObserver(wake).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new ResizeObserver(() => { measure(); wake(); }).observe(document.body);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.hidden = true; });
  canvas.addEventListener('webglcontextrestored', () => { canvas.hidden = false; wake(); });
  resize();
}
