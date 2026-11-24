// Soft letters: headings that puff under the pointer.
import { nextFrame } from './frame.js';

// ------------------------------------------------------------ soft letters
// Wrap every visible character in a span so letters can puff (square pixels -> round) and squash.
export function splitLetters(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.nodeValue.trim()) continue;
    const frag = document.createDocumentFragment();
    for (const ch of node.nodeValue) {
      if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch; frag.appendChild(s);
    }
    node.replaceWith(frag);
  }
  return [...root.querySelectorAll('.ch')];
}

export function softLetters(root, { radius = 150, onPoke } = {}) {
  // Screen readers get the words once, not a run of single letters.
  if (!root.closest('[aria-hidden="true"]')) {
    const words = document.createElement('span');
    words.className = 'sr-only'; words.textContent = root.textContent;
    root.before(words); root.setAttribute('aria-hidden', 'true');
  }
  const letters = splitLetters(root);
  let raf = 0, px = 0, py = 0, active = false;
  function update() {
    raf = 0;
    // read every position first, then write: one layout pass instead of one per letter
    const dists = letters.map((l) => {
      if (!active) return Infinity;
      const r = l.getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - px, r.top + r.height * 0.6 - py);
    });
    letters.forEach((l, i) => {
      l.classList.toggle('is-puffed', dists[i] < radius * 0.45);
      l.classList.toggle('is-soft', dists[i] >= radius * 0.45 && dists[i] < radius);
    });
  }
  const host = root.closest('h1, h2, h3') || root;
  host.addEventListener('pointermove', (e) => { active = true; px = e.clientX; py = e.clientY; if (!raf) raf = nextFrame(update); });
  host.addEventListener('pointerleave', () => { active = false; if (!raf) raf = nextFrame(update); });
  letters.forEach((l) => l.addEventListener('pointerdown', () => {
    l.classList.add('is-pressed', 'is-puffed');
    setTimeout(() => l.classList.remove('is-pressed'), 160);
    onPoke?.(l);
  }));
  return letters;
}
