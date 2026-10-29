// Tiny i18n: source strings are the Indonesian UI text; each dictionary maps them to another language.
// t('Data terakhir {x}', { x }) -> translated text with {placeholders} filled in.
import en from './i18n/en.js';
import es from './i18n/es.js';
import fr from './i18n/fr.js';
import de from './i18n/de.js';
import it from './i18n/it.js';
import hu from './i18n/hu.js';
import el from './i18n/el.js';

export const LANGS = [
  ['auto', null], // label is translated: "Ikuti bahasa game"
  ['id', 'Bahasa Indonesia'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['it', 'Italiano'], ['hu', 'Magyar'], ['el', 'Ελληνικά']
];
const DICTS = { en, es, fr, de, it, hu, el };
const LOCALES = { id: 'id-ID', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', hu: 'hu-HU', el: 'el-GR' };

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
  const d = await chrome.storage.local.get(['settings', 'movements']);
  setLang(resolveLang(d.settings?.lang || 'id', d.movements?.lang));
  return lang;
}
