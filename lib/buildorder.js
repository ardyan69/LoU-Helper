// Smart build order: turns a city (base) into a plan step by step with a greedy simulation.
// - Town Hall upgrades only when a building needs it (its TH requirement or a free building slot)
// - Cottages first while the build time they save is larger than their own build time
// - then the step with the largest gain per hour of build time (production, gold, recruit %, TS, storage)
// - demolishing happens right before the new building on that tile (the old one keeps producing until then)
// - build time is recalculated after each step with the construction speed reached so far
import { N, TOWNHALL, zone, isBuilding, isNode, cityStats } from './city.js';
import { BUILDINGS, BY_CODE, levelCost, researchPct } from './gamedata.js';
import { cityRecruitPct } from './cheatsheet.js';

const RK = ['wood', 'stone', 'iron', 'food', 'gold'];
const TH = BUILDINGS.townhall;
const COT = BUILDINGS.cottage.eff; // construction speed %
const slotsAt = (l) => (l > 0 ? TH.eff[Math.min(10, l) - 1] : 0);
const lvlOf = (p, i) => (isBuilding(p.cells[i]) || i === TOWNHALL ? (p.levels?.[i] || (p.source === 'game' ? 1 : 10)) : 0);

// value of a city state, per hour-ish units (used only to rank steps)
export function cityValue(p) {
  const st = cityStats(p);
  const prod = st.prod.wood + st.prod.stone + st.prod.iron + st.prod.food;
  let rec = 0;
  for (const g of cityRecruitPct(p)) rec += g.pct;
  let bar = 0, castle = 0, carts = 0;
  for (let i = 0; i < N * N; i++) {
    const c = p.cells[i];
    if (c === 'B') bar += BUILDINGS.barracks.eff[Math.max(1, p.levels[i] || 1) - 1];
    else if (c === 'X') castle = Math.max(castle, BUILDINGS.castle.eff[Math.max(1, p.levels[i] || 1) - 1]);
    else if (c === 'P') carts += BUILDINGS.marketplace.eff[Math.max(1, p.levels[i] || 1) - 1];
  }
  const ts = Math.floor((100 + bar) * (1 + castle / 100));
  const store = st.store.wood + st.store.stone + st.store.iron + st.store.food;
  return { prod, gold: st.gold, rec, ts, store, hide: st.hide, carts, speed: st.speed, buildings: st.buildings,
    v: prod + st.gold + rec + ts * 0.05 + store * 0.0002 + st.hide * 0.002 + carts * 0.5 };
}

function sumCost(c) { return RK.reduce((a, r) => a + (c[r] || 0), 0); }

/**
 * opts: { research: construction research level (or researchPct via opts.researchPct) }
 * Returns { steps, total: {cost, time}, naive } — each step: { kind: 'demolish'|'build'|'upgrade', code, i, from, to,
 *   cost, base (s at 0%), time (s at the speed of that moment), at (cumulative s), speed, gain, why }
 */
export function planSteps(plan, base, opts = {}) {
  const research = opts.researchPct ?? researchPct(opts.research || 0);
  const sim = { ...base, cells: base.cells.split(''), levels: [...(base.levels || Array(N * N).fill(0))] };
  for (let i = 0; i < N * N; i++) if (isBuilding(sim.cells[i]) || i === TOWNHALL) sim.levels[i] = lvlOf(base, i);
  const view = () => ({ ...sim, cells: sim.cells.join('') });
  let thLvl = sim.levels[TOWNHALL] || 1;
  const thTarget = Math.max(thLvl, plan.levels?.[TOWNHALL] || 0);

  // tasks per tile
  const tasks = [];
  const tail = []; // demolitions with nothing built afterwards
  for (let i = 0; i < N * N; i++) {
    if (i === TOWNHALL) continue;
    const z = zone(i, plan.water);
    if (z !== 'interior' && z !== 'shore') continue;
    const a = plan.cells[i], b = base.cells[i] || '-';
    const la = lvlOf(plan, i), lb = lvlOf(base, i);
    if (a === b) { if (isBuilding(a) && la > lb) tasks.push({ kind: 'upgrade', code: a, i, from: lb, to: la }); continue; }
    if (isBuilding(a)) tasks.push({ kind: 'build', code: a, i, from: 0, to: la || 10, old: isBuilding(b) || isNode(b) ? b : null });
    else if (isBuilding(b) || isNode(b)) tail.push({ kind: 'demolish', code: b, i, from: lb, to: 0 });
  }
  const tailAll = [...tail];
  for (const s of tasks) { const c = levelCost(BY_CODE[s.code], s.from, s.to); s.cost = c.cost; s.base = c.time; s.th = s.kind === 'build' ? BY_CODE[s.code].th || 1 : 0; }

  const speedNow = () => { let p = 0; for (let i = 0; i < N * N; i++) if (sim.cells[i] === 'C') p += COT[Math.max(1, sim.levels[i] || 1) - 1]; return p + research; };
  const count = () => { let n = 0; for (let i = 0; i < N * N; i++) if (isBuilding(sim.cells[i])) n++; return n; };
  const out = [];
  let clock = 0;
  const startSpeed = speedNow();
  const push = (s, why, gain) => {
    const sp = speedNow(), t = (s.base || 0) / (1 + sp / 100);
    clock += t;
    out.push({ ...s, time: t, at: clock, speed: sp, why, gain: gain || null });
  };
  const apply = (s) => {
    if (s.kind === 'demolish') { sim.cells[s.i] = '-'; sim.levels[s.i] = 0; }
    else { sim.cells[s.i] = s.code; sim.levels[s.i] = s.to; }
  };
  const thUp = (to, why) => {
    if (to <= thLvl) return;
    const c = levelCost(TH, thLvl, to);
    push({ kind: 'upgrade', code: 'T', i: TOWNHALL, from: thLvl, to, cost: c.cost, base: c.time }, why);
    thLvl = to; sim.levels[TOWNHALL] = to;
  };

  // cached gain per task; invalidated when something within 2 tiles changes
  const cache = new Map();
  const near = (a, b) => Math.max(Math.abs((a % N) - (b % N)), Math.abs(Math.floor(a / N) - Math.floor(b / N))) <= 2;
  let cur = cityValue(view());
  const gainOf = (s) => {
    if (cache.has(s)) return cache.get(s);
    const oc = sim.cells[s.i], ol = sim.levels[s.i];
    sim.cells[s.i] = s.code; sim.levels[s.i] = s.to;
    const nv = cityValue(view());
    sim.cells[s.i] = oc; sim.levels[s.i] = ol;
    const g = { v: nv.v - cur.v, prod: nv.prod - cur.prod, gold: nv.gold - cur.gold, rec: nv.rec - cur.rec, ts: nv.ts - cur.ts, store: nv.store - cur.store, speed: nv.speed - cur.speed, carts: nv.carts - cur.carts };
    cache.set(s, g);
    return g;
  };
  const left = new Set(tasks);
  let thLvlFree = false;
  while (left.size) {
    const n = count(), slots = slotsAt(thLvl);
    const avail = [...left].filter((s) => s.kind !== 'build' || (s.th <= thLvl && (thLvlFree || (s.old && isBuilding(sim.cells[s.i])) || n + 1 <= slots)));
    if (!avail.length) {
      // blocked: free a slot with a leftover demolition, else upgrade the Town Hall just enough
      const builds = [...left].filter((s) => s.kind === 'build');
      const needTh = Math.min(...builds.map((s) => s.th));
      if (needTh <= thLvl && tail.length) { const d = tail.shift(); if (isBuilding(sim.cells[d.i])) { push(d, 'slot'); apply(d); cur = cityValue(view()); cache.clear(); continue; } }
      if (thLvl >= 10) { builds.forEach((x) => (x.th = 0)); thLvlFree = true; continue; } // slots full at TH 10: let it through
      const needSlots = Math.min(10, Math.ceil((n + 1) / 10));
      thUp(Math.min(10, Math.max(thLvl + 1, needTh <= thLvl ? needSlots : needTh)), 'th');
      continue;
    }
    const sp = speedNow(), f = 1 + sp / 100;
    let remain = 0;
    for (const s of left) remain += s.base;
    let best = null, bestKey = -Infinity;
    for (const s of avail) {
      const g = gainOf(s);
      const cost = s.base / f;
      let key;
      // time the rest of the build gains (Cottage) or loses (a Cottage replaced) through construction speed
      const saved = g.speed ? (remain - s.base) * (1 / f - 1 / (1 + (sp + g.speed) / 100)) : 0;
      if (saved > 0 && saved >= cost) key = 1e9 + saved / Math.max(1, cost);
      else {
        const eff = cost - Math.min(0, saved); // a lost Cottage counts as extra build time
        key = g.v > 0 ? g.v / Math.max(1 / 60, eff / 3600) : -eff; // cheap no-value steps last, shortest first
      }
      if (key > bestKey) { bestKey = key; best = s; }
    }
    const g = gainOf(best);
    left.delete(best);
    if (best.old && (isBuilding(sim.cells[best.i]) || isNode(sim.cells[best.i]))) {
      push({ kind: 'demolish', code: sim.cells[best.i], i: best.i, from: sim.levels[best.i] || 0, to: 0, cost: {}, base: 0 }, 'clear');
    }
    push(best, g.speed > 0 && bestKey >= 1e9 ? 'speed' : g.v > 0 ? 'value' : 'rest', g);
    apply(best);
    cur = cityValue(view());
    // gains are local (neighbour bonuses), except troop space: Castle multiplies every Barracks
    const tsLink = best.code === 'B' || best.code === 'X';
    for (const k of [...cache.keys()]) if (near(k.i, best.i) || (tsLink && (k.code === 'B' || k.code === 'X'))) cache.delete(k);
  }
  for (const d of tail) if (isBuilding(sim.cells[d.i]) || isNode(sim.cells[d.i])) { push({ ...d, cost: {}, base: 0 }, 'clear'); apply(d); }
  thUp(thTarget, 'final');

  const cost = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
  let baseTime = 0;
  for (const s of out) { for (const r of RK) cost[r] += s.cost?.[r] || 0; baseTime += s.base || 0; }
  return { steps: out, total: { cost, time: clock, base: baseTime, naive: naiveTime(plan, base, tasks, tailAll, Math.max(thTarget, thLvl), research), startSpeed, endSpeed: speedNow() } };
}

// the old fixed order (demolish everything, Town Hall, new buildings, upgrades), timed with the same speed model
const OLD_ORDER = ['C', 'S', '2', '3', '4', '1', 'L', 'A', 'D', 'M', 'U', 'P', 'H', 'R', 'B', 'K', 'G', 'E', 'J', 'Z', 'Y', 'V', 'X'];
function naiveTime(plan, base, tasks, tail, thTarget, research) {
  const cells = base.cells.split(''), levels = [...(base.levels || [])];
  for (let i = 0; i < N * N; i++) if (isBuilding(cells[i]) || i === TOWNHALL) levels[i] = lvlOf(base, i);
  const speed = () => { let p = 0; for (let i = 0; i < N * N; i++) if (cells[i] === 'C') p += COT[Math.max(1, levels[i] || 1) - 1]; return p + research; };
  for (const s of [...tail, ...tasks.filter((x) => x.old)]) { cells[s.i] = '-'; levels[s.i] = 0; }
  let clock = 0;
  const th = levels[TOWNHALL] || 1;
  if (thTarget > th) clock += levelCost(TH, th, thTarget).time / (1 + speed() / 100);
  const rank = (c) => (OLD_ORDER.indexOf(c) < 0 ? 99 : OLD_ORDER.indexOf(c));
  const seq = [...tasks.filter((x) => x.kind === 'build').sort((x, y) => rank(x.code) - rank(y.code)), ...tasks.filter((x) => x.kind === 'upgrade').sort((x, y) => x.to - y.to || rank(x.code) - rank(y.code))];
  for (const s of seq) { clock += s.base / (1 + speed() / 100); cells[s.i] = s.code; levels[s.i] = s.to; }
  return clock;
}
export { sumCost };
