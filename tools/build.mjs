// Build the extension for every browser: dist/<browser>/ (unpacked) + dist/lou-helper-<version>-<browser>.zip
//   chrome  — Manifest V3 as in the source (service worker, page hook in the MAIN world)
//   edge    — identical to chrome (Edge is Chromium)
//   firefox — background as an event-page script (Firefox has no extension service workers), gecko id,
//             Firefox ≥ 128 (content scripts in the MAIN world); packaged as .xpi (zip)
//   safari  — classic service-worker script, page hook injected by the content script, no notifications;
//             convert the folder into an Xcode project with `xcrun safari-web-extension-converter`
// Usage: node tools/build.mjs [chrome|edge|firefox|safari …]   (needs `npm install` once for esbuild)
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
// development files (dot-files like .github are skipped too)
const EXCLUDE = new Set(['dist', 'node_modules', 'tests', 'tools', 'docs', 'package.json', 'package-lock.json', 'eslint.config.js', 'tsconfig.json', 'README.md', 'README.id.md', 'CHANGELOG.md', 'CHANGELOG.id.md']);
const base = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const VERSION = base.version;
const GECKO_ID = 'lou-revival-helper@ardhie';

const clone = (o) => JSON.parse(JSON.stringify(o));
const authorString = (m) => { if (m.author && typeof m.author === 'object') { m.author = 'ardhie'; } };

const TARGETS = {
  chrome: () => clone(base),
  edge: () => clone(base),
  firefox: () => {
    const m = clone(base);
    delete m.minimum_chrome_version;
    authorString(m);
    m.background = { scripts: ['background.js'] }; // bundled classic script, see bundleBackground()
    m.browser_specific_settings = { gecko: { id: GECKO_ID, strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } };
    return m;
  },
  safari: () => {
    const m = clone(base);
    delete m.minimum_chrome_version;
    authorString(m);
    m.background = { service_worker: 'background.js' }; // bundled classic script
    m.permissions = m.permissions.filter((p) => p !== 'notifications'); // not supported by Safari
    m.content_scripts = m.content_scripts.filter((c) => c.world !== 'MAIN'); // content.js injects page-hook.js
    return m;
  }
};

function copySource(out) {
  mkdirSync(out, { recursive: true });
  for (const name of readdirSync(ROOT)) {
    if (EXCLUDE.has(name) || name.startsWith('.')) continue;
    cpSync(join(ROOT, name), join(out, name), { recursive: true });
  }
}

async function bundleBackground(out) {
  let esbuild;
  try { esbuild = await import('esbuild'); } catch { throw new Error('esbuild missing — run `npm install` first'); }
  await esbuild.build({ entryPoints: [join(ROOT, 'background.js')], bundle: true, format: 'iife', target: ['es2020'], outfile: join(out, 'background.js'), legalComments: 'none', logLevel: 'warning' });
}

function zip(dir, file) {
  rmSync(file, { force: true });
  try { execFileSync('zip', ['-qr', file, '.'], { cwd: dir }); return true; }
  catch { console.warn(`  (zip not available — ${relative(ROOT, dir)} left unpacked)`); return false; }
}

const want = process.argv.slice(2).filter((a) => TARGETS[a]);
const list = want.length ? want : Object.keys(TARGETS);
mkdirSync(DIST, { recursive: true });
for (const name of list) {
  const out = join(DIST, name);
  rmSync(out, { recursive: true, force: true });
  copySource(out);
  const m = TARGETS[name]();
  if (name === 'firefox' || name === 'safari') await bundleBackground(out);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  const ext = name === 'firefox' ? 'xpi' : 'zip';
  const file = join(DIST, `lou-helper-${VERSION}-${name}.${ext}`);
  const ok = zip(out, file);
  const size = ok && existsSync(file) ? ` (${Math.round(statSync(file).size / 1024)} KB)` : '';
  console.log(`✓ ${name.padEnd(8)} dist/${name}/${ok ? `  →  ${relative(ROOT, file)}${size}` : ''}`);
}
