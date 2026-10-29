// Travel, attack planner, defense assistant, army food and research. Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { N, TOWNHALL, blank, fromGame, isBuilding } from '../lib/city.js';
import { continentOf, parseCoord, armyTravel, minPerField } from '../lib/travel.js';
import { planAttack, defenseOptions, ownCities } from '../lib/ops.js';
import { upkeepPerHour, cityFood, mainUnit, planFood } from '../lib/food.js';
import { rpct, prodFactors } from '../lib/research.js';
import { militaryTemplate } from '../lib/templates.js';

const MIN = 60000;
const state = (extra = {}) => ({
  settings: { units: [{ id: 'berserker', minPerField: 20 }, { id: 'knight', minPerField: 10 }, { id: 'frigate', minPerField: 5 }] },
  speedCal: { factor: 1 },
  cities: {},
  movements: { serverOffset: 0, worldSpeed: 1, research: { food: 4, military: 3, construction: 2 }, training: [], armies: [], incoming: [] },
  ...extra
});

test('continents & coordinates', () => {
  assert.equal(continentOf(250, 430), 42); // example from the game guide
  assert.equal(continentOf(99, 99), 0);
  assert.deepEqual(parseCoord('312:245'), { x: 312, y: 245 });
  assert.deepEqual(parseCoord(' 12 | 7 '), { x: 12, y: 7 });
  assert.equal(parseCoord('abc'), null);
});

test('travel: slowest unit, continent rule, frigates, calibration', () => {
  const S = state();
  const a = { x: 110, y: 110 }, b = { x: 110, y: 120 };
  assert.equal(armyTravel(S, a, b, { berserker: 5, knight: 5 }).ms, 10 * 20 * MIN);
  assert.equal(armyTravel(S, a, b, { knight: 5 }).ms, 10 * 10 * MIN);
  const far = { x: 210, y: 110 };
  assert.equal(armyTravel(S, a, far, { knight: 5 }).reason, 'continent');
  const short = armyTravel(S, a, far, { berserker: 1001, frigate: 2 });
  assert.equal(short.reason, 'frigate');
  assert.equal(short.need, 3);
  const ok = armyTravel(S, a, far, { berserker: 1000, frigate: 2 });
  assert.ok(ok.ok);
  assert.equal(ok.ms, 100 * 5 * MIN); // ships set the pace
  assert.equal(armyTravel(S, a, b, { cityguard: 10 }).reason, 'immobile');
  assert.equal(minPerField({ ...S, speedCal: { factor: 0.5 } }, 'ram'), 15); // not in settings: base 30 × factor
});

test('attack planner: waves land together / in order, late rows flagged', () => {
  const S = state();
  const now = 1_000_000_000_000;
  const target = { x: 120, y: 120 };
  const rows = [
    { key: 'A', from: { x: 120, y: 100 }, units: { berserker: 10 }, wave: 1 }, // 20 fields × 20 = 400 min
    { key: 'B', from: { x: 120, y: 110 }, units: { knight: 10 }, wave: 2 } // 10 × 10 = 100 min
  ];
  const p = planAttack(rows, { state: S, target, gap: 2, ready: 0, now });
  const [A, B] = p.rows;
  assert.equal(A.arriveAt, p.first);
  assert.equal(B.arriveAt, p.first + 2000);
  assert.equal(A.sendAt, A.arriveAt - 400 * MIN);
  assert.ok(A.sendAt >= now && !A.late && !B.late);
  const fixed = planAttack(rows, { state: S, target, arriveAt: now + 200 * MIN, gap: 0, now });
  assert.ok(fixed.rows[0].late);
  assert.ok(!fixed.rows[1].late);
});

test('defense assistant: who can reach in time, frigate transport, battle estimate', () => {
  const now = 1_000_000_000_000;
  const S = state({
    cities: { '120:120': { key: '120:120', name: 'Home', x: 120, y: 120, wallLevel: 5 }, '120:110': { key: '120:110', name: 'Near', x: 120, y: 110 }, '220:120': { key: '220:120', name: 'Island', x: 220, y: 120 } },
    movements: {
      serverOffset: 0, research: { military: 3 },
      training: [
        { x: 120, y: 120, name: 'Home', units: { ranger: 1000 } },
        { x: 120, y: 110, name: 'Near', units: { berserker: 500, knight: 300 } },
        { x: 220, y: 120, name: 'Island', units: { berserker: 2000, frigate: 2 } }
      ]
    }
  });
  const inc = { toX: 120, toY: 120, arriveAt: now + 150 * MIN, order: 'assault', owner: 'X', units: { knight: 400 } };
  const d = defenseOptions(S, inc, now);
  assert.equal(d.reach.knight, 300); // 100 min
  assert.ok(!d.reach.berserker); // 200 min: too late
  const island = d.options.find((o) => o.key === '220:120').units.find((u) => u.id === 'berserker');
  assert.equal(island.n, 1000); // 2 frigates × 500 troop space
  assert.equal(island.frigates, 2);
  assert.ok(d.estimate && d.estimate.attFrom === 'visible');
  assert.ok(d.estimate.withSupport.w > d.estimate.homeOnly.w);
  // hidden attacker: falls back to the attack log
  const d2 = defenseOptions(S, { ...inc, units: null }, now, [{ owner: 'X', units: { berserker: 50 } }, { owner: 'X', units: { berserker: 900 } }]);
  assert.equal(d2.estimate.attFrom, 'history');
  assert.equal(d2.estimate.att.berserker, 900);
  assert.equal(ownCities(S).length, 3);
});

test('food: per-day upkeep, only troops at home eat, empty time', () => {
  assert.equal(upkeepPerHour({ berserker: 24, knight: 24 }), 6 + 25);
  const now = 1_000_000_000_000;
  const p = militaryTemplate(blank(false), { ts: 50000, iters: 20000, restarts: 1 }).plan;
  p.levels[TOWNHALL] = 10;
  assert.equal(mainUnit(p).id, 'berserker'); // hungriest unlocked Training Ground unit per troop space
  const f0 = planFood(p, 0);
  assert.equal(Math.round(f0.eat), Math.round((f0.ts * 6) / 24));
  const S = state({
    cities: { '10:10': { key: '10:10', name: 'C', x: 10, y: 10, seenAt: now, res: { food: { v: 24000, cap: 100000, rate: -1000 } } } },
    layouts: [{ ...p, source: 'game', cityKey: '10:10' }],
    movements: { research: { food: 0 }, training: [{ x: 10, y: 10, units: { berserker: 4000 }, queue: [{ unit: 'berserker', count: 100, done: 20 }] }],
      armies: [{ order: 'raid', units: { berserker: 2000 }, home: { x: 10, y: 10 } }] }
  });
  const f = cityFood(S, '10:10', now);
  assert.equal(f.eatHome, 1000); // only the 4,000 at home
  assert.equal(f.all.berserker, 6080); // home + away + queued
  assert.equal(f.gross, 0); // no farms in the military plan
  assert.equal(f.netNow, -1000);
  assert.equal(f.emptyAt, now + 24 * 3.6e6);
  assert.ok(f.netFull < f.netAll && f.netAll < f.netNow);
});

test('research levels → bonus %', () => {
  const S = state();
  assert.equal(rpct(S, 'food'), 10);
  assert.equal(rpct(S, 'military'), 6);
  assert.equal(rpct(S, 'wood'), 0);
  assert.equal(prodFactors(S).food, 1.1);
  assert.equal(prodFactors({}).wood, 1);
});

test('game layout sync keeps the Town Hall level', () => {
  const levels = Array(N * N).fill(0);
  levels[TOWNHALL] = 7;
  const cells = '-'.repeat(N * N);
  const p = fromGame(cells, levels, false);
  assert.equal(p.levels[TOWNHALL], 7);
  assert.ok(!isBuilding(p.cells[TOWNHALL]));
});

test('refresh all cities: rates & capacity computed from the synced layout', async () => {
  const { calcRates, refreshAllRates } = await import('../lib/cityrates.js');
  const p = blank(false);
  p.levels[TOWNHALL] = 10;
  const S = { cities: { '5:5': { key: '5:5', res: { wood: { v: 100 }, food: { v: 50, rate: 999 } }, seenAt: 1 } },
    layouts: [{ ...p, source: 'game', live: true, cityKey: '5:5' }],
    movements: { research: { wood: 4 }, training: [{ x: 5, y: 5, units: { berserker: 48 } }] } };
  const r = calcRates(S, '5:5');
  assert.equal(r.rate.wood, 330); // Town Hall 300 × wood research +10%
  assert.equal(r.rate.food, -12); // 48 berserkers × 6/day
  assert.equal(r.cap.wood, 175000);
  const patch = refreshAllRates(S, 7);
  assert.equal(patch['5:5'].res.food.rate, -12);
  assert.equal(patch['5:5'].res.wood.calcAt, 7);
  assert.ok(!patch['5:5'].res.stone); // no stock value → not invented
});
