import { sound } from '../sound.js';

// The speech bubble: types a line out while her mouth flaps, offers choices as real buttons,
// mirrors the finished line into a live region, and keeps itself inside the viewport.

export function createBubble({ el, text, options, close, live, stage, isReduced, home = null }) {
  let current = null; // { resolve, timer, typing }
  let token = 0;

  const homeParent = el.parentElement;
  const dockQuery = matchMedia('(max-width: 640px)');
  function dockMode() {
    const docked = dockQuery.matches;
    if (docked && el.parentElement !== document.body) document.body.appendChild(el);
    if (!docked && el.parentElement !== homeParent) homeParent.appendChild(el);
    el.classList.toggle('is-docked', docked);
    return docked;
  }
  function place() {
    if (el.hidden) return;
    if (dockMode()) { el.style.left = ''; el.style.top = ''; return; }
    const head = stage.headPoint();
    const anchor = stage.anchor();
    const bw = el.offsetWidth, bh = el.offsetHeight;
    const topbar = 72;
    const preferLeft = stage.side() === 'right';
    // container-relative coordinates: the container's origin is her feet
    let left = preferLeft ? -bw + 26 : -26;
    let top = head.y - anchor.y - bh - 18;
    // keep inside the viewport horizontally
    const absLeft = anchor.x + left;
    if (absLeft < 12) left += 12 - absLeft;
    if (absLeft + bw > innerWidth - 12) left -= absLeft + bw - (innerWidth - 12);
    // if there is no room above her head, sit the bubble beside her instead
    if (anchor.y + top < topbar) {
      top = head.y - anchor.y + 10;
      left = preferLeft ? -bw - stage.unit * 6 * stage.scale : stage.unit * 6 * stage.scale;
      const a2 = anchor.x + left;
      if (a2 < 12) left += 12 - a2;
      if (a2 + bw > innerWidth - 12) left -= a2 + bw - (innerWidth - 12);
    }
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    const tail = Math.max(14, Math.min(bw - 30, -left - 8));
    el.style.setProperty('--tail-x', tail + 'px');
    el.classList.toggle('tail-right', preferLeft);
  }

  function clear() {
    if (current) { clearTimeout(current.timer); clearInterval(current.typing); }
    options.innerHTML = '';
  }

  let leaveTimer = 0;
  function hide(reason = 'closed') {
    const hadFocus = el.contains(document.activeElement); // checked before the buttons go away
    const c = current; clear(); current = null;
    token++; // invalidates any typing still in flight
    stage.host.stopTalking();
    clearTimeout(leaveTimer);
    if (isReduced() || el.hidden) { el.hidden = true; el.classList.remove('is-leaving'); }
    else {
      el.classList.add('is-leaving');
      leaveTimer = setTimeout(() => { el.hidden = true; el.classList.remove('is-leaving'); }, 160);
    }
    if (hadFocus) {
      const back = returnFocus && returnFocus.isConnected && returnFocus !== document.body ? returnFocus : home;
      back?.focus({ preventScroll: true });
    }
    returnFocus = null;
    if (c) c.resolve(reason);
  }

  // say(line, { choices: [{label, value}], hold: ms, express, pose }) -> Promise<value|'timeout'|'closed'>
  let returnFocus = null, saidAtY = 0;
  function say(line, { choices = [], hold, express, pose, focus = false } = {}) {
    if (current) { const c = current; clear(); current = null; c.resolve('replaced'); }
    const my = ++token;
    saidAtY = scrollY;
    clearTimeout(leaveTimer); el.classList.remove('is-leaving');
    el.hidden = false;
    text.textContent = '';
    options.innerHTML = '';
    if (express) stage.host.express(express, 3);
    if (pose) stage.host.play(pose);
    const reduced = isReduced();
    const chars = [...line];
    const typeMs = reduced ? 0 : Math.min(2600, chars.length * 24);
    stage.host.say(typeMs / 1000 + 0.15);
    return new Promise((resolve) => {
      current = { resolve, timer: 0, typing: 0 };
      const finish = () => {
        if (my !== token || !current) return;
        clearInterval(current.typing);
        text.textContent = line;
        live.textContent = '';
        requestAnimationFrame(() => { live.textContent = line; });
        choices.forEach((ch) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'block ' + (ch.primary ? 'block--tangerine' : 'block--cream');
          b.textContent = ch.label;
          b.addEventListener('click', () => { if (my === token) hide(ch.value); });
          options.appendChild(b);
        });
        place();
        if (focus) { returnFocus = document.activeElement; const first = options.querySelector('button') || close; first.focus({ preventScroll: true }); }
        // A bubble asking a question waits for the answer (no time limit). A plain line
        // closes itself, but never while the visitor is pointing at it or focused inside it.
        current.wait = choices.length ? 0 : hold ?? Math.max(3200, line.length * 55);
        current.my = my;
        armTimer(current.wait);
      };
      if (!typeMs) { finish(); return; }
      let i = 0;
      const step = Math.max(1, Math.ceil(chars.length / (typeMs / 30)));
      current.typing = setInterval(() => {
        i += step;
        if (i % 2 === 0) sound.blip(chars[Math.min(i, chars.length - 1)] || 'a');
        text.textContent = chars.slice(0, i).join('');
        place();
        if (i >= chars.length) finish();
      }, 30);
      // a click on the bubble skips the typing
      el.onclick = (e) => { if (e.target.closest('button')) return; if (i < chars.length) { i = chars.length; finish(); } };
      place();
    });
  }

  function armTimer(ms) {
    if (!current || !ms) return;
    clearTimeout(current.timer);
    const my = current.my;
    current.timer = setTimeout(() => { if (my === token) hide('timeout'); }, ms);
  }
  const pause = () => { if (current) clearTimeout(current.timer); };
  const resume = () => { if (current && current.wait && !el.matches(':hover') && !el.contains(document.activeElement)) armTimer(2400); };
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', resume);
  el.addEventListener('focusin', pause);
  el.addEventListener('focusout', () => setTimeout(resume, 0));

  close.addEventListener('click', () => hide('closed'));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) hide('closed'); });
  // A visitor who scrolls well away has moved on: let the line go instead of following them.
  addEventListener('scroll', () => {
    if (current && !el.hidden && Math.abs(scrollY - saidAtY) > innerHeight * 0.6) hide('scrolled');
  }, { passive: true });

  return {
    say, hide, place,
    get open() { return !el.hidden; },
    get awaitingChoice() { return !el.hidden && !!current && options.children.length > 0; },
  };
}
