// "Refresh all cities" & the city overview's rates: the game keeps a stock snapshot per city (exact at resAt) and
// adds production/h itself; real rates from the game must win over estimates from the layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshAllRates, withEstimates, isRealRate, REAL_RATE_MS } from '../lib/cityrates.js';
import { projected } from '../lib/shared.js';
import { blank, TOWNHALL } from '../lib/city.js';

const NOW = Date.UTC(2026, 9, 31, 12);
const H = 3.6e6;
// a synced in-game layout with 8 woodcutters (no nodes → plain production)
function layout(key) {
  const b = blank(false), cells = b.cells.split(''), levels = [...(b.levels || Array(cells.length).fill(0))];
  for (const i of [100, 101, 102, 103, 120, 121, 122, 123]) { cells[i] = '2'; levels[i] = 10; }
  levels[TOWNHALL] = 10; // the Town Hall has storage too
  return { ...b, id: 'L' + key, source: 'game', cityKey: key, live: true, v: 2, cells: cells.join(''), levels, updatedAt: 1 };
}
const state = (cities) => ({ cities, layouts: Object.keys(cities).map(layout), movements: { research: null, training: [] } });

test('cities never opened in the game get a layout rate for display (≈), so their stock moves', () => {
  const c = { key: '1:1', seenAt: NOW - 2 * H, res: { wood: { v: 5000 }, food: { v: 100 } } };
  const e = withEstimates(state({ '1:1': c }), c);
  assert.ok(e.res.wood.rate > 0 && e.res.wood.est, 'estimated rate');
  assert.ok(e.res.wood.cap > 0);
  assert.ok(projected(e.res.wood, e.seenAt, NOW) > 5000, 'stock grows from the old snapshot');
  assert.equal(c.res.wood.rate, undefined, 'stored data untouched');
  // a city that has real rates is returned as is
  const real = { key: '2:2', seenAt: NOW, res: { wood: { v: 1, rate: 3600, cap: 9000, rateAt: NOW } } };
  assert.equal(withEstimates(state({ '2:2': real }), real), real);
});

test('Refresh all cities keeps the real production/h read from the game; replaces old or estimated ones', () => {
  const cities = {
    '1:1': { key: '1:1', seenAt: NOW, res: { wood: { v: 100, rate: 3600, cap: 50000, rateAt: NOW - H } } }, // real, recent
    '2:2': { key: '2:2', seenAt: NOW, res: { wood: { v: 100, rate: 3600, cap: 50000, rateAt: NOW - REAL_RATE_MS - 1 } } }, // real but old
    '3:3': { key: '3:3', seenAt: NOW, res: { wood: { v: 100, rate: 1, calcAt: NOW - H } } }, // earlier estimate
    '4:4': { key: '4:4', seenAt: NOW, res: { wood: { v: 100 } } } // no rate
  };
  const p = refreshAllRates(state(cities), NOW);
  assert.ok(!p['1:1'], 'recent real rate kept (city not in the patch)');
  assert.equal(p.realKept, 1);
  for (const k of ['2:2', '3:3', '4:4']) { assert.ok(p[k].res.wood.calcAt === NOW, k); assert.ok(p[k].res.wood.rate > 1, k); }
  assert.ok(isRealRate(cities['1:1'].res.wood, NOW));
  assert.ok(!isRealRate(cities['3:3'].res.wood, NOW));
});
