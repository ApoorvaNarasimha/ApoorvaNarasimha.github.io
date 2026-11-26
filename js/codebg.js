// Faint columns of code behind the hero, taken from the kind of code behind the projects on this page.
// The columns drift upward very slowly; every few seconds one line is retyped a little brighter.
// With Motion off everything holds still and nothing is retyped.

const SNIPPETS = [
  // MorphMind: predicting soft-widget deformation from motion capture
  `# morphmind/predict.py
import numpy as np
from sklearn.model_selection import GroupKFold
from sklearn.ensemble import GradientBoostingRegressor

FPS = 500
FRAMES = 5000

def load_take(path):
    markers = np.load(path)["markers"]   # (frames, n, 3)
    return markers[:FRAMES] / 1000.0      # mm -> m

def closure(markers):
    a, b = markers[:, 0], markers[:, -1]
    return np.linalg.norm(a - b, axis=1)

X = np.c_[inflate_t, pressure_kpa]
y = closure(take) * 1000.0                # mm
cv = GroupKFold(n_splits=5)
for tr, te in cv.split(X, y, groups=take_id):
    model = GradientBoostingRegressor(max_depth=3)
    model.fit(X[tr], y[tr])
    err = np.abs(model.predict(X[te]) - y[te])
    print(f"fold mae={err.mean():.2f} mm")`,
  // Judging the judges: agreement between a person and two models
  `# judges/agreement.py
import pandas as pd
from scipy.stats import pearsonr

df = pd.read_csv("scores_single.csv")
for judge in ["model_a", "model_b"]:
    r, p = pearsonr(df["human"], df[judge])
    print(judge, f"r={r:.2f}", f"p={p:.3f}")

pairs = pd.read_csv("scores_pairwise.csv")
agree = (pairs.human_pick == pairs.model_pick)
print("pair agreement", agree.mean())

def prompt(question, answer):
    return f"""Rate the answer from 1 to 10.
Question: {question}
Answer: {answer}
Score:"""`,
  // LIFT sensors: reading the sensors live and turning bends into chords
  `# lift/live.py
import serial, time
import numpy as np

port = serial.Serial("/dev/tty.usbmodem1101", 115200)
baseline = None
window = []

def read_ohms():
    raw = port.readline().decode().strip()
    return [float(v) for v in raw.split(",")]

while True:
    r = np.array(read_ohms())
    if baseline is None:
        baseline = r
    strain = (r - baseline) / baseline
    window.append(strain)
    window = window[-50:]
    bent = np.mean(window, axis=0) > 0.08
    chord = CHORDS[tuple(bent.astype(int))]
    synth.play(chord)
    time.sleep(0.01)`,
  // Stag Hunt: fixation analysis
  `# staghunt/fixations.R
library(dplyr)

fix <- read.csv("tobii_fixations.csv") |>
  filter(!excluded) |>
  group_by(participant, aoi) |>
  summarise(dwell = sum(duration_ms))

choice <- read.csv("choices.csv") |>
  group_by(participant) |>
  summarise(agree = mean(match_goal))

d <- inner_join(fix, choice, by = "participant")
cor.test(d$dwell, d$agree)`,
  // drift checks on the printed sensors
  `# lift/drift.py
SUBSTRATES = load_config("substrates.yaml")   # 5 flexible substrates

def drift(trace, hours):
    slope = np.polyfit(hours, trace, 1)[0]
    return slope / trace[0]

results = {}
for s in SUBSTRATES:
    t, r = load_trace(s)
    results[s] = {
        "drift": drift(r, t),
        "recovery": recovery(r),
        "repeat": np.std(cycles(r)),
    }`,
];

const lines = SNIPPETS.flatMap((s) => [...s.split('\n'), '', '']);

export function setupCodeBg(section, { isReduced }) {
  if (!section) return;
  const layer = document.createElement('div');
  layer.className = 'code-bg';
  layer.setAttribute('aria-hidden', 'true');
  section.prepend(layer);

  let cols = [];
  function build() {
    const n = Math.max(2, Math.min(5, Math.round(section.clientWidth / 340)));
    if (n === cols.length) return;
    layer.replaceChildren();
    cols = Array.from({ length: n }, (_, i) => {
      const col = document.createElement('div');
      col.className = 'code-col';
      col.style.setProperty('--dur', 150 + i * 23 + 's');
      col.style.setProperty('--delay', -(i * 37) + 's');
      const start = (i * 29) % lines.length;
      const run = [...lines.slice(start), ...lines.slice(0, start)];
      const pre = document.createElement('pre');
      pre.innerHTML = run.map((l) => `<span>${escape(l) || ' '}</span>`).join('\n');
      col.append(pre, pre.cloneNode(true)); // two copies, so the drift loops without a seam
      layer.append(col);
      return col;
    });
  }
  build();
  addEventListener('resize', build, { passive: true });
  // the code is almost invisible until the pointer comes near: a small bright patch follows it, and two
  // slower patches behind it leave a short fading trail (mouse and pen only)
  if (matchMedia('(hover: hover)').matches) {
    layer.classList.add('is-lit');
    const want = { x: -999, y: -999 };
    const spots = [0.35, 0.12, 0.05].map((k, i) => ({ k, x: -999, y: -999, n: i + 1 })); // the lead spot, then the trail
    let raf = 0, inside = false;
    const paint = () => {
      raf = 0;
      let moving = false;
      for (const s of spots) {
        const k = isReduced() ? 1 : s.k; // with Motion off there is no trail: every spot sits on the pointer
        s.x += (want.x - s.x) * k; s.y += (want.y - s.y) * k;
        layer.style.setProperty(`--x${s.n}`, s.x.toFixed(1) + 'px');
        layer.style.setProperty(`--y${s.n}`, s.y.toFixed(1) + 'px');
        if (Math.abs(want.x - s.x) + Math.abs(want.y - s.y) > 0.5) moving = true;
      }
      if (moving) raf = requestAnimationFrame(paint);
    };
    section.addEventListener('pointermove', (e) => {
      const r = layer.getBoundingClientRect();
      want.x = e.clientX - r.left; want.y = e.clientY - r.top;
      if (!inside) { inside = true; spots.forEach((s) => { s.x = want.x; s.y = want.y; }); layer.classList.add('is-near'); }
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive: true });
    section.addEventListener('pointerleave', () => { inside = false; layer.classList.remove('is-near'); });
  }
  // nothing drifts while the hero is off screen
  new IntersectionObserver(([e]) => layer.classList.toggle('is-paused', !e.isIntersecting)).observe(section);

  // retype one line now and then
  let timer = 0;
  function retype() {
    timer = setTimeout(retype, 2600 + Math.random() * 1800);
    if (isReduced() || document.hidden || section.getBoundingClientRect().bottom < 0) return;
    const col = cols[(Math.random() * cols.length) | 0];
    const spans = [...col.querySelectorAll('pre:first-child span')].filter((s) => s.textContent.trim().length > 8);
    const box = layer.getBoundingClientRect();
    const visible = spans.filter((s) => { const r = s.getBoundingClientRect(); return r.top > box.top + 60 && r.bottom < box.bottom - 60; });
    const span = visible[(Math.random() * visible.length) | 0];
    if (!span || span.classList.contains('is-typing')) return;
    const text = span.textContent;
    span.classList.add('is-typing');
    let i = 0;
    const step = () => {
      i += 1 + (Math.random() * 2 | 0);
      span.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, 28 + Math.random() * 40);
      else setTimeout(() => span.classList.remove('is-typing'), 1600);
    };
    span.textContent = '';
    step();
  }
  timer = setTimeout(retype, 1200);
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
