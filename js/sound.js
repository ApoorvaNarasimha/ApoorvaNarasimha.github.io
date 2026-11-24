// Synthesised sound: teleport music, speech blips and clicks. On by default, but browsers keep it silent
// until the visitor first clicks, taps or presses a key; the Sound button in the top bar turns it off.
let ctx = null, on = false, master = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.06; master.connect(ctx.destination);
  return ctx;
}

function tone(freq, { at = 0, dur = 0.06, type = 'square', slide = 0, gain = 1 } = {}) {
  if (!on || !ensure()) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}

// Teleport music: one tiny phrase per entrance, all in the same key (D major pentatonic) so they belong
// together. Each is [start, midi note, length] triples and ends inside two seconds.
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const PHRASES = {
  drop: { sweep: [1400, 130, 0.6], notes: [[0.63, 50, 0.5], [0.63, 62, 0.35], [0.82, 69, 0.3], [0.98, 74, 0.35], [1.14, 78, 0.65]] },
  assemble: { sweep: [180, 1100, 1.2], notes: [[0, 62, 0.12], [0.13, 66, 0.12], [0.26, 69, 0.12], [0.39, 62, 0.12], [0.52, 71, 0.12], [0.65, 74, 0.12], [0.78, 69, 0.12], [0.91, 76, 0.12], [1.04, 78, 0.14], [1.2, 81, 0.6], [1.2, 74, 0.6]] },
  beam: { sweep: [300, 1500, 0.9], notes: [[0, 50, 1.4], [0.1, 57, 1.4], [0.3, 66, 1.1], [0.5, 69, 1.0], [0.7, 74, 0.9], [0.95, 78, 0.8], [1.2, 81, 0.65]] },
  flip: { sweep: [500, 1300, 0.45], notes: [[0, 62, 0.14], [0.14, 66, 0.14], [0.28, 69, 0.14], [0.42, 74, 0.14], [0.56, 78, 0.16], [0.9, 81, 0.2], [1.06, 78, 0.16], [1.2, 86, 0.6], [1.2, 74, 0.6]] },
  spring: { sweep: [220, 900, 0.35], notes: [[0, 57, 0.14], [0.16, 62, 0.14], [0.32, 69, 0.16], [0.6, 74, 0.5]] },
  back: { notes: [[0, 69, 0.12], [0.11, 74, 0.14], [0.22, 78, 0.45]] },
};
let phraseOut = null; // the phrase that is playing, so a new one can take over softly
function phrase(name) {
  if (!on || !ensure() || ctx.state !== 'running') return 0;
  const p = PHRASES[name] || PHRASES.back, t0 = ctx.currentTime + 0.02;
  if (phraseOut) phraseOut.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  const out = ctx.createGain(), soft = ctx.createBiquadFilter();
  out.gain.value = 0.11; soft.type = 'lowpass'; soft.frequency.value = 3600;
  soft.connect(out).connect(ctx.destination);
  phraseOut = out;
  let end = 0;
  const voice = (type, f, at, dur, gain, to) => {
    const o = ctx.createOscillator(), g = ctx.createGain(), t = t0 + at;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(soft); o.start(t); o.stop(t + dur);
    end = Math.max(end, at + dur);
  };
  if (p.sweep) voice('sine', p.sweep[0], 0, p.sweep[2], 0.22, p.sweep[1]);
  for (const [at, n, dur] of p.notes) { voice('triangle', hz(n), at, dur, 0.5); voice('sine', hz(n + 12), at, dur * 0.7, 0.14); }
  setTimeout(() => { out.disconnect(); if (phraseOut === out) phraseOut = null; }, end * 1000 + 250);
  return end;
}

export const sound = {
  phrase,
  get on() { return on; },
  set(v) { on = v; if (on && ensure() && ctx.state === 'suspended') ctx.resume(); },
  // speech: one soft blip per couple of characters, pitch nudged by the letter
  blip(ch) { if (!/[a-z0-9]/i.test(ch)) return; tone(420 + (ch.toLowerCase().charCodeAt(0) % 12) * 18, { dur: 0.045, gain: 0.55 }); },
  chime() { [660, 880, 1320].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.12, gain: 0.7 })); },
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.14, gain: 0.7 })); },
  boing() { tone(220, { dur: 0.18, slide: 2.4, type: 'triangle', gain: 0.9 }); },
  land() { tone(140, { dur: 0.08, slide: 0.6, type: 'triangle', gain: 0.8 }); },
  click() { tone(880, { dur: 0.03, gain: 0.5 }); },
  wrong() { tone(330, { dur: 0.1 }); tone(247, { at: 0.1, dur: 0.16 }); },
  pump() { tone(180 + Math.random() * 30, { dur: 0.05, type: 'sawtooth', gain: 0.25 }); },
};
