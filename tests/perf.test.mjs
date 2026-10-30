// Performance-related guarantees: dictionaries load on demand, dashboard state updates from change events.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDict, LANGS } from '../lib/i18n.js';
import { applyChanges, STATE_KEYS, mergeSettings } from '../lib/shared.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('every dictionary file can be fetched & parsed as JSON (lib/i18n.js loads them that way)', async () => {
  for (const [l] of LANGS) {
    if (l === 'auto' || l === 'id') continue;
    const text = readFileSync(join(ROOT, 'lib', 'i18n', `${l}.js`), 'utf8');
    assert.match(text.trim(), /^export default \{[\s\S]*\};$/, `${l}.js must stay "export default {…};"`);
    const viaImport = (await import(join(ROOT, 'lib', 'i18n', `${l}.js`))).default;
    assert.deepEqual(parseDict(text), viaImport, l);
  }
});

test('no page or worker imports the dictionaries statically', () => {
  for (const f of ['lib/i18n.js', 'lib/shared.js', 'popup.js', 'dashboard.js', 'background.js']) {
    assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /import\s[^;]*['"][^'"]*i18n\/(en|es|fr|de|it|hu|el)\.js['"]/, f);
  }
});

test('applyChanges updates the dashboard state in place with defaults', () => {
  const state = { cities: { a: 1 }, settings: mergeSettings({}), keep: 'x' };
  const keys = applyChanges(state, {
    cities: { newValue: { b: 2 } },
    settings: { newValue: { lang: 'en' } },
    lootLog: { newValue: undefined }, // removed → default
    gameIcons: { newValue: { x: 'data:' } }, // not part of the state
    incomingAlerts: { newValue: {} }
  });
  assert.deepEqual(keys.sort(), ['cities', 'lootLog', 'settings']);
  assert.deepEqual(state.cities, { b: 2 });
  assert.equal(state.settings.lang, 'en');
  assert.equal(state.settings.alerts.full, true, 'settings get their defaults');
  assert.deepEqual(state.lootLog, { days: {}, byCity: {} });
  assert.equal(state.keep, 'x');
  assert.ok(!('gameIcons' in state));
  assert.ok(STATE_KEYS.includes('history') && STATE_KEYS.includes('players'));
});
