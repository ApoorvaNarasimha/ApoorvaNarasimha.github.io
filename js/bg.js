// The calm background below the hero, in place of the old particles: a thin plotted signal across
// a few sections, like a sensor reading or a training curve. It draws itself once when it comes
// into view, and is simply there with Motion off.

const SECTIONS = [
  { id: 'projects', label: 'ch 01 · strain', kind: 'sensor', at: 'top' },
  { id: 'next', label: 'val loss', kind: 'loss', at: 'top' },
  { id: 'contact', label: 'gaze x', kind: 'steps', at: 'top' },
];

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function signal(kind, n) {
  const r = rng(kind.length * 97 + 7), out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let y;
    if (kind === 'sensor') { // bends: a baseline with slow drift and a few press-and-release bumps
      const bump = (c, w, h) => h * Math.exp(-((t - c) ** 2) / (2 * w * w));
      y = 0.08 * Math.sin(t * 9) + bump(0.22, 0.025, 0.7) + bump(0.48, 0.03, 0.5) + bump(0.71, 0.02, 0.85) + (r() - 0.5) * 0.05;
    } else if (kind === 'loss') { // a training curve settling, with noise
      y = 0.95 * Math.exp(-t * 4.2) + 0.08 + (r() - 0.5) * 0.06 * (1 - t * 0.6);
    } else { // fixations: the gaze holds, then jumps
      y = [0.2, 0.62, 0.35, 0.8, 0.5, 0.15, 0.7][Math.min(6, Math.floor(t * 7))] + (r() - 0.5) * 0.03;
    }
    out.push(y);
  }
  const lo = Math.min(...out), hi = Math.max(...out);
  return out.map((v) => (v - lo) / (hi - lo || 1));
}

function trace(sec, cfg, isReduced) {
  const W = 1000, H = 120, N = 220;
  const ys = signal(cfg.kind, N);
  const pts = ys.map((v, i) => `${(i / (N - 1) * W).toFixed(1)},${(H - 14 - v * (H - 34)).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: 11 }, (_, i) => `<line x1="${i * 100}" x2="${i * 100}" y1="${H - 4}" y2="${H}" />`).join('');
  const el = document.createElement('div');
  el.className = `bg-trace bg-trace--${cfg.at}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<span class="bg-trace-label">${cfg.label}</span>`
    + `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g class="bg-trace-ticks">${ticks}</g><polyline pathLength="1" points="${pts}" /></svg>`;
  sec.prepend(el);
  if (isReduced()) { el.classList.add('is-drawn'); return; }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-drawn'); io.disconnect(); } }, { threshold: 0.4 });
  io.observe(el);
}

export function setupBackground({ isReduced }) {
  SECTIONS.forEach((c) => { const s = document.getElementById(c.id); if (s) trace(s, c, isReduced); });
}
