// The director: Apoorva's behaviour. It decides where she goes, what she says, and how she
// reacts. She never speaks unprompted: only when clicked, or on a tour the visitor started.
import { SECTIONS, ORDER, NAMES, JOKES, REACTIONS } from './lines.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createDirector({ stage, bubble, getActiveSection, isReduced, scrollToSection, onHide }) {
  const host = stage.host;
  const S = {
    tour: false, introduced: new Set(), lastInput: performance.now(), idleLevel: 0, pokes: [],
    lastLine: 0, jokes: shuffle(JOKES), asleep: false,
    section: 'start',
  };

  function perchFor(id) {
    const sec = document.getElementById(id);
    if (!sec) return null;
    const mobile = matchMedia('(max-width: 640px)').matches;
    return (mobile && sec.querySelector(`[data-perch-mobile="${id}"]`)) || sec.querySelector(`[data-perch="${id}"]`);
  }
  stage.setPerchProvider(() => perchFor(getActiveSection()));

  // Poses that carry their own meaning; talking should not overwrite them.
  const ACTING = ['dance', 'celebrate', 'wave', 'laugh', 'shrug', 'surprised', 'jump', 'walk', 'sit', 'sleep'];
  async function speak(line, opts = {}) {
    if (stage.mode === 'hidden') return 'hidden'; // a hidden guide stays silent, for eyes and screen readers alike
    // Background chatter never replaces a bubble that is waiting for the visitor's answer.
    if (bubble.awaitingChoice && !(opts.choices && opts.choices.length) && !opts.force) return 'skipped';
    S.lastLine = performance.now();
    if (!opts.pose && !ACTING.includes(host.state)) host.play(host.prop ? 'hold' : 'talk');
    const res = await bubble.say(line, opts);
    if (['talk', 'hold'].includes(host.state)) host.play('idle');
    return res;
  }
  // ------------------------------------------------------------ arrival
  async function arrive() {
    // Greet from wherever the visitor landed: the hero, or the corner on a deep link.
    const heroPerch = getActiveSection() === 'start' && scrollY < innerHeight * 0.5 ? perchFor('start') : null;
    if (isReduced()) { stage.placeAt(heroPerch); stage.start(); host.setInflate(1, true); }
    else {
      host.setInflate(1, true);
      stage.start();
      stage.walkIn(heroPerch);
      return; // the entrance ends with its own wave
    }
    host.play('wave');
    await wait(700);
    host.play('idle');
  }

  // ------------------------------------------------------------ tour
  async function startTour() {
    if (stage.mode === 'hidden') { scrollToSection('projects'); return; }
    S.tour = true;
    S.introduced = new Set(['start']);
    const res = await speak(REACTIONS.tourStart, { express: 'happy', choices: [{ label: REACTIONS.nextStop, value: 'next', primary: true }] });
    if (res === 'closed') S.tour = false;
    if (res === 'next') scrollToSection('projects'); // the page only moves when the visitor asks it to
  }
  function nextAfter(id) { const i = ORDER.indexOf(id); return ORDER[Math.min(ORDER.length - 1, i + 1)]; }

  // Between visits she keeps busy: a greeting when you come back, then a gesture every few seconds while in view.
  const GESTURES = { start: ['wave', 'dance', 'lookAround'], projects: ['point', 'think', 'lookAround', 'clip'], next: ['think', 'lookAround', 'stretch', 'point'], contact: ['wave', 'celebrate', 'dance'], corner: ['wave', 'lookAround', 'stretch', 'clip', 'shrug'] };
  const HOLD = { lookAround: 3400, dance: 3000, stretch: 2400, clip: 2300, think: 2600, point: 2000 };
  let nextGesture = 0, lastGesture = '';
  function gesture(name) {
    const ms = HOLD[name] || 1600;
    lastGesture = name;
    nextGesture = performance.now() + ms + 2600 + Math.random() * 2400;
    if (name === 'point') host.pointAt?.(.5);
    host.play(name); stage.animate(ms + 500);
    setTimeout(() => { if (host.state === name && !S.idleLevel) host.play('idle'); }, ms);
  }
  setInterval(() => {
    if (isReduced() || !stage.visible || stage.mode === 'travel' || stage.mode === 'hidden' || bubble.open || S.idleLevel || host.state !== 'idle') return;
    if (performance.now() < nextGesture) return;
    const set = GESTURES[stage.mode === 'dock' ? 'corner' : getActiveSection()] || GESTURES.corner;
    gesture(pick(set.filter((g) => g !== lastGesture)));
  }, 400);

  stage.onLand(async (el, { returned } = {}) => {
    nextGesture = performance.now() + 2600;
    if (returned && !isReduced() && !S.tour && !bubble.open) { host.express('joy', 1.8); setTimeout(() => { if (stage.mode !== 'travel' && host.state === 'idle') gesture(pick(['wave', 'celebrate', 'laugh'])); }, 120); }
    if (!el) return; // docked
    const secEl = el.closest('[data-section]');
    if (!secEl) return;
    const id = secEl.dataset.section;
    S.section = id;
    const cfg = SECTIONS[id];
    host.setProp(cfg.prop || null);
    if (S.introduced.has(id)) return;
    S.introduced.add(id);
    if (S.tour) {
      const nxt = nextAfter(id);
      const choices = id === 'contact'
        ? [{ label: 'back to the start', value: 'start', primary: true }, { label: 'keep exploring', value: 'stay' }]
        : [{ label: `${REACTIONS.nextStop}: ${NAMES[nxt]}`, value: nxt, primary: true }, { label: "I'll stay here", value: 'stay' }];
      const res = await speak(cfg.tour, { choices });
      if (res && res !== 'stay' && ORDER.includes(res)) { if (res === 'start') S.tour = false; scrollToSection(res); }
      if (id === 'contact' || res === 'stay' || res === 'closed') S.tour = false;
    }
  });

  // ------------------------------------------------------------ menu, jokes
  async function tellJoke() {
    const j = S.jokes.shift(); S.jokes.push(j);
    await speak(j, { express: 'happy', hold: Math.max(4200, j.length * 60) });
    host.play('laugh'); await wait(1300); host.play('idle');
  }
  async function menu() {
    const res = await speak(REACTIONS.menu, {
      express: 'curious', focus: true,
      choices: [
        { label: 'show me around', value: 'tour', primary: true },
        { label: 'a joke', value: 'joke' },
        { label: 'take me somewhere', value: 'go' },
        { label: 'hide for now', value: 'hide' },
      ],
    });
    if (res === 'joke') return tellJoke();
    if (res === 'tour') return startTour();
    if (res === 'hide') return onHide();
    if (res === 'go') {
      const here = getActiveSection();
      const where = await speak('Where to?', { focus: true, choices: ORDER.filter((id) => id !== here).map((id) => ({ label: NAMES[id], value: id })) });
      if (ORDER.includes(where)) scrollToSection(where);
    }
  }

  function poke() {
    wake();
    const now = performance.now();
    S.pokes = S.pokes.filter((t) => now - t < 2200); S.pokes.push(now);
    if (S.pokes.length >= 4) { S.pokes = []; host.play('laugh'); setTimeout(() => host.play('idle'), 1400); speak(REACTIONS.pokeSpam, { express: 'laugh', force: true }); return; }
    if (bubble.open) { host.express('joy', 1); return; }
    if (S.pokes.length >= 2) { host.express('joy', 1.4); speak(pick(REACTIONS.poke), { hold: 2200 }); return; }
    menu();
  }

  // ------------------------------------------------------------ idle life
  function input() {
    S.lastInput = performance.now();
    if (S.idleLevel) wake();
  }
  function wake() {
    if (S.asleep) {
      S.asleep = false; host.express('surprised', 1.0); host.play('idle');
    } else if (S.idleLevel && ['sit', 'clip', 'stretch', 'lookAround'].includes(host.state)) host.play('idle');
    S.idleLevel = 0;
  }
  setInterval(() => {
    if (stage.mode === 'hidden' || stage.mode === 'travel' || bubble.open) return;
    const idle = (performance.now() - S.lastInput) / 1000;
    if (idle > 120 && S.idleLevel < 3) { S.idleLevel = 3; S.asleep = true; host.play('sleep'); return; }
    if (idle > 55 && S.idleLevel < 2) { S.idleLevel = 2; host.play('sit'); return; }
    if (idle > 16 && S.idleLevel < 1) {
      S.idleLevel = 1;
      const f = pick(['clip', 'lookAround', 'stretch']);
      host.play(f);
      setTimeout(() => { if (S.idleLevel === 1 && host.state === f) host.play('idle'); }, f === 'lookAround' ? 3800 : 2400);
    }
  }, 1000);
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, input, { passive: true });
  addEventListener('pointermove', () => { S.lastInput = performance.now(); }, { passive: true });
  addEventListener('scroll', () => { S.lastInput = performance.now(); if (S.idleLevel) wake(); }, { passive: true });

  return {
    arrive, startTour, poke, menu,
    replayTour() { S.introduced = new Set(); startTour(); },
    hello() { host.play('wave'); setTimeout(() => host.play('idle'), 1400); },
  };
}
