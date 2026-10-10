(() => {
  'use strict';
  if (window.__ONECLICK_RUNTIME_FIX_1197__) return;
  window.__ONECLICK_RUNTIME_FIX_1197__ = true;

  const WRAPPER_SELECTOR = '#app > main.h-lvh > div.min-h-full.h-full.p-3.text-xs.relative';
  const DUP_ATTR = 'data-oneclick-dup';
  // Elements the compiled app renders exactly once. Any further instance is a ghost layer.
  const SINGLETONS = ['main.h-lvh', 'div.min-h-full.h-full.p-3.text-xs.relative', 'header.space-y-2', '.p-tabs'];

  // Inject the hide rule from JS so it works even if the CSS bundle is cached.
  function ensureStyle() {
    if (document.getElementById('oneclick-dup-style')) return;
    const style = document.createElement('style');
    style.id = 'oneclick-dup-style';
    style.textContent = `[${DUP_ATTR}]{display:none!important}`;
    (document.head || document.documentElement).appendChild(style);
  }

  function describe(el) {
    const parts = [];
    for (let n = el; n && n !== document.documentElement && parts.length < 6; n = n.parentElement) {
      parts.unshift(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') +
        (n.classList.length ? '.' + Array.from(n.classList).slice(0, 3).join('.') : ''));
    }
    return parts.join(' > ');
  }

  const reported = new WeakSet();
  function report(el, selector) {
    if (reported.has(el)) return;
    reported.add(el);
    const entry = { at: new Date().toISOString(), selector, path: describe(el), height: el.offsetHeight };
    console.warn('[1CLICK] hid duplicate UI layer', entry);
    const store = globalThis.chrome?.storage?.local;
    if (!store) return;
    store.get('__oneclick_dup_report')
      .then((r) => store.set({ __oneclick_dup_report: [...(r.__oneclick_dup_report || []), entry].slice(-20) }))
      .catch(() => {});
  }

  // Hide (never remove) extra instances. Removing nodes Vue still tracks makes later
  // patches insert against stale anchors, which is how extra layers keep reappearing.
  function hideDuplicateLayers() {
    for (const selector of SINGLETONS) {
      const all = Array.from(document.querySelectorAll(selector));
      if (all.length < 2) continue;
      const keep = all[0];
      for (const el of all.slice(1)) {
        if (keep.contains(el) || el.closest(`[${DUP_ATTR}]`)) continue;
        el.setAttribute(DUP_ATTR, 'true');
        report(el, selector);
      }
    }

    // Anything in normal flow that sits after the real wrapper (inside main, #app or body)
    // is not part of the app's layout and would extend the scroll height.
    const wrapper = document.querySelector(WRAPPER_SELECTOR);
    if (!wrapper) return;
    const containers = [wrapper.parentElement, document.getElementById('app'), document.body];
    for (const container of containers) {
      if (!container) continue;
      for (const el of Array.from(container.children)) {
        if (el.closest(`[${DUP_ATTR}]`) || el.contains(wrapper)) continue;
        if (!el.querySelector('header, .p-tabs, main')) continue;
        const pos = getComputedStyle(el).position;
        if (pos === 'fixed' || pos === 'absolute') continue; // dialogs, toasts, overlays
        el.setAttribute(DUP_ATTR, 'true');
        report(el, 'stray-root');
      }
    }
  }

  function getScroller() {
    return document.querySelector(WRAPPER_SELECTOR);
  }

  function makeScrollable() {
    const scroller = getScroller();
    if (!scroller) return;
    scroller.style.setProperty('height','100%','important');
    scroller.style.setProperty('max-height','100%','important');
    scroller.style.setProperty('min-height','0','important');
    scroller.style.setProperty('overflow-y','auto','important');
    scroller.style.setProperty('overflow-x','hidden','important');
    scroller.style.setProperty('pointer-events','auto','important');
    scroller.dataset.oneclickScroller = 'true';
  }

  // If a child control has its own scroll area (textarea, logs, queue), let it handle wheel first.
  function hasOwnVerticalScroll(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const style = getComputedStyle(el);
    const oy = style.overflowY;
    return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2;
  }

  function onWheel(ev) {
    const scroller = getScroller();
    if (!scroller) return;
    let node = ev.target instanceof Element ? ev.target : null;
    while (node && node !== scroller) {
      if (hasOwnVerticalScroll(node)) return;
      node = node.parentElement;
    }
    // Chromium normally scrolls this element itself. The fallback below fixes cases where
    // the side-panel loses its native wheel target after Chrome restores the panel session.
    const before = scroller.scrollTop;
    scroller.scrollTop += ev.deltaY;
    if (scroller.scrollTop !== before) ev.preventDefault();
  }

  let scheduled = false;
  function run() {
    scheduled = false;
    ensureStyle();
    hideDuplicateLayers();
    makeScrollable();
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  function start() {
    run();
    window.addEventListener('wheel', onWheel, { passive:false, capture:true });
    new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(run, 100);
    setTimeout(run, 500);
    setTimeout(run, 1500);
    console.info('[1CLICK] v1.1.9.7 single-layer/scroll fix active');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
