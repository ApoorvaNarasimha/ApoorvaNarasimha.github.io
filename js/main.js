// Boot: content features first (they work without the host), then the host on top.
import { softLetters } from './fx.js';
import { sound } from './sound.js';
import { createPinNav } from './pinnav.js';
import { setupObjects } from './iso.js';
import { setupNetwork } from './network.js';
import { setupHunt } from './hunt.js';
import { setupCards, setupReveals } from './cards.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
document.documentElement.classList.add('js');

const PREF_KEY = 'apoorva.site.prefs';
const prefs = (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch (e) { return {}; } })();
const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ } };

// ------------------------------------------------------------ motion preference
const mq = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = prefs.reduced ?? mq.matches;
const isReduced = () => reduced;
function applyMotion() {
  document.documentElement.classList.toggle('motion-off', reduced);
  document.documentElement.classList.toggle('motion-on', !reduced && mq.matches); // an explicit "motion on" beats the OS setting
  $('#motion-toggle').setAttribute('aria-pressed', String(!reduced));
}
mq.addEventListener('change', (e) => { if (prefs.reduced === undefined) { reduced = e.matches; applyMotion(); } });
$('#motion-toggle').addEventListener('click', () => {
  reduced = !reduced;
  if (reduced === mq.matches) delete prefs.reduced; else prefs.reduced = reduced; // matching the OS means: follow the OS again
  savePrefs(); applyMotion();
});
applyMotion();

// ------------------------------------------------------------ sound (on unless turned off; silent until the first click, tap or key)
let soundWanted = prefs.sound ?? true;
function applySound() { $('#sound-toggle').setAttribute('aria-pressed', String(soundWanted)); }
$('#sound-toggle').addEventListener('click', () => { soundWanted = !soundWanted; sound.set(soundWanted); prefs.sound = soundWanted; savePrefs(); applySound(); sound.chime(); });
// Browsers only let audio start from a gesture: unlock on the first click, key or touch.
if (soundWanted) for (const ev of ['click', 'keydown', 'touchend']) addEventListener(ev, () => { if (soundWanted) sound.set(true); }, { once: true, capture: true });
applySound();
addEventListener('host:teleport', (e) => sound.phrase(e.detail)); // a short phrase every time she appears somewhere
addEventListener('click', (e) => { if (e.target.closest('.block')) sound.click(); });

// ------------------------------------------------------------ sections, topbar, pin nav
const sections = $$('[data-section]');
const topbar = $('#topbar');
const pinEl = $('#pinnav');
const pinNav = createPinNav(pinEl);
setupObjects();
let active = null;
function themeOf(sec) {
  for (const t of ['blue', 'cream', 'ink', 'tech', 'lilac']) if (sec.classList.contains('field--' + t)) return t;
  return 'blue';
}
function setActive(id) {
  if (id === active) return;
  active = id;
  const sec = document.getElementById(id);
  topbar.dataset.theme = pinEl.dataset.theme = themeOf(sec);
  
  pinNav.select(id);
}
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) setActive(e.target.dataset.section);
}, { rootMargin: '-42% 0px -55% 0px' });
sections.forEach((s) => io.observe(s));
setActive('start');

function focusHeading(el, delay) {
  const focusTarget = el.querySelector('h2, h1');
  if (focusTarget) { focusTarget.tabIndex = -1; setTimeout(() => focusTarget.focus({ preventScroll: true }), delay); }
}
// Every jump is one long eased glide, so the particles and colours blend on the way. Any input from
// the visitor takes over at once.
let glideId = 0;
const easeInOut = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
function glideTo(el) {
  const id = ++glideId, from = scrollY, dest = () => Math.max(0, Math.min(el.getBoundingClientRect().top + scrollY - topbar.offsetHeight, document.documentElement.scrollHeight - innerHeight));
  if (reduced) { scrollTo({ top: dest(), behavior: 'instant' }); return Promise.resolve(); }
  const ms = Math.min(2200, 900 + Math.abs(dest() - from) * 0.16);
  return new Promise((resolve) => {
    let t0 = 0;
    const stop = () => { if (id === glideId) glideId++; };
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const done = () => { evs.forEach((e) => removeEventListener(e, stop)); resolve(); };
    evs.forEach((e) => addEventListener(e, stop, { passive: true }));
    const step = (now) => {
      if (id !== glideId) return done();
      t0 ||= now;
      const t = Math.min(1, (now - t0) / ms);
      scrollTo({ top: from + (dest() - from) * easeInOut(t), behavior: 'instant' });
      if (t < 1) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
}
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  focusHeading(el, 0);
  glideTo(el);
}
function jumpTo(id) {
  const sec = document.getElementById(id);
  if (!sec) return;
  if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
  focusHeading(sec, 0);
  return glideTo(sec);
}
const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
pinNav.links.forEach((a) => a.addEventListener('click', (e) => { if (!plainClick(e)) return; e.preventDefault(); jumpTo(a.dataset.map); }));
$('.brand').addEventListener('click', (e) => { if (!plainClick(e)) return; e.preventDefault(); jumpTo('start'); });

// mobile menu
const menuBtn = $('#menu-button'), menu = $('#mobile-menu');
function setMenu(open, { refocus = false } = {}) {
  menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
  if (open) menu.querySelector('a')?.focus();
  else if (refocus) menuBtn.focus();
}
menuBtn.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (link && plainClick(e)) { e.preventDefault(); setMenu(false); jumpTo(link.hash.slice(1)); }
  else if (link) setMenu(false);
});
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false, { refocus: true }); });
matchMedia('(min-width: 1141px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

// ------------------------------------------------------------ soft type
const heroSquish = $('[data-squish]');
softLetters(heroSquish, { radius: 170 });
$$('main h2 > span').forEach((el) => softLetters(el, { radius: 110 }));

// ------------------------------------------------------------ content features
new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))).then(() => import('./particles.js')).then((p) => p.setupParticles({ sections, themeOf, isReduced })).catch(() => {}); // decoration: the page works without it
setupCards($$('.stack-card'), { isReduced });
setupHunt({ sound });
setupNetwork($('#network'), { isReduced });
setupReveals($$('.planned li, .network, .timeline li, .ach-list li'));
// In-page links that move like the nav: the hero's buttons.
$$('a[data-jump]').forEach((a) => a.addEventListener('click', (e) => { if (!plainClick(e)) return; e.preventDefault(); jumpTo(a.hash.slice(1)); }));

// contact links appear only when they are configured in index.html (data-* on #contact-actions)
(function contactLinks() {
  const box = $('#contact-actions');
  const links = [
    ['email', (v) => `mailto:${v}`, 'email me'], ['linkedin', (v) => v, 'linkedin'],
    ['scholar', (v) => v, 'publications'], ['cv', (v) => v, 'download my cv'],
  ];
  for (const [key, href, label] of links) {
    const v = (box.dataset[key] || '').trim();
    if (!v) continue;
    const a = document.createElement('a');
    a.className = 'block ' + (key === 'email' ? 'block--tangerine' : 'block--cream');
    a.href = href(v); a.textContent = label;
    if (!href(v).startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
    box.appendChild(a);
  }
})();

// ------------------------------------------------------------ the host
const replayBtn = $('#replay-tour'); // the tour runs only when asked for, here or from her menu
let director = null, setGuide = null; // set once the host has booted
replayBtn.addEventListener('click', () => { scrollToSection('start'); setTimeout(() => director?.replayTour(), reduced ? 50 : 800); });

let portraitPainted = false;
async function bootHost({ force = false } = {}) {
  let mod;
  try { mod = await import('./host/apoorva.js'); } catch (e) { return; }
  if (!portraitPainted) { paintPortrait(mod.drawSprite); portraitPainted = true; }
  if (prefs.guide === false && !force) { setGuideUI(false); return; }
  let stageMod, bubbleMod, directorMod;
  try {
    [stageMod, bubbleMod, directorMod] = await Promise.all([import('./host/stage.js'), import('./host/bubble.js'), import('./host/director.js')]);
  } catch (e) { return fallbackHost(mod.drawSprite); }
  const stage = stageMod.createStage({ container: $('#host'), canvas: $('#host-canvas'), hit: $('#host-hit'), isReduced });
  if (!stage) return fallbackHost(mod.drawSprite);
  const bubble = bubbleMod.createBubble({ el: $('#bubble'), text: $('#bubble-text'), options: $('#bubble-options'), close: $('#bubble-close'), live: $('#host-live'), stage, isReduced, home: $('#host-hit') });
  director = directorMod.createDirector({
    stage, bubble, isReduced, scrollToSection,
    getActiveSection: () => active,
    onHide: () => setGuide(false),
  });
  setInterval(() => { if (bubble.open) bubble.place(); }, 160);
  $('#host-hit').addEventListener('click', () => director.poke());
  addEventListener('hunt:done', () => stage.burst());
  addEventListener('host:lost', () => { setGuideUI(false); });

  let guideGen = 0; // each toggle supersedes the previous one, so quick off/on cannot strand her
  setGuide = async (on) => {
    const gen = ++guideGen;
    prefs.guide = on; savePrefs(); setGuideUI(on);
    if (!on) {
      bubble.hide();
      if (!reduced) { stage.host.setInflate(0.03); await new Promise((r) => setTimeout(r, 260)); if (gen !== guideGen) return; }
      stage.hide();
    } else {
      const wasHidden = stage.mode === 'hidden';
      stage.start();
      stage.host.setInflate(1, true);
      if (wasHidden) { if (reduced) stage.placeAt(null); else stage.walkIn(null); } // she walks in from the edge
      director.hello();
    }
  };
  setGuideUI(true);
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  stage.relayout();
  if (!force) director.arrive();
  else if (prefs.guide !== false) setGuide(true); // still wanted once the modules arrived
  else { stage.hide(); setGuideUI(false); }
}

function setGuideUI(on) {
  $('#guide-toggle').setAttribute('aria-pressed', String(on));
  $('#host-recall').hidden = on;
}
let lateBoot = null; // the one boot started by the toggle when she was off at page load
$('#guide-toggle').addEventListener('click', () => {
  const on = $('#guide-toggle').getAttribute('aria-pressed') !== 'true';
  if (setGuide) { setGuide(on); return; }
  prefs.guide = on; savePrefs(); setGuideUI(on);
  if (on && !lateBoot) lateBoot = bootHost({ force: true });
});
$('#host-recall').addEventListener('click', () => $('#guide-toggle').click());

// No WebGL: she stays a flat pixel sprite standing on the headline. That's on brand.
let fallbackShown = false;
function fallbackHost(drawSprite) {
  if (fallbackShown) return;
  fallbackShown = true;
  const host = $('#host');
  const sprite = drawSprite(document.createElement('canvas'), { scale: 4, expression: 'happy' });
  sprite.className = 'host-sprite';
  const scale = innerWidth < 640 ? 0.42 : 0.62;
  Object.assign(sprite.style, { position: 'absolute', width: sprite.width * scale + 'px', imageRendering: 'pixelated', left: -(sprite.width * scale) / 2 + 'px', top: -sprite.height * scale + 'px' });
  $('#host-canvas').replaceWith(sprite);
  $('#host-hit').remove();
  const place = () => {
    // phones: on a letter of her name; larger screens: on the floor of the empty spot beside the hero card
    const letter = innerWidth <= 640 && $('[data-perch-mobile="start"] .ch:nth-of-type(4)');
    const r = (letter || $('[data-perch="start"]')).getBoundingClientRect();
    host.style.transform = `translate(${r.left + r.width / 2 + scrollX}px, ${(letter ? r.top + r.height * 0.28 : r.bottom - 12) + scrollY}px)`;
  };
  host.hidden = false; place();
  addEventListener('resize', place);
  setGuide = (on) => { prefs.guide = on; savePrefs(); setGuideUI(on); host.hidden = !on; };
  setGuideUI(true);
}

// Her portrait in the phone speech box is cut from the same model as the 3D host.
function paintPortrait(drawSprite) {
  const full = drawSprite(document.createElement('canvas'), { scale: 1, expression: 'happy' });
  const U = 0.375, W = 8, Htop = 31.5;
  const sx = Math.round((W - 5.4) / U), sy = Math.round((Htop - 31.4) / U), sw = Math.round(10.8 / U), sh = Math.round(10.2 / U);
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
  $('#bubble-portrait').src = c.toDataURL();
}

// Her 3D code waits until the page itself is painted and quiet.
const idle = window.requestIdleCallback ? (fn) => requestIdleCallback(fn, { timeout: 1200 }) : (fn) => setTimeout(fn, 200);
idle(() => bootHost());
