// The original roaming voxel guide, with cached perch geometry and bounded animation work.
import * as THREE from 'three';
import { createApoorva } from './apoorva.js';
import { ENTRANCE, ENTRANCES, createFx } from './entrances.js';

const BODY_H = 34, BODY_W = 17, UNIT = 6;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function createStage({ container, canvas, hit, isReduced }) {
  if (new URLSearchParams(location.search).has('nowebgl')) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    if (!renderer.getContext()) return null;
  } catch { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-16, 16, 30, -30, 1, 1000);
  camera.position.set(0, 16 + Math.sin(.17) * 300, Math.cos(.17) * 300);
  camera.lookAt(0, 16, 0); camera.updateMatrixWorld(true);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbdb6b2, 1.75));
  const key = new THREE.DirectionalLight(0xfffaf5, 2.3); key.position.set(-30, 60, 50); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfcbff, 1.7); rim.position.set(40, 30, -40); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 1.25); fill.position.set(14, 24, 80); scene.add(fill);
  const host = createApoorva({ shadows: false }); scene.add(host.group);
  const origin = new THREE.Vector3().project(camera);
  // The scene holds her at up to natural size; anything larger enlarges the canvas itself, so she stays sharp and unclipped.
  let zoom = 0;
  function setZoom(z) {
    if (Math.abs(z - zoom) < .001) return;
    zoom = z;
    renderer.setSize(Math.round(32 * UNIT * z), Math.round(60 * UNIT * z), false);
    canvas.style.width = 32 * UNIT * z + 'px'; canvas.style.height = 60 * UNIT * z + 'px';
    canvas.style.left = -(origin.x + 1) * 16 * UNIT * z + 'px';
    canvas.style.top = -(1 - origin.y) * 30 * UNIT * z + 'px';
  }
  setZoom(1);

  const S = { enabled: false, mode: 'hidden', perch: null, visible: false, x: 0, y: 0, scale: 1, facing: .2, facingTarget: .2, spin: 0, travel: null };
  const fx = createFx(container);
  const seen = new Set(); // sections whose entrance has played
  let pointer = null, returned = false, hopAt = 0;
  let raf = 0, last = 0, awakeUntil = 0, layoutFrame = 0, settleTimer = 0;
  let paused = false, provider = () => null, lookOverride = null, updating = false;
  const lands = [], cache = new WeakMap();
  const canvasMeasure = document.createElement('canvas').getContext('2d');
  const canRender = () => S.enabled && S.visible && !document.hidden && !renderer.getContext().isContextLost();
  const bodyHeight = () => BODY_H * UNIT * S.scale;
  const onPage = () => S.mode === 'perch' || (S.mode === 'travel' && !!S.travel?.page); // page coordinates scroll with the document
  function anchor() { return { x: S.x - (onPage() ? scrollX : 0), y: S.y - (onPage() ? scrollY : 0) }; }
  function headPoint() { const p = anchor(); return { x: p.x, y: p.y - bodyHeight() * (['sit', 'sleep'].includes(host.state) ? .66 : 1) }; }
  function cancel() { cancelAnimationFrame(raf); raf = 0; last = 0; }
  function wake(ms = 1200) {
    awakeUntil = Math.max(awakeUntil, performance.now() + ms);
    if (canRender() && !raf) raf = requestAnimationFrame(frame);
  }
  // Invalidate on every public pose mutation. Internal flash decay cannot extend its own lifetime.
  for (const name of ['play', 'express', 'clearExpression', 'say', 'stopTalking', 'setInflate', 'setProp', 'flash', 'setOutline', 'pointAt']) {
    const original = host[name];
    host[name] = (...args) => {
      const result = original.apply(host, args);
      if (!updating) {
        const seconds = name === 'say' ? args[0] : name === 'express' ? args[1] ?? 2.2 : 0;
        wake(Math.max(1200, Math.min(10000, (seconds || 0) * 1000 + 300)));
      }
      return result;
    };
  }
  function measure(el, force = false) {
    if (!el?.isConnected) return null;
    if (!force && cache.has(el)) return cache.get(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    let x = r.left + r.width * Number(el.dataset.perchAlign ?? .5), y = r.top, letter = null;
    const reserved = el.matches('.host-perch, .studio-perch') && !el.textContent.trim();
    const letters = el.querySelectorAll('.ch');
    if (reserved) y = r.bottom - 12;
    else if (el.dataset.perchTrail !== undefined) { x = r.left + r.width * .5; y = r.top + r.height * .72; }
    else if (letters.length) {
      letter = letters[Math.min(Number(el.dataset.perchIndex ?? letters.length - 1), letters.length - 1)];
      let probe = letter.nextElementSibling;
      if (!probe?.classList.contains('probe')) {
        probe = document.createElement('i'); probe.className = 'probe'; probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; letter.after(probe);
      }
      const lr = letter.getBoundingClientRect(), style = getComputedStyle(letter);
      canvasMeasure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const ascent = canvasMeasure.measureText(letter.textContent).actualBoundingBoxAscent || parseFloat(style.fontSize) * .65;
      x = lr.left + lr.width / 2; y = probe.getBoundingClientRect().top - ascent;
    }
    const hero = !!el.closest('#start'), small = innerWidth <= 640;
    const height = reserved ? Math.min(small ? 160 : hero ? 580 : 200, r.height - 24, r.width * BODY_H / BODY_W) : hero ? (small ? 180 : 240) : small ? 130 : 165;
    const info = { x: x + scrollX, y: y + scrollY, scale: height / (BODY_H * UNIT), pose: el.dataset.perchPose || 'stand', letter, trail: el.dataset.perchTrail !== undefined ? { left: r.left + scrollX, top: r.top + scrollY, width: r.width } : null };
    cache.set(el, info); return info;
  }
  function dockPoint() { const height = innerWidth <= 640 ? 90 : 110; return { x: innerWidth - height * .32 - 18, y: innerHeight - 14, scale: height / (BODY_H * UNIT), pose: 'stand' }; }
  function position() {
    setZoom(Math.max(1, S.scale));
    container.classList.toggle('is-fixed', !onPage());
    container.style.transform = `translate3d(${S.x}px, ${S.y}px, 0)`;
    const h = bodyHeight(), sitting = ['sit', 'sleep'].includes(host.state);
    Object.assign(hit.style, { left: -BODY_W * UNIT * S.scale / 2 + 'px', top: -h * (sitting ? .66 : 1) + 'px', width: BODY_W * UNIT * S.scale + 'px', height: h + 'px' });
  }
  function visibility() {
    const p = S.travel?.phase === 'in' ? { x: S.travel.info.x - (S.travel.page ? scrollX : 0), y: S.travel.info.y - (S.travel.page ? scrollY : 0) } : anchor();
    S.visible = !!(S.mode !== 'hidden' && p.y > 0 && p.y - bodyHeight() < innerHeight && p.x > -80 && p.x < innerWidth + 80);
    container.hidden = !S.enabled || !S.visible;
    if (!canRender()) cancel();
  }
  function place(el, notify = false) {
    const info = el ? measure(el, true) : dockPoint();
    if (!info) return;
    S.travel = null; host.ctx.jumpProgress = null; S.perch = el || null; S.mode = el ? 'perch' : 'dock'; canvas.style.opacity = '1'; resetLook();
    S.x = info.x; S.y = info.y; S.scale = info.scale; S.facingTarget = anchor().x > innerWidth * .55 ? -.22 : .22;
    host.play(info.pose === 'sit' ? 'sit' : 'idle');
    position(); visibility(); wake();
    window.dispatchEvent(new CustomEvent('host:move'));
    if (notify) lands.forEach((fn) => fn(el, { returned }));
  }
  // Every section has its own entrance (js/host/entrances.js): she drops into the hero, assembles out of
  // pixels on the projects heading, beams down onto what's next, somersaults onto contact, and springs
  // up from below in the corner. She leaves by dissolving upward.
  const styleFor = (el) => (!el ? 'spring' : ENTRANCE[el.closest('[data-section]')?.dataset.section] || 'assemble');
  const feet = () => ({ x: -parseFloat(canvas.style.left), y: -parseFloat(canvas.style.top) });
  function move(el, { entering = false } = {}) {
    if (!S.enabled) return;
    if (S.travel ? S.travel.target === (el || null) : (!entering && ((el && el === S.perch && S.mode === 'perch') || (!el && S.mode === 'dock')))) return;
    const info = el ? measure(el, true) : dockPoint();
    if (!info) return;
    if (isReduced()) { place(el, true); return; }
    const leaving = !entering && S.visible && S.mode !== 'hidden' && S.mode !== 'travel';
    S.travel = { target: el || null, info, t: 0, phase: leaving ? 'out' : 'in', page: onPage() };
    S.mode = 'travel';
    if (leaving) fx.dissolve(bodyHeight()); else beginEntrance();
    wake(1000);
  }
  function beginEntrance() {
    const tr = S.travel;
    resetLook();
    Object.assign(tr, { phase: 'in', t: 0, page: !!tr.target, style: styleFor(tr.target), landed: false });
    const key = tr.target?.closest('[data-section]')?.dataset.section || 'corner';
    returned = seen.has(key); seen.add(key);
    if (returned) tr.style = 'back'; // the show is for the first visit only
    if (tr.target) tr.info = measure(tr.target, true) || tr.info;
    tr.run = ENTRANCES[tr.style];
    window.dispatchEvent(new CustomEvent('host:teleport', { detail: tr.style }));
    S.x = tr.info.x; S.y = tr.info.y; S.scale = tr.info.scale;
    S.facing = S.facingTarget = anchor().x > innerWidth * .55 ? -.22 : .22;
    canvas.style.opacity = '0';
    position(); visibility();
    tr.run.start?.({ host, fx, h: bodyHeight(), top: anchor().y });
  }
  function resetLook() { S.spin = 0; canvas.style.transform = canvas.style.clipPath = canvas.style.filter = ''; host.ctx.jumpProgress = null; }
  function finishTravel() {
    const tr = S.travel;
    if (!tr) return;
    place(tr.target, true);
    const after = tr.run?.after;
    if (after && !isReduced()) { host.play(after); setTimeout(() => { if (S.mode !== 'travel' && host.state === after) host.play('idle'); }, 1300); }
  }
  function travel(dt) {
    const tr = S.travel; tr.t += dt;
    const f = feet(), h = bodyHeight();
    const look = ({ dx = 0, dy = 0, sx = 1, sy = 1, roll = 0, opacity = 1, spin = 0, clip = '', filter = '' }) => {
      S.spin = spin;
      canvas.style.opacity = String(opacity);
      // squash from the feet, somersault about the waist
      canvas.style.transformOrigin = `${f.x}px ${roll ? f.y - h / 2 : f.y}px`;
      canvas.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${roll.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      canvas.style.clipPath = clip; canvas.style.filter = filter;
    };
    if (tr.phase === 'out') {
      const p = Math.min(1, tr.t / .42), e = p * p;
      look({ sx: 1 - .82 * e, sy: 1 + .5 * e, dy: -30 * e, spin: e * 5, opacity: 1 - e, filter: `brightness(${1 + e * 2})` });
      if (p >= 1) beginEntrance();
      return;
    }
    const p = Math.min(1, tr.t / tr.run.duration);
    tr.run.frame({ p, t: tr.t, h, top: anchor().y, look, host, fx, land: () => { if (!tr.landed) { tr.landed = true; fx.impact(h); window.dispatchEvent(new CustomEvent('host:land')); } } });
    window.dispatchEvent(new CustomEvent('host:move'));
    if (p >= 1) finishTravel();
  }
  function frame(now) {
    raf = 0;
    if (!canRender()) { last = 0; return; }
    if (!isReduced() && last && now - last < (S.travel ? 12 : 32)) { raf = requestAnimationFrame(frame); return; }
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 30; last = now;
    if (S.travel) { if (isReduced()) finishTravel(); else travel(dt); }
    host.ctx.calm = isReduced();
    host.ctx.resting = !S.travel && now >= awakeUntil;
    if (lookOverride) { const p = headPoint(); host.lookAt((lookOverride.x - p.x) / 380, (p.y - lookOverride.y) / 380); }
    else if (pointer && !isReduced() && !S.travel) { // eyes and head follow the pointer, and her body turns a little
      const p = headPoint(), dx = pointer.x - p.x, dy = p.y - pointer.y;
      host.lookAt(dx / 320, dy / 320);
      S.facingTarget = clamp(dx / 700, -.55, .55);
    } else host.lookAt(0, 0);
    S.facing += (S.facingTarget - S.facing) * (isReduced() ? 1 : .18);
    host.group.rotation.y = S.facing + S.spin; host.group.scale.setScalar(S.scale / zoom);
    updating = true; host.update(dt); updating = false;
    renderer.render(scene, camera);
    if (!isReduced() && (S.travel || now < awakeUntil)) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function route() {
    if (!S.enabled || paused || document.hidden) return;
    if (host.state === 'walk') host.play('idle');
    const target = provider();
    if (target) {
      const i = measure(target, true);
      if (i && i.y - scrollY > 64 && i.y - scrollY - BODY_H * UNIT * i.scale < innerHeight - 30) { move(target); return; }
    }
    visibility();
    if (S.travel && !S.visible) { S.travel = null; S.mode = 'hidden'; }
    // Keep the guide available for the tour; this is the original small corner dock.
    if (!S.visible) move(null);
  }
  function relayout() {
    layoutFrame = 0;
    if (S.travel) { const i = S.travel.target ? measure(S.travel.target, true) : dockPoint(); if (i) S.travel.info = i; }
    else if (S.mode === 'perch') {
      const i = measure(S.perch, true); if (i) { S.x = i.x; S.y = i.y; S.scale = i.scale; }
    } else if (S.mode === 'dock') { const i = dockPoint(); S.x = i.x; S.y = i.y; S.scale = i.scale; }
    position(); visibility(); wake(); window.dispatchEvent(new CustomEvent('host:move'));
  }
  function requestLayout() { if (!layoutFrame) layoutFrame = requestAnimationFrame(relayout); }
  function noteScroll() {
    if (S.mode === 'perch' && S.perch?.dataset.perchTrail !== undefined) {
      const trail = cache.get(S.perch)?.trail;
      if (trail) {
        const progress = clamp((innerHeight * .85 - (trail.top - scrollY)) / (innerHeight * .7), .06, .94);
        const nextX = trail.left + trail.width * progress;
        S.facingTarget = nextX >= S.x ? .9 : -.9; S.x = nextX; position();
        if (!isReduced()) { host.ctx.walkSpeed = 9; host.play('walk'); }
      }
    }
    visibility();
    clearTimeout(settleTimer); settleTimer = setTimeout(route, 180);
    // A perched host moves with the document and needs no WebGL redraw during scrolling.
  }
  const stage = {
    host, renderer,
    get mode() { return S.mode; }, get visible() { return S.visible && S.enabled && !document.hidden; },
    get perch() { return S.perch; }, get scale() { return S.scale; }, get unit() { return UNIT; },
    anchor, headPoint, bodyHeight, side() { return anchor().x > innerWidth / 2 ? 'right' : 'left'; },
    onLand(fn) { lands.push(fn); }, setPerchProvider(fn) { provider = fn; }, pause(on) { paused = on; if (!on) route(); },
    look(pt) { lookOverride = pt; wake(1600); }, noteScroll,
    placeAt(el) { place(el); }, animate(ms) { wake(ms); }, walkIn(el) { S.travel = null; move(el, { entering: true }); }, travelTo: move, dock() { move(null); }, relayout: requestLayout,
    setFacing(v) { S.facingTarget = v; wake(); }, burst() { if (!isReduced()) { host.play('celebrate'); wake(1400); } },
    start() { S.enabled = true; if (S.mode === 'hidden') place(null); visibility(); wake(); clearTimeout(settleTimer); settleTimer = setTimeout(route, 2600); },
    stop() { S.enabled = false; cancel(); clearTimeout(settleTimer); container.hidden = true; },
    hide() { stage.stop(); S.travel = null; host.ctx.jumpProgress = null; host.stopTalking(); S.mode = 'hidden'; canvas.style.opacity = '1'; resetLook(); },
  };
  addEventListener('resize', requestLayout, { passive: true });
  addEventListener('scroll', noteScroll, { passive: true });
  addEventListener('load', requestLayout, { once: true }); document.fonts?.ready.then(requestLayout);
  addEventListener('site:section', () => { clearTimeout(settleTimer); settleTimer = setTimeout(route, 180); });
  addEventListener('site:motionchange', () => { cancel(); if (S.travel && isReduced()) finishTravel(); wake(); });
  document.addEventListener('visibilitychange', () => { cancel(); if (!document.hidden) { if (S.travel) finishTravel(); relayout(); route(); } });
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; pointer = { x: e.clientX, y: e.clientY }; if (S.enabled && S.visible && !isReduced()) wake(700); }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; wake(700); });
  hit.addEventListener('pointerenter', () => { // a little hop and a wave when the pointer reaches her
    if (isReduced() || S.travel) return;
    host.express('joy', 1.4);
    if (performance.now() - hopAt < 1500) return;
    hopAt = performance.now();
    canvas.animate([{ translate: '0 0' }, { translate: '0 -16px', easing: 'ease-in' }, { translate: '0 0' }], { duration: 420, easing: 'ease-out' });
    if (host.state === 'idle') { host.play('wave'); setTimeout(() => { if (host.state === 'wave') host.play('idle'); }, 1300); wake(1800); }
  });
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); stage.hide(); window.dispatchEvent(new CustomEvent('host:lost')); });
  canvas.addEventListener('webglcontextrestored', () => { relayout(); });
  return stage;
}
