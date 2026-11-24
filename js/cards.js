// Project card motion: words rise in and the picture assembles the first time a card is seen, and
// the picture leans gently toward the pointer.
// With reduced motion the cards are simply there.
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

export function setupCards(cards, { isReduced }) {
  const items = cards.map((el) => ({ el, inner: el.querySelector('.stack-inner'), copy: [...el.querySelector('.stack-copy').children], media: el.querySelector('.stack-media') }));

  // ---------------------------------------------------------- first view
  const enter = ({ el, copy, media }) => {
    el.classList.remove('is-waiting');
    if (isReduced()) return;
    const from = (transform) => [{ opacity: 0, transform }, { opacity: 1, transform: 'none' }];
    copy.forEach((n, i) => n.animate(from('translateY(22px)'), { duration: 1100, delay: 90 * i, easing: EASE, fill: 'backwards' }));
    media.animate(from('translateX(28px)'), { duration: 1200, easing: EASE, fill: 'backwards' });
    media.querySelector('img, video')?.animate([{ opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }], { duration: 1300, delay: 180, easing: EASE, fill: 'backwards' });
    const parts = [...media.querySelectorAll('.iso > g')];
    const step = Math.min(70, 900 / (parts.length || 1));
    parts.forEach((p, i) => {
      const t = { duration: 900, delay: 260 + step * i, easing: EASE, fill: 'backwards' };
      p.animate(from('translateY(-3px)'), t);
    });
  };
  const seen = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    seen.unobserve(e.target);
    enter(items.find((c) => c.el === e.target));
  }), { rootMargin: '0px 0px -8% 0px' });
  items.forEach((c) => { if (!isReduced()) c.el.classList.add('is-waiting'); seen.observe(c.el); });

  // clips loop silently while on screen; with motion off they rest on a still frame
  const film = (media) => {
    const v = media.querySelector('video');
    if (!v) return;
    if (media.classList.contains('is-live') && !isReduced()) v.play().catch(() => {}); else v.pause();
  };
  // the picture floats only while its card is on screen
  const live = new IntersectionObserver((entries) => entries.forEach((e) => { e.target.classList.toggle('is-live', e.isIntersecting); film(e.target); }));
  items.forEach((c) => live.observe(c.media));

  new MutationObserver(() => items.forEach((c) => film(c.media))).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); // the motion toggle

  // ---------------------------------------------------------- leaning toward the pointer
  if (matchMedia('(hover: hover)').matches) items.forEach(({ inner, media }) => {
    inner.addEventListener('pointermove', (e) => {
      if (isReduced()) return;
      const r = inner.getBoundingClientRect();
      media.style.setProperty('--lx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      media.style.setProperty('--ly', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    inner.addEventListener('pointerleave', () => { media.style.removeProperty('--lx'); media.style.removeProperty('--ly'); });
  });
}

// Smaller pieces fade and rise as they come into view.
export function setupReveals(els) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach((el) => { el.classList.add('rise'); el.style.setProperty('--n', [...el.parentElement.children].indexOf(el) % 6); io.observe(el); });
}
