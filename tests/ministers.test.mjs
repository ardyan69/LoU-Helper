// 🎩 Ministers: build plan export, recommendations, commands. Run: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { N, TOWNHALL, blank, isBuilding, B } from '../lib/city.js';
import { militaryTemplate, hubTemplate, troopSpace } from '../lib/templates.js';
import { planToMinister, typeLevelsFrom, recBuild, recDefense, recWar, recTrade, tradeCmd, sameConfig, cityRole, raidCover, raidCoverAvg } from '../lib/ministers.js';

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
  const L = rw.config.maxLevel;
  assert.ok(raidCover(A.home, L) >= 1);
  // the level where ≤ 5 armies use the troops (or the strongest level the troops can still clear)
  assert.ok(raidCoverAvg(A.home, L) <= 5 || L === 10 || raidCover(A.home, L + 1) < 1);
  assert.equal(rw.config.maxArmies, Math.max(1, Math.min(5, Math.floor(raidCoverAvg(A.home, L)))));
  assert.ok(rw.info.lootH > 0);
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

test('war: incoming attack pauses raids, frontline keeps defenders home', () => {
  const S = mkState([]);
  const now = 1_000_000_000_000;
  const A = { id: 'A', key: '10:10', x: 10, y: 10, home: { berserker: 2000, ranger: 2000 } };
  S.movements.incoming = [{ toX: 10, toY: 10, arriveAt: now + 3600000 }];
  assert.equal(recWar(S, A, now).config.enabled, false);
  S.movements.incoming = [];
  S.attackLog = [{ toX: 10, toY: 10, arriveAt: now - 864e5 }];
  const r = recWar(S, A, now);
  assert.deepEqual(r.config.units, ['berserker']);
  assert.equal(r.config.keepHomePct, 0.3);
  assert.equal(recWar(S, { ...A, home: {} }, now).config.enabled, false); // nothing to raid with
});

test('trade: one hub per continent, lone cities only by sea', () => {
  const p = blank(false); p.levels[TOWNHALL] = 10;
  const eco = (key) => { const c = p.cells.split(''); let k = 0; for (let i = 0; i < N * N && k < 40; i++) if (c[i] === '-') { c[i] = k % 3 ? '2' : 'C'; k++; } return { ...p, cells: c.join(''), source: 'game', live: true, cityKey: key }; };
  const hubL = (key) => ({ ...hubTemplate({ ...p, cityKey: key }, { iters: 8000, restarts: 1 }).plan, source: 'game', live: true, cityKey: key });
  const keys = ['10:10', '30:30', '150:20', '160:30', '450:450'];
  const S = mkState([eco('10:10'), hubL('30:30'), eco('150:20'), hubL('160:30'), eco('450:450')]);
  const cities = keys.map((k, i) => { const [x, y] = k.split(':').map(Number); return { id: 'c' + i, key: k, x, y, home: {} }; });
  const r = recTrade(S, cities);
  assert.equal(r.hubs[0].c.id, 'c1');
  assert.equal(r.hubs[1].c.id, 'c3');
  assert.equal(r.settings.cities.c0.requestFrom, 'c1');
  assert.equal(r.settings.cities.c2.requestFrom, 'c3'); // its own continent's hub, not the first one
  assert.equal(r.settings.cities.c4.requestFrom, undefined); // alone on C44, no ships
  assert.ok(r.why.c4.includes('trade-alone'));
});
