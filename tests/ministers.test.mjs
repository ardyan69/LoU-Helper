// 🎩 Ministers: build plan export, recommendations, commands. Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { N, TOWNHALL, blank, isBuilding, B } from '../lib/city.js';
import { militaryTemplate, hubTemplate, troopSpace } from '../lib/templates.js';
import { planToMinister, typeLevelsFrom, recBuild, recDefense, recWar, recTrade, tradeCmd, sameConfig, cityRole, raidCover } from '../lib/ministers.js';

const base = () => { const p = blank(false); p.levels[TOWNHALL] = 3; return { ...p, source: 'game', live: true, cityKey: '10:10', name: 'C' }; };
const mkState = (layouts, extra = {}) => ({
  layouts, cities: { '10:10': { key: '10:10', x: 10, y: 10 }, '20:20': { key: '20:20', x: 20, y: 20 } }, dungeons: {}, attackLog: [],
  movements: { research: {}, training: [{ id: 'A', x: 10, y: 10, name: 'Alpha', units: { berserker: 3000 } }, { id: 'H', x: 20, y: 20, name: 'Hub', units: {} }],
    ministers: { build: { cities: {} }, defense: { cities: {} }, military: { cities: {} }, trade: { cities: { X: { target: { wood: 1 }, surplus: 'keep' } }, minShipment: 500 } } },
  ...extra
});

test('build plan: every planned building once, smart order, game type names', () => {
  const b = base();
  const plan = militaryTemplate(b, { ts: 30000, iters: 20000, restarts: 1 }).plan;
  const list = planToMinister(plan, b);
  const slots = new Set(list.map((x) => x.slot));
  assert.equal(slots.size, list.length);
  let n = 0;
  for (let i = 0; i < N * N; i++) if (isBuilding(plan.cells[i])) { n++; assert.ok(slots.has(i), `slot ${i}`); }
  assert.equal(list.filter((x) => x.slot !== TOWNHALL).length, n);
  for (const x of list) if (x.slot !== TOWNHALL) assert.equal(x.type, B[plan.cells[x.slot]].id);
  assert.ok(list.some((x) => x.type === 'townhall')); // 100 buildings need Town Hall 10
  const tl = typeLevelsFrom(list, { farm: 3 });
  assert.equal(tl.training_ground, 10);
  assert.equal(tl.farm, 3);
});

test('recommendations: build / defense / war / trade', () => {
  const b = base();
  const mil = militaryTemplate(b, { ts: 30000, iters: 20000, restarts: 1 }).plan;
  const hub = { ...hubTemplate({ ...b, cityKey: '20:20' }, { iters: 20000, restarts: 1 }).plan, source: 'game', live: true, cityKey: '20:20' };
  const S = mkState([{ ...mil, source: 'game', live: true, cityKey: '10:10' }, hub]);
  const A = { id: 'A', key: '10:10', x: 10, y: 10, castle: true, home: { berserker: 3000 } };
  assert.equal(cityRole(S.layouts[0]), 'military');
  assert.equal(cityRole(hub), 'hub');
  const rb = recBuild(S, A);
  assert.equal(rb.config.keepQueued, 4);
  assert.equal(rb.config.wallLevel, 10); // castle
  assert.equal(rb.config.typeLevels.training_ground, 10);
  const rbp = recBuild(S, A, { plan: { ...mil, source: 'manual' } });
  assert.ok(rbp.config.plan.length > 50 && rbp.config.evenBuild === false && rbp.config.demolishUnplanned === true);
  const rd = recDefense(S, A);
  assert.equal(rd.config.targets.berserker, troopSpace(S.layouts[0])); // fills the troop space (1 space each)
  assert.ok(rd.why.includes('def-food')); // a military layout has no farms
  const rw = recWar(S, A);
  assert.ok(rw.config.enabled && rw.config.units.includes('berserker'));
  assert.ok(raidCover(A.home, rw.config.maxLevel) >= 1.5);
  assert.ok(rw.config.maxLevel === 10 || raidCover(A.home, rw.config.maxLevel + 1) < 1.5);
  assert.equal(recWar(S, { ...A, home: {} }).config.enabled, false);
  const cities = [A, { id: 'H', key: '20:20', x: 20, y: 20, home: {} }];
  const rt = recTrade(S, cities);
  assert.equal(rt.hub.id, 'H');
  assert.equal(rt.settings.cities.A.requestFrom, 'H');
  assert.ok(rt.settings.cities.A.target.iron > rt.settings.cities.A.target.wood); // military city wants iron
  assert.deepEqual(rt.settings.cities.H.target, {});
});

test('trade command keeps untouched cities; config comparison ignores key order', () => {
  const S = mkState([]);
  const cmd = tradeCmd(S, { A: { target: { food: 5 }, surplus: 'keep' } });
  assert.equal(cmd.t, 'ministerTrade');
  assert.deepEqual(Object.keys(cmd.settings.cities).sort(), ['A', 'X']);
  assert.equal(cmd.settings.replace, true);
  assert.equal(cmd.settings.minShipment, 500);
  assert.ok(sameConfig({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }));
  assert.ok(!sameConfig({ a: 1 }, { a: 2 }));
});
