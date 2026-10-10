(() => {
  'use strict';
  if (window.__VIDS_SINGLE_LAYER_GUARD__) return;
  window.__VIDS_SINGLE_LAYER_GUARD__ = true;

  const cleanup = () => {
    const apps = Array.from(document.querySelectorAll('#app'));
    if (apps.length > 1) apps.slice(1).forEach((el) => el.remove());

    const app = apps[0] || document.getElementById('app');
    if (!app) return;

    // A valid Vue side panel has exactly one direct <main> application root.
    const directMains = Array.from(app.children).filter((el) => el.tagName === 'MAIN');
    if (directMains.length > 1) directMains.slice(1).forEach((el) => el.remove());

    const main = directMains[0] || app.querySelector(':scope > main');
    if (!main) return;

    // The compiled app has exactly one direct UI wrapper under <main>.
    // If a stale/duplicate mount appends another wrapper, remove only the extras.
    const wrappers = Array.from(main.children).filter((el) =>
      el.nodeType === 1 &&
      el.classList.contains('min-h-full') &&
      el.classList.contains('h-full') &&
      el.classList.contains('relative')
    );
    if (wrappers.length > 1) wrappers.slice(1).forEach((el) => el.remove());
  };

  const start = () => {
    cleanup();
    const obs = new MutationObserver(cleanup);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    requestAnimationFrame(cleanup);
    setTimeout(cleanup, 50);
    setTimeout(cleanup, 300);
    setTimeout(cleanup, 1000);
    console.info('[1CLICK] single-layer guard active v1.1.9.5');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
