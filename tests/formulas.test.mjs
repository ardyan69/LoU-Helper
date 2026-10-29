// Game formulas, templates and build order. Run: node --test tests/   (Node 18+, no dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import { N, TOWNHALL, blank, zone, isBuilding, producerOutput, warehouseOutput, cityStats, parseShareString, toShareString } from '../lib/city.js';
import { cityRecruitPct, recruitTime } from '../lib/cheatsheet.js';
import { troopSpace, hubStorage, militaryTemplate, hubTemplate } from '../lib/templates.js';
import { planSteps } from '../lib/buildorder.js';
import { BUILDINGS } from '../lib/gamedata.js';

const at = (x, y) => y * N + x;
// a land plan with the given {index: code} buildings at level 10 (or [code, level])
function plan(map = {}, water = false) {
  const p = blank(water);
  const cells = p.cells.split('');
  for (const [i, v] of Object.entries(map)) {
    const [c, l] = Array.isArray(v) ? v : [v, 10];
    cells[+i] = c;
    p.levels[+i] = isBuilding(c) ? l : 0;
  }
  p.levels[TOWNHALL] = 10;
  return { ...p, cells: cells.join(''), name: 'test' };
}
// small random-node city used by the template tests
function nodeCity(seed = 3, water = false) {
  const p = blank(water), c = p.cells.split('');
  let s = seed; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N * N; i++) if (c[i] === '-' && zone(i, water) === 'interior' && r() < 0.18) c[i] = '.:,;'[Math.floor(r() * 4)];
  return { ...p, cells: c.join(''), name: 'nodes' };
}
const FAST = { iters: 40000, restarts: 1 };

test('producer: base, nodes, cottage, processing (game rounding)', () => {
  const W = at(3, 3);
  assert.equal(producerOutput(plan({ [W]: '2' }), W).total, 300);
  assert.equal(producerOutput(plan({ [W]: '2', [at(4, 3)]: '.' }), W).total, 450); // +50%
  assert.equal(producerOutput(plan({ [W]: '2', [at(4, 3)]: '.', [at(2, 3)]: '.' }), W).total, 570); // +90%
  const full = producerOutput(plan({ [W]: '2', [at(4, 3)]: '.', [at(3, 4)]: 'C', [at(2, 2)]: 'L' }), W);
  assert.equal(full.total, Math.ceil(Math.ceil(450 * 1.3 - 1e-9) * 1.75 - 1e-9));
  assert.equal(producerOutput(plan({ [W]: ['2', 1] }), W).total, 20);
});

test('warehouse: +200% per bordering L10 processing building of that resource', () => {
  const S = at(5, 5);
  const p = plan({ [S]: 'S', [at(6, 5)]: 'L', [at(4, 5)]: 'L', [at(5, 6)]: 'A' });
  const o = warehouseOutput(p, S);
  assert.equal(o.out.wood, 1000000);
  assert.equal(o.out.stone, 600000);
  assert.equal(o.out.iron, 200000);
  assert.deepEqual(hubStorage(p), o.out);
});

test('troop space: (100 + Barracks) × (1 + Castle %)', () => {
  assert.equal(troopSpace(plan()), 100);
  assert.equal(troopSpace(plan({ [at(3, 3)]: 'B' })), 1100);
  assert.equal(troopSpace(plan({ [at(3, 3)]: 'B', [at(8, 8)]: 'X' })), 4400);
  assert.equal(troopSpace(plan({ [at(3, 3)]: ['B', 5], [at(8, 8)]: ['X', 1] })), Math.floor(260 * 1.2));
});

test('recruit %: building level + bordering Barracks (not for City Guard House)', () => {
  const g = cityRecruitPct(plan({ [at(3, 3)]: 'G', [at(4, 3)]: 'B', [at(2, 2)]: 'B', [at(6, 6)]: 'B' }));
  assert.equal(g[1].pct, 150 + 25 + 25);
  assert.equal(g[1].barracks, 2);
  const k = cityRecruitPct(plan({ [at(3, 3)]: 'K', [at(4, 3)]: 'B' }));
  assert.equal(k[0].pct, 150);
  assert.equal(recruitTime(200, 100), 100);
  assert.equal(recruitTime(200, 0), 200);
});

test('share string round trip', () => {
  const p = plan({ [at(3, 3)]: '2', [at(4, 3)]: '.', [at(5, 5)]: 'S', [at(8, 8)]: 'G' });
  const back = parseShareString(toShareString(p));
  assert.equal(back.cells, p.cells);
});

function checkLayout(out, limit) {
  let n = 0;
  for (let i = 0; i < N * N; i++) {
    const c = out.cells[i];
    if (!isBuilding(c)) continue;
    n++;
    const z = zone(i, out.water);
    assert.ok(z === 'interior' || z === 'shore', `building ${c} on ${z} at ${i}`);
    if (z === 'shore') assert.ok(['R', 'V'].includes(c), `${c} on the shore at ${i}`);
    else assert.ok(!['R', 'V'].includes(c), `${c} away from the shore at ${i}`);
  }
  assert.ok(n <= limit, `${n} buildings > ${limit} slots`);
  return n;
}

test('military template: TS target, slot limit, valid plots, beats no-Barracks', () => {
  const base = nodeCity();
  const r = militaryTemplate(base, { group: 'G', ts: 84000, ...FAST });
  assert.ok(r.stats.ts >= 84000);
  assert.ok(r.stats.nBar >= r.stats.minBar);
  assert.equal(checkLayout(r.plan, 100), 100);
  assert.ok(r.plan.cells.includes('X'));
  assert.ok(r.stats.pct > 99 * 150, 'Barracks should push recruit % above 99 bare buildings');
  for (let i = 0; i < N * N; i++) if ('.:,;'.includes(base.cells[i])) assert.equal(r.plan.cells[i], base.cells[i], 'nodes stay');
});

test('military template: two groups follow the share, extras are placed', () => {
  const r = militaryTemplate(nodeCity(), { group: 'G', group2: 'E', share2: 0.3, ts: 84000, extras: { C: 3, S: 2 }, ...FAST });
  const share = r.stats.pct2 / (r.stats.pct + r.stats.pct2);
  assert.ok(Math.abs(share - 0.3) < 0.05, `share ${share}`);
  assert.deepEqual(r.stats.extras, { C: 3, S: 2 });
  checkLayout(r.plan, 100);
});

test('military template: shipyards only on the shore', () => {
  const r = militaryTemplate(blank(true), { group: 'V', ts: 0, ...FAST });
  assert.ok(r.stats.nRec > 0);
  checkLayout(r.plan, 100);
});

test('hub template: balanced storage, markets, slot limit', () => {
  const r = hubTemplate(nodeCity(), { markets: 10, extras: { C: 2 }, ...FAST });
  const st = Object.values(r.stats.storage);
  assert.ok(Math.min(...st) >= 20e6, `min storage ${Math.min(...st)}`);
  assert.ok(Math.max(...st) - Math.min(...st) <= 2e6, 'balanced');
  assert.equal(r.stats.carts, 10 * BUILDINGS.marketplace.eff[9]);
  assert.equal(r.stats.extras.C, 2);
  checkLayout(r.plan, 100);
});

test('build order: reaches the plan, respects Town Hall gates, not slower than the old order', () => {
  const base = { ...nodeCity(), source: 'game' };
  base.levels = base.levels.map(() => 0);
  base.levels[TOWNHALL] = 2;
  const cells = base.cells.split('');
  let k = 0;
  for (let i = 0; i < N * N && k < 8; i++) if (cells[i] === '-' && zone(i, false) === 'interior' && i > 120) { cells[i] = ['2', 'C'][k % 2]; base.levels[i] = 2; k++; }
  base.cells = cells.join('');
  for (const target of [militaryTemplate(base, { ts: 84000, ...FAST }).plan, hubTemplate(base, FAST).plan]) {
    const { steps, total } = planSteps(target, base, {});
    const sim = base.cells.split('');
    let th = 2;
    for (const s of steps) {
      if (s.code === 'T') { th = s.to; continue; }
      if (s.kind === 'build') {
        assert.ok((BUILDINGS[Object.keys(BUILDINGS).find((key) => BUILDINGS[key].code === s.code)].th || 1) <= th, `${s.code} before TH ${th}`);
        const count = sim.filter(isBuilding).length + (isBuilding(sim[s.i]) ? 0 : 1);
        assert.ok(count <= BUILDINGS.townhall.eff[th - 1] || th === 10, `slots at TH ${th}`);
      }
      sim[s.i] = s.kind === 'demolish' ? '-' : s.code;
    }
    for (let i = 0; i < N * N; i++) if (i !== TOWNHALL && (zone(i, false) === 'interior')) assert.equal(isBuilding(sim[i]) ? sim[i] : '-', isBuilding(target.cells[i]) ? target.cells[i] : '-', `tile ${i}`);
    assert.ok(total.time <= total.naive + 1, `smart ${total.time} > old ${total.naive}`);
  }
});

test('cityStats totals match per-building outputs', () => {
  const W = at(3, 3), S = at(5, 5);
  const p = plan({ [W]: '2', [at(4, 3)]: '.', [S]: 'S', [at(6, 5)]: 'L', [at(9, 9)]: 'C' });
  const st = cityStats(p);
  // Town Hall (level 10 here): +300 wood/h and 175,000 storage per resource, as in the game
  assert.equal(st.prod.wood, producerOutput(p, W).total + 300);
  assert.equal(st.store.wood, warehouseOutput(p, S).out.wood + 175000);
  assert.equal(cityStats({ ...p, levels: p.levels.map((v, i) => (i === TOWNHALL ? 0 : v)) }).prod.wood, producerOutput(p, W).total);
  assert.equal(st.speed, BUILDINGS.cottage.eff[9]);
});
