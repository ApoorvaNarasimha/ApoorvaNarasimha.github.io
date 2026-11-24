// How the guide arrives. Each entrance is a short performance over p = 0..1: frame() poses the canvas
// with look(), and calls land() once at the moment she touches down.
export const ENTRANCE = { start: 'drop', projects: 'assemble', next: 'beam', contact: 'flip' };

const clamp = (v) => Math.max(0, Math.min(1, v));
const out3 = (t) => 1 - (1 - t) ** 3;
const seg = (p, a, b) => clamp((p - a) / (b - a));
// a damped squash after landing: wide and short, then tall, then still
const squash = (t, amount) => { const w = Math.exp(-5 * t) * Math.cos(t * 15) * amount; return { sx: 1 + w, sy: 1 - w }; };

export const ENTRANCES = {
  // falls out of the sky, hits the ground hard, springs back up
  drop: {
    duration: 1.5, after: 'wave',
    start({ host }) { host.play('jump'); },
    frame({ p, h, top, look, host, land }) {
      const fall = seg(p, 0, .42);
      if (fall < 1) { host.ctx.jumpProgress = .45 + fall * .3; look({ dy: -(top + h * .2) * (1 - fall * fall), sx: 1 - .16 * fall, sy: 1 + .26 * fall, opacity: clamp(fall * 6) }); return; }
      land();
      if (host.state === 'jump') { host.ctx.jumpProgress = null; host.play('surprised'); }
      const t = seg(p, .42, 1), hop = seg(t, .16, .52);
      look({ ...squash(t, .36), dy: -Math.sin(hop * Math.PI) * h * .13 });
    },
  },
  // pixels rush in, and she is scanned into place from the feet up with a few glitches
  assemble: {
    duration: 1.9, after: 'stretch',
    start({ fx, h }) { fx.gather(h); },
    frame({ p, t, h, look, land, fx }) {
      const scan = seg(p, .18, .72), settle = seg(p, .72, 1), glitch = scan > 0 && scan < 1;
      const jolt = glitch && Math.sin(t * 61) > .55 ? (Math.sin(t * 97) > 0 ? 1 : -1) * 9 : 0;
      fx.scan(glitch ? scan * h * 1.02 : -1);
      if (settle > 0) land();
      // the canvas is taller than she is: its feet line sits near the bottom, so clip in page pixels from there
      look({ dx: jolt, opacity: scan > 0 ? (glitch && Math.sin(t * 83) > .8 ? .45 : 1) : 0, clip: scan < 1 ? `inset(calc(100% - ${(40 + scan * (h + 40)).toFixed(0)}px) 0 0 0)` : '', filter: glitch ? `brightness(${1.5 - scan * .4}) drop-shadow(${jolt ? -jolt : 3}px 0 0 rgba(56,225,255,.75)) drop-shadow(${jolt || -3}px 0 0 rgba(255,77,120,.55))` : `brightness(${1 + (1 - settle) * .8})` });
    },
  },
  // a column of light opens and she spins down through it
  beam: {
    duration: 2.2, after: 'lookAround',
    start({ fx }) { fx.beam(2.1); },
    frame({ p, h, look, land }) {
      const down = out3(seg(p, .16, .78)), settle = seg(p, .78, 1);
      if (settle > 0) land();
      look({ dy: -(1 - down) * h * 1.25, spin: (1 - down) * Math.PI * 5, opacity: seg(p, .16, .34), filter: `brightness(${(1 + (1 - down) * 1.8 + (1 - settle) * .25).toFixed(2)}) drop-shadow(0 0 ${((1 - settle) * 16).toFixed(0)}px rgba(56,225,255,.9))`, ...(settle ? squash(settle, .16) : {}) });
    },
  },
  // a running somersault in from the side, stuck like a gymnast
  flip: {
    duration: 1.8, after: 'celebrate',
    start({ host }) { host.play('jump'); },
    frame({ p, h, look, host, land }) {
      const air = seg(p, 0, .56);
      if (air < 1) { host.ctx.jumpProgress = .2 + air * .6; look({ dx: (1 - air) * Math.min(innerWidth * .34, 460), dy: -Math.sin(air * Math.PI) * h * 1.15, roll: -720 * air * (2 - air), opacity: clamp(air * 5) }); return; }
      land();
      if (host.state === 'jump') { host.ctx.jumpProgress = null; host.play('celebrate'); }
      look(squash(seg(p, .56, 1), .3));
    },
  },
  // every return: a light hop out of a half turn
  back: {
    duration: .75,
    frame({ p, look, land }) {
      const up = seg(p, 0, .6);
      if (p > .6) land();
      look({ dy: (1 - out3(up)) * 26 - Math.sin(up * Math.PI) * 22, spin: (1 - out3(up)) * -2.2, opacity: clamp(p * 4), ...(p > .6 ? squash(seg(p, .6, 1), .12) : {}) });
    },
  },
  // the corner: launched up from below the screen, twisting, then down onto her feet
  spring: {
    duration: 1.4,
    start({ host }) { host.play('jump'); },
    frame({ p, h, look, host, land }) {
      const up = seg(p, 0, .34), down = seg(p, .34, .62);
      if (down < 1) { host.ctx.jumpProgress = .2 + (up + down) * .3; look({ dy: up < 1 ? h * 1.3 - out3(up) * h * 2.2 : -h * .9 * (1 - down * down), spin: (up + down) * Math.PI, sy: 1 + .22 * (1 - up), sx: 1 - .1 * (1 - up) }); return; }
      land();
      if (host.state === 'jump') { host.ctx.jumpProgress = null; host.play('idle'); }
      look({ ...squash(seg(p, .62, 1), .28) });
    },
  },
};

// Light, dust and pixels around her. Everything is a throwaway element inside her own container.
const COLORS = ['#38e1ff', '#ffd21f', '#ff6b7a', '#2ed573', '#9b8cff'];
export function createFx(container) {
  const box = document.createElement('div');
  box.className = 'host-fx'; box.setAttribute('aria-hidden', 'true');
  container.prepend(box);
  const bar = document.createElement('i'); bar.className = 'host-scan'; bar.hidden = true; box.append(bar);
  const put = (cls, frames, opts) => {
    const e = document.createElement('i'); e.className = cls; box.append(e);
    e.animate(frames, { fill: 'both', ...opts }).finished.then(() => e.remove(), () => e.remove());
    return e;
  };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pixel = (from, to, opts) => { const e = put('host-pixel', [{ transform: `translate(${from[0]}px, ${from[1]}px) scale(${from[2] ?? 1})`, opacity: from[3] ?? 1 }, { transform: `translate(${to[0]}px, ${to[1]}px) scale(${to[2] ?? 1})`, opacity: to[3] ?? 0 }], opts); e.style.background = COLORS[(Math.random() * COLORS.length) | 0]; };
  return {
    impact(h = 180) {
      const k = Math.max(1, h / 200);
      put('host-ring', [{ transform: 'translate(-50%, -50%) scale(.1)', opacity: 1 }, { transform: `translate(-50%, -50%) scale(${k.toFixed(2)})`, opacity: 0 }], { duration: 750, easing: 'cubic-bezier(.16, 1, .3, 1)' });
      for (let i = 0; i < 20; i++) { const a = rnd(Math.PI * 1.02, Math.PI * 1.98), d = rnd(40, 130) * k; pixel([0, 0], [Math.cos(a) * d * 1.3, Math.sin(a) * d * .7, .2], { duration: rnd(500, 950), easing: 'cubic-bezier(.16, 1, .3, 1)' }); }
    },
    gather(h) {
      for (let i = 0; i < 54; i++) { const a = rnd(0, Math.PI * 2), d = rnd(140, 280); pixel([Math.cos(a) * d, -h / 2 + Math.sin(a) * d * .8, 1.6, 0], [rnd(-h * .16, h * .16), -rnd(0, h), .7, 1], { duration: rnd(600, 1000), delay: rnd(0, 420), easing: 'cubic-bezier(.6, 0, .3, 1)' }); }
    },
    dissolve(h) {
      for (let i = 0; i < 26; i++) { const x = rnd(-h * .2, h * .2), y = -rnd(0, h); pixel([x, y, 1.2], [x + rnd(-30, 30), y - rnd(60, 150), .2], { duration: rnd(450, 800), delay: rnd(0, 200), easing: 'ease-out' }); }
    },
    beam(s) {
      put('host-beam', [{ transform: 'translateX(-50%) scaleX(.02)', opacity: 0 }, { transform: 'translateX(-50%) scaleX(1)', opacity: 1, offset: .16 }, { transform: 'translateX(-50%) scaleX(.9)', opacity: .85, offset: .72 }, { transform: 'translateX(-50%) scaleX(0)', opacity: 0 }], { duration: s * 1000, easing: 'ease-in-out' });
      for (let i = 0; i < 24; i++) pixel([rnd(-44, 44), 0, 1, 1], [rnd(-44, 44), -rnd(160, 340), .4], { duration: rnd(800, 1400), delay: rnd(150, 900), easing: 'ease-out' });
    },
    scan(y) { bar.hidden = y < 0; if (y >= 0) bar.style.transform = `translate(-50%, ${-y}px)`; },
  };
}
