// Passive delegated listeners preserve native clicks, scrolling and React handlers.
export function installTouchFeedback(doc = document, win = window) {
  const selector = 'button,a[href],[role="button"],input[type="submit"],input[type="button"]';
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Map();
  let press = null;
  function clear() {
    press = null;
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
  }
  function animate(element, frames, duration) {
    if (reduced.matches || typeof element.animate !== 'function') return;
    animations.get(element)?.cancel();
    const animation = element.animate(frames, {duration, easing:'cubic-bezier(.2,.8,.2,1)', fill:'none'});
    animations.set(element, animation);
    animation.onfinish = () => { if (animations.get(element) === animation) animations.delete(element); };
  }
  doc.addEventListener('pointerdown', event => {
    if (!['touch','pen'].includes(event.pointerType) || event.isPrimary === false) return;
    clear();
    const element = event.target.closest?.(selector);
    if (!element || element.closest(':disabled,[disabled],[aria-disabled="true"],[data-disabled],[inert]')) return;
    press = {element, id:event.pointerId, x:event.clientX, y:event.clientY};
    animate(element, [{scale:'1'},{scale:'.94'}], 100);
  }, {capture:true, passive:true});
  doc.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX-press.x,event.clientY-press.y)>10) clear();
  }, {capture:true, passive:true});
  doc.addEventListener('pointerup', event => {
    if (press?.id !== event.pointerId) return;
    const {element} = press;
    press = null;
    if (!element.isConnected || !element.contains(event.target)) return clear();
    animate(element, [{scale:'.94'},{scale:'1.035',offset:.55},{scale:'1'}], 320);
  }, {capture:true, passive:true});
  doc.addEventListener('pointercancel', clear, {capture:true, passive:true});
  win.addEventListener('blur', clear);
  doc.addEventListener('visibilitychange', clear);
  reduced.addEventListener('change', clear);
}
