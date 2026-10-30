// Translation tool. The UI texts are written in Indonesian in the code — t('Teks') — and that text is the key
// in every dictionary (lib/i18n/<lang>.js). This keeps the code readable for the main language; this tool takes
// away the usual pain of text keys (a reworded sentence silently losing its 7 translations):
//
//   node tools/i18n.mjs check                 missing translations, {placeholders} / <tags> that differ from the
//                                             source text, and — for a missing text — the unused key it most
//                                             likely was before it was reworded (exit code 1 on problems)
//   node tools/i18n.mjs rename "<old>" "<new>"  reword a text: renames the key in all dictionaries AND in the code
//   node tools/i18n.mjs unused                keys no longer used anywhere
//   node tools/i18n.mjs prune [--yes]         remove those keys from all dictionaries (dry run without --yes)
//
// Dictionaries stay `export default <JSON>;` (lib/i18n.js fetches and parses them as JSON).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LANGS = ['en', 'es', 'fr', 'de', 'it', 'hu', 'el'];
const dictPath = (l) => join(ROOT, 'lib', 'i18n', `${l}.js`);

export function codeFiles() {
  const js = (d) => readdirSync(join(ROOT, d)).filter((f) => f.endsWith('.js')).map((f) => join(ROOT, d, f));
  return [...['dashboard.js', 'popup.js', 'background.js', 'content.js'].map((f) => join(ROOT, f)), ...js('views'), ...js('lib')];
}
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => ({ n: '\n', t: '\t' }[c] ?? c));
const escapeJs = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

export function readDict(l) {
  const text = readFileSync(dictPath(l), 'utf8');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}
export function writeDict(l, d) {
  writeFileSync(dictPath(l), 'export default ' + JSON.stringify(d, null, 1) + ';\n');
}

// texts the code translates: t('…') / mark('…') in the pages, tr('…') in the content script, Change Log items
export async function usedTexts() {
  const used = new Map();
  let dynamic = 0;
  for (const f of codeFiles()) {
    if (f.includes(`${join('lib', 'i18n')}`) && !f.endsWith('i18n.js')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:t|mark|tr)\(\s*'((?:[^'\\]|\\.)*)'/g)) { const k = unescape(m[1]); if (!used.has(k)) used.set(k, relative(ROOT, f)); }
    dynamic += [...src.matchAll(/\bt\(\s*(?![\s'])/g)].length;
  }
  const { CHANGELOG } = await import(join(ROOT, 'lib', 'changelog.js'));
  for (const v of CHANGELOG) for (const item of v.items) if (!used.has(item)) used.set(item, 'lib/changelog.js');
  return { used, dynamic };
}
// every quoted string in the code (texts passed to t() through a variable are still literals somewhere)
function allLiterals() {
  const out = new Set();
  for (const f of codeFiles()) {
    if (f.includes(join('lib', 'i18n') + '/')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)) out.add(unescape(m[1] ?? m[2]));
  }
  return out;
}

// {placeholders} and <tags> a translation must keep
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const tags = (s) => [...String(s).matchAll(/<\/?([a-z][a-z0-9]*)\b/gi)].map((m) => m[0].toLowerCase()).sort().join(',');

// word-set similarity (for "was this text reworded?")
const words = (s) => new Set(String(s).toLowerCase().replace(/<[^>]+>|\{\w+\}/g, ' ').match(/[\p{L}\p{N}]+/gu) || []);
function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return (2 * n) / (A.size + B.size);
}

export async function check({ quiet = false } = {}) {
  const { used, dynamic } = await usedTexts();
  const dicts = Object.fromEntries(LANGS.map((l) => [l, readDict(l)]));
  const log = quiet ? () => {} : (s) => console.log(s);
  let problems = 0;
  const unusedEn = Object.keys(dicts.en).filter((k) => !used.has(k));
  for (const l of LANGS) {
    const missing = [...used.keys()].filter((k) => !(k in dicts[l]));
    const bad = Object.entries(dicts[l]).filter(([k, v]) => placeholders(k) !== placeholders(v) || tags(k) !== tags(v));
    problems += missing.length + bad.length;
    log(`${l}: ${used.size - missing.length}/${used.size} translated${missing.length ? ` — ${missing.length} missing` : ''}${bad.length ? ` — ${bad.length} with other {placeholders}/<tags>` : ''}`);
    for (const k of missing.slice(0, 40)) log(`   ✗ ${JSON.stringify(k)}  (${used.get(k)})`);
    for (const [k, v] of bad.slice(0, 20)) log(`   ≠ ${JSON.stringify(k)}\n     → ${JSON.stringify(v)}`);
  }
  // a missing text next to a similar unused key → probably reworded
  const missingEn = [...used.keys()].filter((k) => !(k in dicts.en));
  for (const k of missingEn) {
    const best = unusedEn.map((o) => [o, similarity(k, o)]).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] >= 0.6) log(`   ↪ reworded? node tools/i18n.mjs rename ${JSON.stringify(best[0])} ${JSON.stringify(k)}`);
  }
  log(`${used.size} texts found · ${dynamic} t(…) calls with a non-literal argument are not checked`);
  return problems;
}

export function rename(oldText, newText) {
  let keys = 0, code = 0;
  for (const l of LANGS) {
    const d = readDict(l);
    if (!(oldText in d)) continue;
    if (newText in d && newText !== oldText) throw new Error(`${l}.js already has ${JSON.stringify(newText)}`);
    // keep the position of the key in the file
    writeDict(l, Object.fromEntries(Object.entries(d).map(([k, v]) => [k === oldText ? newText : k, v])));
    keys++;
  }
  const from = `'${escapeJs(oldText)}'`, to = `'${escapeJs(newText)}'`;
  for (const f of codeFiles()) {
    if (f.includes(join('lib', 'i18n') + '/')) continue;
    const src = readFileSync(f, 'utf8');
    const n = src.split(from).length - 1;
    if (n) { writeFileSync(f, src.split(from).join(to)); code += n; console.log(`   ${relative(ROOT, f)}: ${n}×`); }
  }
  return { keys, code };
}

export async function unused() {
  const { used } = await usedTexts();
  const lit = allLiterals();
  const en = readDict('en');
  return Object.keys(en).filter((k) => !used.has(k) && !lit.has(k));
}

// ---- command line ----
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === 'check') {
    process.exit((await check()) ? 1 : 0);
  } else if (cmd === 'rename') {
    if (args.length !== 2) { console.error('usage: node tools/i18n.mjs rename "<old text>" "<new text>"'); process.exit(2); }
    const r = rename(args[0], args[1]);
    console.log(`✓ renamed in ${r.keys} dictionaries and ${r.code} place(s) in the code`);
    if (!r.keys) process.exit(1);
  } else if (cmd === 'unused' || cmd === 'prune') {
    const list = await unused();
    for (const k of list) console.log(`   · ${JSON.stringify(k)}`);
    console.log(`${list.length} unused key(s)`);
    if (cmd === 'prune') {
      if (!args.includes('--yes')) { console.log('dry run — add --yes to remove them from all dictionaries'); process.exit(0); }
      for (const l of LANGS) { const d = readDict(l); for (const k of list) delete d[k]; writeDict(l, d); }
      console.log(`✓ removed from ${LANGS.length} dictionaries`);
    }
  } else {
    console.error(`unknown command ${cmd}`);
    process.exit(2);
  }
}
