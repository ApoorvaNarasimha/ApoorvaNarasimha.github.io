// The pixel hunt: one glowing pixel hides in each section. Finding all four earns a badge and a celebration.
// Nothing on the site is locked behind it.
export function setupHunt({ sound }) {
  const pixels = [...document.querySelectorAll('.hunt-pixel')], count = document.querySelector('#hunt-count'), note = document.querySelector('#hunt-note');
  const KEY = 'apoorva.site.hunt';
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* storage unavailable */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch (e) { /* storage unavailable */ } };
  let timer = 0;
  const say = (t) => { note.textContent = t; note.classList.add('is-on'); clearTimeout(timer); timer = setTimeout(() => note.classList.remove('is-on'), 5200); };
  const done = () => found.size === pixels.length;
  function show() {
    pixels.forEach((p) => { const f = found.has(p.dataset.hunt); p.hidden = false; p.classList.toggle('is-found', f); p.setAttribute('aria-disabled', String(f)); });
    count.hidden = false; count.classList.toggle('is-done', done());
    count.textContent = `${found.size}/${pixels.length}`;
    count.setAttribute('aria-label', `Pixel hunt: ${found.size} of ${pixels.length} found. ${done() ? 'Play again' : 'How to play'}`);
  }
  pixels.forEach((p) => p.addEventListener('click', () => {
    if (found.has(p.dataset.hunt)) return;
    found.add(p.dataset.hunt); save(); show();
    if (done()) { say('flag{curious_mind} All four pixels found. Thanks for looking closely!'); sound.phrase('flip'); dispatchEvent(new CustomEvent('hunt:done')); }
    else { say(`Pixel ${found.size} of ${pixels.length} found.`); sound.phrase('back'); }
  }));
  count.addEventListener('click', () => {
    if (done()) { found.clear(); save(); show(); say('The four pixels are hidden again. Happy hunting!'); }
    else say('Small game: one glowing pixel hides in each of the four sections. Click them all.');
  });
  show();
}
