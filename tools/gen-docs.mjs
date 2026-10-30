// Generated files — one source of truth for the version, the change log and translated texts:
//   manifest.json "version"          ← the newest entry of lib/changelog.js (a release = a new Change Log entry)
//   manifest.json name/description   ← "__MSG_…__" messages from _locales (below)
//   _locales/<lang>/messages.json    ← lib/meta.js + lib/i18n/<lang>.js (store listing in the browser's language)
//   CHANGELOG.md / CHANGELOG.id.md   ← lib/changelog.js (English text from lib/i18n/en.js)
//   README.md / README.id.md         ← "Version x.y.z" line
//   package.json "version"
//   lib/i18n/content-dict.js         ← tr('…') texts of content.js, translated from lib/i18n/*.js
// Usage: node tools/gen-docs.mjs            write the files
//        node tools/gen-docs.mjs --check    only check; exit code 1 when a file is out of date (used by npm test)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGELOG, CREDIT } from '../lib/changelog.js';
import { APP_NAME, APP_SHORT_NAME, APP_DESCRIPTION, DESCRIPTION_MAX } from '../lib/meta.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const LANGS = ['en', 'es', 'fr', 'de', 'it', 'hu', 'el'];
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const VERSION = CHANGELOG[0]?.v;
if (!/^\d+\.\d+\.\d+$/.test(VERSION || '')) { console.log(`✗ lib/changelog.js: newest entry has no valid version (${VERSION})`); process.exit(1); }
for (let i = 1; i < CHANGELOG.length; i++) {
  const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  if (cmp(CHANGELOG[i - 1].v, CHANGELOG[i].v) <= 0) { console.log(`✗ lib/changelog.js: v${CHANGELOG[i - 1].v} must be newer than v${CHANGELOG[i].v} below it`); process.exit(1); }
}
const dicts = {};
for (const l of LANGS) dicts[l] = (await import(join(ROOT, 'lib', 'i18n', `${l}.js`))).default;

const problems = [];
const out = {}; // file -> wanted content

// ---- manifest: version + translated store texts ----
const LOCALES = ['en', 'id', 'es', 'fr', 'de', 'it', 'hu', 'el'];
const m2 = { ...manifest, name: '__MSG_appName__', short_name: '__MSG_appShortName__', description: '__MSG_appDesc__', default_locale: 'en', version: VERSION,
  action: { ...manifest.action, default_title: '__MSG_appShortName__' } };
// keep the usual key order: default_locale right after description
const order = ['manifest_version', 'name', 'short_name', 'version', 'author', 'description', 'default_locale'];
const manifestOut = Object.fromEntries([...order.filter((k) => k in m2).map((k) => [k, m2[k]]), ...Object.entries(m2).filter(([k]) => !order.includes(k))]);
out['manifest.json'] = JSON.stringify(manifestOut, null, 2) + '\n';
for (const l of LOCALES) {
  const desc = l === 'id' ? APP_DESCRIPTION : dicts[l][APP_DESCRIPTION];
  if (!desc) { problems.push(`lib/i18n/${l}.js: no translation of the store description (lib/meta.js)`); continue; }
  if (desc.length > DESCRIPTION_MAX) problems.push(`_locales/${l}: description is ${desc.length} characters (max ${DESCRIPTION_MAX})`);
  out[`_locales/${l}/messages.json`] = JSON.stringify({
    appName: { message: APP_NAME, description: 'Extension name' },
    appShortName: { message: APP_SHORT_NAME, description: 'Short name (toolbar button)' },
    appDesc: { message: desc, description: 'Store description, max 132 characters' }
  }, null, 2) + '\n';
}

// ---- change log ----
const changelog = (en) => [
  '# Change Log — LoU Revival Helper', '',
  en ? '🇬🇧 English · [Bahasa Indonesia](CHANGELOG.id.md)' : '🇮🇩 Bahasa Indonesia · [English](CHANGELOG.md)', '',
  en ? `Made by **${CREDIT.name}** (${CREDIT.email}).` : `Dibuat oleh **${CREDIT.name}** (${CREDIT.email}).`, '',
  ...CHANGELOG.flatMap((r) => [`## v${r.v} — ${r.date}`, '', ...r.items.map((i) => {
    if (en && !dicts.en[i]) problems.push(`lib/i18n/en.js: no English text for the v${r.v} change log item "${i.slice(0, 60)}…"`);
    return `- ${en ? dicts.en[i] || i : i}`;
  }), ''])
].join('\n');
out['CHANGELOG.md'] = changelog(true);
out['CHANGELOG.id.md'] = changelog(false);

// ---- version lines ----
out['README.md'] = read('README.md').replace(/^Version \d+\.\d+\.\d+ /m, `Version ${VERSION} `);
out['README.id.md'] = read('README.id.md').replace(/^Versi \d+\.\d+\.\d+ /m, `Versi ${VERSION} `);
const pkg = JSON.parse(read('package.json'));
out['package.json'] = JSON.stringify({ ...pkg, version: VERSION }, null, 2) + '\n';

// ---- content script dictionary ----
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t' }[c] ?? c));
const texts = [...new Set([...read('content.js').matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => unescape(m[1])))];
const cd = {};
for (const l of LANGS) {
  cd[l] = {};
  for (const k of texts) {
    if (dicts[l][k] == null) problems.push(`lib/i18n/${l}.js: missing content-script text "${k}"`);
    else cd[l][k] = dicts[l][k];
  }
}
out['lib/i18n/content-dict.js'] = '// Generated from lib/i18n/*.js by tools/gen-docs.mjs — strings used by the content script (in-game messages).\n' +
  '// eslint-disable-next-line no-unused-vars\nvar LOU_I18N = ' + JSON.stringify(cd, null, 1) + ';\n';

// ---- write / check ----
const readOr = (f) => { try { return read(f); } catch { return null; } };
const stale = Object.keys(out).filter((f) => readOr(f) !== out[f]);
if (CHECK) {
  for (const f of stale) problems.push(`${f} is out of date — run: npm run docs`);
} else {
  for (const f of stale) { mkdirSync(dirname(join(ROOT, f)), { recursive: true }); writeFileSync(join(ROOT, f), out[f]); console.log(`✎ ${f}`); }
}
for (const p of problems) console.log(`✗ ${p}`);
if (!problems.length) console.log(`✓ docs ${CHECK ? 'up to date' : 'generated'} (v${VERSION}, ${texts.length} content-script texts)`);
process.exit(problems.length ? 1 : 0);
