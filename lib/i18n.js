// Tiny i18n: source strings are the Indonesian UI text; each dictionary maps them to another language.
// t('Data terakhir {x}', { x }) -> translated text with {placeholders} filled in.
// Dictionaries are loaded on demand (only the active language, plus English as fallback) instead of importing
// all seven (~860 KB) into every page, the popup and the background worker. Each lib/i18n/<lang>.js file is
// `export default <JSON>;` (checked by tests/i18n-load.test.mjs), so it can be fetched and parsed as JSON —
// dynamic import() is not allowed in extension service workers, fetch() is.

export const LANGS = [
  ['auto', null], // label is translated: "Ikuti bahasa game"
  ['id', 'Bahasa Indonesia'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['it', 'Italiano'], ['hu', 'Magyar'], ['el', 'Ελληνικά']
];
const DICTS = {}; // lang -> dictionary, once loaded
const LOADING = {};
const LOCALES = { id: 'id-ID', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', hu: 'hu-HU', el: 'el-GR' };

export function parseDict(text) {
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
function loadDict(l) {
  if (l === 'id' || DICTS[l]) return Promise.resolve();
  const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(`lib/i18n/${l}.js`) : null;
  if (!url) return Promise.resolve(); // no extension context (tests): Indonesian source texts
  return (LOADING[l] ||= fetch(url).then((r) => r.text()).then((txt) => { DICTS[l] = parseDict(txt); })
    .catch((e) => { delete LOADING[l]; console.warn('[LoU Helper] language', l, e); }));
}

let lang = 'id';

// setting: 'auto' | language code; gameLang: the language selected in the game (player.lang)
export function resolveLang(setting, gameLang) {
  if (setting && setting !== 'auto' && LOCALES[setting]) return setting;
  const g = String(gameLang || '').slice(0, 2).toLowerCase();
  return LOCALES[g] ? g : 'en';
}
export function setLang(l) {
  lang = LOCALES[l] ? l : 'id';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}
export const getLang = () => lang;
export const locale = () => LOCALES[lang];

export function t(src, p) {
  let s = lang === 'id' ? src : DICTS[lang]?.[src] ?? DICTS.en?.[src] ?? src;
  if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] ?? m));
  return s;
}

// apply the saved language (used by dashboard, popup, background)
export async function initLang() {
  const d = /** @type {any} */ (await chrome.storage.local.get(['settings', 'movements']));
  return useLang(resolveLang(d.settings?.lang || 'id', d.movements?.lang));
}
// load the dictionary (and English for texts a dictionary lacks), then switch
export async function useLang(l) {
  l = LOCALES[l] ? l : 'id';
  await Promise.all([loadDict(l), l === 'id' || l === 'en' ? null : loadDict('en')]);
  setLang(l);
  return lang;
}
