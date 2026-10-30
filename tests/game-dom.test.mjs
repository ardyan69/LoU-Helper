// Page readers (lib/game-dom.js) against saved game HTML (tests/fixtures), and the 🩺 diagnostics verdicts.
// When a game update changes its interface: save the new HTML as a fixture, adjust lib/game-dom.js until this passes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import '../lib/game-dom.js';
import { diagnose, verdict } from '../lib/diagnose.js';
import { panelInfo, withPanelInfo } from '../lib/cheatsheet.js';
import { applyChanges } from '../lib/shared.js';

const D = globalThis.LOU_DOM;
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const page = (f) => parseHTML(`<!doctype html><html><body>${readFileSync(join(FIX, f), 'utf8')}</body></html>`).document;

test('parseNum: every number format the game or a locale may use', () => {
  const cases = { '34630': 34630, '34,630': 34630, '34.630': 34630, '34\u202f630': 34630, '34\u00a0630': 34630, '1,234,567': 1234567, '1.234.567': 1234567,
    '1.234,5': 1235, '7.000': 7000, '1.5k': 1500, '1,5k': 1500, '2m': 2000000, '-250': -250, '-1.234': -1234, '+3.300': 3300, '37': 37, '1.5': 2 };
  for (const [s, v] of Object.entries(cases)) assert.equal(D.parseNum(s), v, s);
  for (const s of [null, '', 'abc', '12abc']) assert.equal(D.parseNum(s), null, String(s));
});

test('numbersIn keeps grouped numbers together and splits lists', () => {
  assert.deepEqual(D.numbersIn('Wood 34630 of 122000, 3300 per hour'), [34630, 122000, 3300]);
  assert.deepEqual(D.numbersIn('Holz 34.630 von 122.000, 3.300 pro Stunde'), [34630, 122000, 3300]);
  assert.deepEqual(D.numbersIn('Bois 34\u202f630 sur 122\u202f000, 3\u202f300 par heure'), [34630, 122000, 3300]);
  assert.deepEqual(D.numbersIn('Gold 11488, 2361 per hour'), [11488, 2361]);
  assert.deepEqual(D.numbersIn('Food 5000 of 122000, -250 per hour'), [5000, 122000, -250]);
});

test('parseDur & parseCoord', () => {
  assert.equal(D.parseDur('2h 15m'), (2 * 60 + 15) * 60000);
  assert.equal(D.parseDur('1d 3h'), 27 * 3.6e6);
  assert.equal(D.parseDur('1j 5m'), 65 * 60000); // Indonesian "jam"
  assert.equal(D.parseDur('45s'), 45000);
  assert.equal(D.parseDur('01:02:03'), 3723000);
  assert.equal(D.parseDur('12:30'), 750000);
  assert.equal(D.parseDur('soon'), null);
  assert.deepEqual(D.parseCoord('C12 · 100:200'), { cont: 12, x: 100, y: 200, key: '100:200' });
  assert.deepEqual(D.parseCoord('K12 · 100 : 200 · Punkte 5'), { cont: 12, x: 100, y: 200, key: '100:200' });
  assert.equal(D.parseCoord('no coordinates'), null);
});

test('open city: chip, resource bar, queue, buildings (English page)', () => {
  const doc = page('city-view.html');
  assert.deepEqual(D.readActiveCity(doc), { cont: 12, x: 100, y: 200, key: '100:200', name: 'Alpha Keep' });
  assert.deepEqual(D.readResources(doc), {
    wood: { v: 34630, cap: 122000, rate: 3300 }, stone: { v: 1200, cap: 122000, rate: 0 }, iron: { v: 99000, cap: 122000, rate: 1540 },
    food: { v: 5000, cap: 122000, rate: -250 }, gold: { v: 11488, rate: 2361 }
  });
  assert.equal(D.readQueueCount(doc), 3);
  assert.deepEqual(D.readBuildings(doc), { used: 79, max: 80 });
  const q = D.readQueuePanel(doc, 1000);
  assert.deepEqual(q, { endsAt: 1000 + 135 * 60000, nextAt: 1000 + 45 * 60000, count: 3 });
});

test('resource bar in other game languages (German, French)', () => {
  const de = page('city-view-de.html');
  assert.equal(D.readActiveCity(de).key, '100:200');
  assert.deepEqual(D.readResources(de), { wood: { v: 34630, cap: 122000, rate: 3300 }, food: { v: 5000, cap: 122000, rate: -250 }, gold: { v: 11488, rate: 2361 } });
  assert.deepEqual(D.readResources(page('city-view-fr.html')), { wood: { v: 34630, cap: 122000, rate: 3300 }, gold: { v: 11488, rate: 2361 } });
  assert.equal(D.readQueuePanel(de, 0), null, 'no Construction panel open');
});

test('"Your cities" list: English title, or any language through the player\'s own cities', () => {
  const doc = page('city-list.html');
  const [en, de, other] = ['#en', '#de', '#other'].map((s) => doc.querySelector(s));
  const own = new Set(['100:200', '103:205']);
  assert.ok(D.isCityList(en, new Set()));
  assert.ok(!D.isCityList(de, new Set()), 'German title alone is not recognised…');
  assert.ok(D.isCityList(de, own), '…but the rows are the own cities');
  assert.ok(!D.isCityList(other, own));
  const rows = D.readCityList(en);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { cont: 12, x: 100, y: 200, key: '100:200', name: 'Alpha Keep', score: 1234, troops: 5200, group: 'Military' });
  const deRows = D.readCityList(de);
  assert.deepEqual(deRows.map((r) => [r.key, r.score, r.troops]), [['100:200', 1234, 5200], ['103:205', 980, 120]]);
});

test('dungeon & boss panels', () => {
  const doc = page('dungeon.html');
  const en = D.readDungeonPanel(doc.querySelector('#en'), new Map());
  assert.deepEqual(en, { key: '101:202', cont: 12, x: 101, y: 202, kind: 'dungeon', type: 'Mountain', level: 7, explored: 37 });
  const boss = D.readDungeonPanel(doc.querySelector('#boss'), new Map());
  assert.equal(boss.kind, 'boss');
  assert.equal(boss.type, 'Dragon');
  // German panel: not understood by its title or labels — but the coordinates are a dungeon known from the map
  assert.equal(D.readDungeonPanel(doc.querySelector('#de'), new Map()), null);
  const known = new Map([['101:202', { kind: 'dungeon', type: 'Mountain', level: 7, explored: 36.5 }]]);
  const de = D.readDungeonPanel(doc.querySelector('#de'), known);
  assert.equal(de.type, 'Mountain');
  assert.equal(de.level, 7);
  assert.equal(de.explored, 36.5);
  assert.equal(D.readDungeonPanel(doc.querySelector('#building'), known), null, 'a building panel is not a dungeon');
});

test('game icons: English names from the build bar and images', () => {
  const icons = D.readIcons(page('city-view.html'));
  assert.deepEqual(Object.keys(icons).sort(), ['Farm', 'Forest']);
  assert.equal(icons.Farm, 'data:image/png;base64,FARM');
});

test('dungeon/boss panel values come from the game data (same tables as the game, any language)', () => {
  // game: Guardians = strength[level-1] = round(loot × 0.5), Max loot = loot[level-1]; bosses: Health, Loot
  assert.deepEqual(panelInfo({ kind: 'dungeon', type: 'Forest', level: 7 }), { kind: 'forest', guardians: 60000, maxLoot: 120000, weakTo: 'Cavalry' });
  assert.deepEqual(panelInfo({ kind: 'dungeon', type: 'Mountain', level: 7 }), { kind: 'mountain', guardians: 73000, maxLoot: 146000, weakTo: 'Infantry' });
  assert.equal(panelInfo({ kind: 'dungeon', type: 'Sea', level: 1 }).weakTo, 'Artillery');
  assert.deepEqual(panelInfo({ kind: 'boss', type: 'Dragon', level: 5 }), { kind: 'dragon', hp: 125000, maxLoot: 100000, weakTo: 'Cavalry' });
  assert.equal(panelInfo({ kind: 'boss', type: 'Kraken', level: 1 }).kind, 'octopus');
  assert.equal(panelInfo({ type: 'Mountain', level: 0 }), null);
  assert.equal(panelInfo({ type: 'Unknown', level: 3 }), null);
  // values typed in by hand win; missing ones are filled
  assert.deepEqual(withPanelInfo({ kind: 'dungeon', type: 'Hill', level: 2, maxLoot: 999 }), { kind: 'dungeon', type: 'Hill', level: 2, maxLoot: 999, guardians: 300, weakTo: 'Magic' });
  // …and the dashboard state applies it to every stored dungeon
  const st = {};
  applyChanges(st, { dungeons: { newValue: { '1:1': { kind: 'dungeon', type: 'Forest', level: 1 } } } });
  assert.equal(st.dungeons['1:1'].guardians, 50);
});

test('every game building/node code has an icon name (the page hook sends codes)', () => {
  assert.equal(Object.keys(D.ICON_BY_CODE).length, 28);
  assert.equal(new Set(D.ICON_NAMES).size, 28);
  const hook = readFileSync(join(FIX, '..', '..', 'page-hook.js'), 'utf8');
  const codes = Object.keys(Object.fromEntries([...hook.match(/const CODE = \{([\s\S]*?)\};/)[1].matchAll(/(\w+):/g)].map((m) => [m[1], 1])));
  assert.deepEqual(codes.sort(), Object.keys(D.ICON_BY_CODE).sort());
});

// ---- 🩺 diagnostics ----
const okTab = () => ({
  gameLang: 'en', ownCities: 7, knownDungeons: 40, visible: true,
  hook: { v: 10, via: 'store', lastSnapAt: 1, foundAt: 1, mutable: false, shape: [], errors: 0 },
  diag: {
    msgs: { 'cities-store': { n: 3, at: 1 }, movements: { n: 9, at: 1 }, 'city-state': { n: 7, at: 1 }, 'map-dungeons': { n: 1, at: 1 } },
    readers: { cityChip: { okAt: 5 }, resourceBar: { okAt: 5 } }, storage: { okAt: 5 }
  }
});
const status = (rows) => Object.fromEntries(rows.map((r) => [r.id, r.status]));

test('diagnose: healthy game tab → ok; optional panels not opened are not problems', () => {
  const rows = diagnose({ tab: okTab(), stored: { gameIcons: Object.fromEntries(D.ICON_NAMES.map((n) => [n, 'x'])) } });
  const s = status(rows);
  assert.equal(verdict(rows), 'ok');
  assert.equal(s.hook, 'ok');
  assert.equal(s.queuePanel, 'idle');
  assert.equal(s.dungeonPanel, 'idle');
});

test('diagnose: what a game update looks like', () => {
  const tab = okTab();
  tab.hook.shape = ['city.grid[441]', 'city.res'];
  tab.diag.readers.resourceBar = { okAt: 5, failAt: 9 }; // read before, not any more
  const s = status(diagnose({ tab, stored: {} }));
  assert.equal(s.shape, 'bad');
  assert.equal(s.resourceBar, 'warn');
  const t2 = okTab();
  t2.hook = { v: 10, via: null, foundAt: null, shape: [] }; // game state not found at all
  t2.diag.msgs = {};
  const rows = diagnose({ tab: t2, stored: {} });
  assert.equal(status(rows).hook, 'bad');
  assert.equal(rows.find((r) => r.id === 'hook').detail, 'not-found');
  assert.equal(verdict(rows), 'bad');
  const t3 = okTab();
  t3.hook = null; // content script there, page hook silent
  assert.equal(diagnose({ tab: t3, stored: {} }).find((r) => r.id === 'hook').detail, 'no-answer');
});

test('diagnose: a non-English game is not a problem; storage errors are', () => {
  const tab = okTab();
  tab.gameLang = 'de';
  tab.diag.readers.dungeonPanel = { okAt: 5 };
  tab.diag.storage = { okAt: 1, err: 'QUOTA_BYTES quota exceeded', errAt: 9 };
  const rows = diagnose({ tab, stored: { gameIcons: { Farm: 'x' } } });
  const s = status(rows);
  assert.equal(s.dungeonPanel, 'ok');
  assert.equal(s.icons, 'idle');
  assert.equal(s.storage, 'bad');
  assert.ok(!rows.some((r) => r.status === 'warn'), 'no language warnings');
});

test('diagnose: no game tab → saved data only', () => {
  const rows = diagnose({ tab: null, stored: { cities: { a: { syncedAt: 50 } }, movements: { at: 40 }, layouts: [{ source: 'game', capturedAt: 30 }] } });
  const s = status(rows);
  assert.equal(s.hook, 'bad');
  assert.equal(s.cities, 'idle');
  assert.equal(rows.find((r) => r.id === 'cities').at, 50);
});
