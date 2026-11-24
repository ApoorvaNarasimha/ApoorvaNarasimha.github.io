// requestAnimationFrame, or timers under ?timerloop so animation can be inspected in a background tab.
const timer = new URLSearchParams(location.search).has('timerloop');
export const nextFrame = timer ? (fn) => setTimeout(() => fn(performance.now()), 16) : (fn) => requestAnimationFrame(fn);
