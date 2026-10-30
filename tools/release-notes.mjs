// Release notes of one version (default: the newest) as Markdown, from lib/changelog.js — English first,
// then Indonesian. Used by .github/workflows/release.yml for the GitHub release text.
// Usage: node tools/release-notes.mjs [x.y.z]
import { CHANGELOG } from '../lib/changelog.js';
import { readDict } from './i18n.mjs';

const want = process.argv[2]?.replace(/^v/, '') || CHANGELOG[0].v;
const r = CHANGELOG.find((x) => x.v === want);
if (!r) { console.error(`no Change Log entry for v${want}`); process.exit(1); }
const en = readDict('en');
console.log([
  `## LoU Revival Helper v${r.v} — ${r.date}`, '',
  ...r.items.map((i) => `- ${en[i] || i}`), '',
  '<details><summary>🇮🇩 Bahasa Indonesia</summary>', '', ...r.items.map((i) => `- ${i}`), '', '</details>', '',
  'Install: Chrome/Edge — unzip and *Load unpacked*; Firefox — the `.xpi`; Safari — see the README.'
].join('\n'));
