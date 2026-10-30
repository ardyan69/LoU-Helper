// tools/i18n.mjs on a scratch copy: rename keeps translations, check finds broken placeholders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'lou-i18n-'));
  for (const d of ['lib', 'views', 'tools']) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  for (const f of ['dashboard.js', 'popup.js', 'background.js', 'content.js', 'package.json']) cpSync(join(ROOT, f), join(dir, f));
  return dir;
}
const run = (dir, ...args) => { try { return { code: 0, out: execFileSync(process.execPath, [join(dir, 'tools', 'i18n.mjs'), ...args], { encoding: 'utf8' }) }; } catch (e) { return { code: e.status, out: e.stdout + e.stderr }; } };

test('rename: a reworded text keeps its translations in every language and is renamed in the code', () => {
  const dir = scratch();
  try {
    const old = 'Kirim notifikasi tes', neu = 'Kirim notifikasi percobaan';
    const r = run(dir, 'rename', old, neu);
    assert.equal(r.code, 0, r.out);
    const en = readFileSync(join(dir, 'lib', 'i18n', 'en.js'), 'utf8');
    assert.ok(en.includes(JSON.stringify(neu)) && !en.includes(JSON.stringify(old)));
    assert.ok(readFileSync(join(dir, 'views', 'settings.js'), 'utf8').includes(`t('${neu}')`));
    assert.equal(run(dir, 'check').code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('check: a reworded text without rename is reported with a rename suggestion; broken placeholders too', () => {
  const dir = scratch();
  try {
    const f = join(dir, 'views', 'settings.js');
    writeFileSync(f, readFileSync(f, 'utf8').replace("t('Kirim notifikasi tes')", "t('Kirim notifikasi tes sekarang')"));
    let r = run(dir, 'check');
    assert.equal(r.code, 1);
    assert.match(r.out, /reworded\? node tools\/i18n\.mjs rename "Kirim notifikasi tes" "Kirim notifikasi tes sekarang"/);
    const de = join(dir, 'lib', 'i18n', 'de.js');
    writeFileSync(de, readFileSync(de, 'utf8').replace('"{n} Städte"', '"{x} Städte"'));
    r = run(dir, 'check');
    assert.match(r.out, /de: .*with other \{placeholders\}\/<tags>/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
