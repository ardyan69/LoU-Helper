// i18n check: every literal t('…') / mark('…') text in the extension must exist in every language
// dictionary (lib/i18n/*.js). Also lists dictionary keys no longer used anywhere (informational).
// Run: node tests/i18n-check.mjs [--unused]      exit code 1 when a translation is missing
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGELOG } from '../lib/changelog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'hu', 'el'];
const files = [
  ...['dashboard.js', 'popup.js', 'background.js'].map((f) => join(ROOT, f)),
  ...readdirSync(join(ROOT, 'views')).filter((f) => f.endsWith('.js')).map((f) => join(ROOT, 'views', f)),
  ...readdirSync(join(ROOT, 'lib')).filter((f) => f.endsWith('.js')).map((f) => join(ROOT, 'lib', f))
];
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t' }[c] ?? c));
const used = new Map(); // text -> first file
let dynamic = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\b(?:t|mark)\(\s*'((?:[^'\\]|\\.)*)'/g)) { const k = unescape(m[1]); if (!used.has(k)) used.set(k, f.slice(ROOT.length + 1)); }
  dynamic += [...src.matchAll(/\bt\(\s*(?![\s'])/g)].length;
}
for (const v of CHANGELOG) for (const item of v.items) if (!used.has(item)) used.set(item, 'lib/changelog.js');

let missingTotal = 0;
const dicts = {};
for (const l of LANGS) {
  dicts[l] = (await import(join(ROOT, 'lib', 'i18n', `${l}.js`))).default;
  const missing = [...used.keys()].filter((k) => !(k in dicts[l]));
  missingTotal += missing.length;
  console.log(`${l}: ${used.size - missing.length}/${used.size} translated${missing.length ? ` — ${missing.length} missing` : ''}`);
  for (const k of missing.slice(0, 50)) console.log(`   ✗ ${JSON.stringify(k)}  (${used.get(k)})`);
}
console.log(`${used.size} texts found · ${dynamic} t(…) calls with a non-literal argument are not checked`);
if (process.argv.includes('--unused')) {
  const stale = Object.keys(dicts.en).filter((k) => !used.has(k));
  console.log(`\nKeys in en.js not found as literals (${stale.length}; may still be used dynamically):`);
  for (const k of stale) console.log(`   · ${JSON.stringify(k)}`);
}
process.exit(missingTotal ? 1 : 0);
