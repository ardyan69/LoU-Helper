// Cross-browser shim (Chrome, Edge, Firefox, Safari). Loaded first everywhere: as a classic content script and as
// the first import of the extension pages / background. Firefox and Safari expose the promise-based WebExtension
// API as `browser`; the code uses `chrome.*` with promises, so point `chrome` at `browser` there.
(function () {
  const g = typeof globalThis !== 'undefined' ? globalThis : self;
  try {
    if (typeof g.browser !== 'undefined' && g.browser && g.browser.runtime && g.browser.runtime.id && g.chrome !== g.browser) {
      try { g.chrome = g.browser; } catch (_) { /* read-only global */ }
      if (g.chrome !== g.browser) Object.defineProperty(g, 'chrome', { value: g.browser, configurable: true, writable: true });
    }
  } catch (_) { /* keep the native chrome namespace */ }
})();
