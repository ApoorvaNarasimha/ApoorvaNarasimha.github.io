// The skills graph, drawn like a small neural network: domains -> skills -> projects. Nodes are real
// buttons in three columns; one canvas underneath draws the edges and the signals running along them.
// Pointing at, focusing or selecting a node lights its whole path. Every skill-to-project edge comes
// from that project's own card. Narrow screens keep the grouped list already in the HTML.
const DOMAINS = [
  ['AI evaluation', '#38e1ff', ['LLM evaluation', 'Human–model agreement', 'Agent evaluation', 'Experimental design', 'Statistical analysis']],
  ['ML & agents', '#9b8cff', ['Machine learning', 'LangGraph agents', 'AI-assisted development']],
  ['Multimodal data', '#4ade9b', ['Computer vision (OpenCV)', 'Hand tracking (MediaPipe)', 'Motion capture', 'Eye tracking', 'Signal processing']],
  ['Systems & hardware', '#ffb454', ['Python', 'R', 'Real-time systems', 'Microcontrollers', 'Sensor fabrication', 'Interface design']],
];
const PROJECTS = [
  ['Wearable sensing with LIFT', ['Python', 'Real-time systems', 'Computer vision (OpenCV)', 'Hand tracking (MediaPipe)', 'Signal processing', 'Microcontrollers', 'Sensor fabrication', 'Experimental design', 'Statistical analysis']],
  ['Lunim', ['AI-assisted development', 'Interface design']],
  ['MorphMind', ['Machine learning', 'Motion capture', 'Python']],
  ['Judging the judges', ['LLM evaluation', 'Human–model agreement', 'Statistical analysis', 'Python']],
  ['Stag Hunt eye tracking', ['Eye tracking', 'Experimental design', 'Statistical analysis', 'R']],
  ['Energy app', ['Interface design']],
  ['ResearchPilot', ['LangGraph agents', 'Python'], true],
  ['AgentBenchLab', ['Agent evaluation', 'LLM evaluation'], true],
];

export function setupNetwork(root, { isReduced }) {
  const stage = root.querySelector('.net-stage'), canvas = root.querySelector('canvas'), info = root.querySelector('.net-info'), g = canvas.getContext('2d');
  const wide = matchMedia('(min-width: 900px)');
  const nodes = [], edges = [], byName = new Map();
  const column = (title) => {
    const c = document.createElement('div'); c.className = 'net-col';
    const t = document.createElement('p'); t.className = 'net-col-title'; t.textContent = title;
    c.append(t); stage.append(c); return c;
  };
  const cols = ['Domain', 'Skill', 'Project'].map(column);
  const add = (name, kind, color, parent, planned) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = `net-node net-node--${kind}`; el.style.setProperty('--c', color); el.setAttribute('aria-pressed', 'false');
    el.append(name);
    if (planned) { const s = document.createElement('small'); s.textContent = 'in progress'; el.append(s); }
    parent.append(el);
    const n = { name, kind, color, el, out: [], in: [] };
    nodes.push(n); byName.set(name, n); return n;
  };
  const edge = (a, b, color, planned) => { const e = { a, b, color, planned, t: (edges.length * 0.618) % 1 }; edges.push(e); a.out.push(e); b.in.push(e); };
  for (const [d, color, skills] of DOMAINS) {
    const dn = add(d, 'domain', color, cols[0]);
    const group = document.createElement('div'); group.className = 'net-cluster'; cols[1].append(group);
    skills.forEach((s) => edge(dn, add(s, 'skill', color, group), color));
  }
  for (const [p, skills, planned] of PROJECTS) {
    const pn = add(p, 'project', '#e6f1ff', cols[2], planned);
    skills.forEach((s) => { const sn = byName.get(s); edge(sn, pn, sn.color, planned); });
  }
  root.querySelector('.net-count').textContent = `${DOMAINS.length} domains / ${nodes.filter((n) => n.kind === 'skill').length} skills / ${PROJECTS.length} projects / ${edges.length} links`;

  let W = 0, H = 0, dpr = 1, raf = 0, last = 0, seen = false, hover = null, pinned = null, lit = null;
  function trace(n) { // everything upstream and downstream
    const es = new Set(), ns = new Set([n]);
    const walk = (m, dir) => m[dir].forEach((e) => { es.add(e); const o = dir === 'out' ? e.b : e.a; ns.add(o); walk(o, dir); });
    walk(n, 'out'); walk(n, 'in');
    return { es, ns };
  }
  function layout() {
    if (!wide.matches || !stage.clientWidth) return;
    W = stage.clientWidth; H = stage.clientHeight; dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const s = stage.getBoundingClientRect();
    nodes.forEach((n) => { const r = n.el.getBoundingClientRect(); n.x0 = r.left - s.left; n.x1 = r.right - s.left; n.y = r.top - s.top + r.height / 2; });
    edges.forEach((e) => { e.p = [e.a.x1, e.a.y, e.b.x0, e.b.y]; });
    wake();
  }
  const at = ([x1, y1, x2, y2], t) => { const u = 1 - t, m = (x1 + x2) / 2; return [u * u * u * x1 + 3 * u * u * t * m + 3 * u * t * t * m + t * t * t * x2, u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2]; };
  function paint(dt) {
    const still = isReduced();
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    for (const e of edges) {
      const on = lit?.es.has(e), [x1, y1, x2, y2] = e.p, m = (x1 + x2) / 2;
      g.globalAlpha = lit ? (on ? 1 : 0.06) : 0.38; g.strokeStyle = e.color; g.lineWidth = on ? 1.6 : 1; g.setLineDash(e.planned ? [3, 5] : []);
      g.shadowColor = e.color; g.shadowBlur = on ? 10 : 0;
      g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(m, y1, m, y2, x2, y2); g.stroke();
      if (!still && (on || !lit)) { // a signal and its short tail
        e.t = (e.t + dt * (on ? 0.55 : 0.2)) % 1;
        g.setLineDash([]); g.shadowBlur = on ? 10 : 6;
        for (let k = 0; k < 6; k++) {
          const t = e.t - k * 0.014; if (t < 0) break;
          const [x, y] = at(e.p, t); g.globalAlpha = (on ? 1 : 0.8) * (1 - k / 6); g.fillStyle = e.color; g.fillRect(x - 1.25, y - 1.25, 2.5, 2.5);
        }
      }
    }
    g.shadowBlur = 0; g.globalAlpha = 1; g.setLineDash([]);
  }
  function frame(now) {
    raf = 0;
    if (!W || !wide.matches || !seen || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    paint(dt);
    if (!isReduced()) raf = requestAnimationFrame(frame); else last = 0;
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }

  const IDLE = info.textContent;
  function update() {
    const f = hover || pinned;
    lit = f && trace(f);
    nodes.forEach((n) => { n.el.classList.toggle('is-dim', !!lit && !lit.ns.has(n)); n.el.classList.toggle('is-lit', !!lit?.ns.has(n)); n.el.classList.toggle('is-on', n === f); n.el.setAttribute('aria-pressed', String(n === pinned)); });
    if (!f) info.textContent = IDLE;
    else {
      const list = (k) => [...lit.ns].filter((n) => n.kind === k && n !== f).map((n) => n.name).join(', ');
      info.textContent = f.kind === 'skill' ? `${f.name}: ${list('project') ? 'used in ' + list('project') : list('domain')}` : f.kind === 'project' ? `${f.name}: built on ${list('skill')}` : `${f.name}: ${f.out.length} skills${list('project') ? ', used in ' + list('project') : ''}`;
    }
    wake();
  }
  nodes.forEach((n) => {
    n.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hover = n; update(); } });
    n.el.addEventListener('pointerleave', () => { if (hover === n) { hover = null; update(); } });
    n.el.addEventListener('focus', () => { if (n.el.matches(':focus-visible')) { hover = n; update(); } });
    n.el.addEventListener('blur', () => { if (hover === n) { hover = null; update(); } });
    n.el.addEventListener('click', () => { pinned = pinned === n ? null : n; update(); });
  });
  stage.addEventListener('click', (e) => { if (!e.target.closest('.net-node')) { pinned = null; update(); } });
  stage.addEventListener('keydown', (e) => { if (e.key === 'Escape') { pinned = hover = null; update(); } });
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) layout(); }).observe(root);
  new ResizeObserver(layout).observe(stage);
  new MutationObserver(wake).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', wake);
  root.classList.add('is-ready');
  document.fonts?.ready.then(layout);
}
