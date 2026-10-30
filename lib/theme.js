// Colour theme of the extension pages: 'dark' (default), 'light', or 'auto' (follows the system setting).
// Applied as <html data-theme="…">; the choice is mirrored in localStorage so pages paint in the right theme
// before the stored settings are read.
const KEY = 'lou-theme';
let media = null;
export function applyTheme(pref) {
  if (pref === undefined) { try { pref = localStorage.getItem(KEY) || 'dark'; } catch { pref = 'dark'; } }
  try { localStorage.setItem(KEY, pref); } catch { /* storage blocked */ }
  const set = () => {
    const light = pref === 'light' || (pref === 'auto' && globalThis.matchMedia?.('(prefers-color-scheme: light)').matches);
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  };
  set();
  if (!media && globalThis.matchMedia) { media = matchMedia('(prefers-color-scheme: light)'); media.addEventListener?.('change', () => applyTheme()); }
}
