// Layout templates on a real city (its natural nodes are kept unless clearing is allowed): military (max
// recruit speed for one unit group with a troop-space target) and hub (max balanced storage + carts).
// Economy = the existing optimizer. Both templates use the same engine: simulated annealing with
// incremental (local) scoring, several restarts, and moves that keep the building count fixed.
import { N, TOWNHALL, zone, isBuilding, isNode, neighbours } from './city.js';
import { BUILDINGS, BY_CODE } from './gamedata.js';
import { cityRecruitPct, RECRUIT_CODES, BARRACKS_BOOST, RECRUIT_BLD_PCT } from './cheatsheet.js';

export const GROUP_CODES = { K: 'City Guard House', G: 'Training Ground', E: 'Stable', J: 'Moonglow Tower', Z: 'Trinsic Temple', Y: 'Workshop', V: 'Shipyard' };
export const MAX_SLOTS = 100; // Town Hall L10
const KEEP_MIL = ['S', 'P', 'X', 'R', 'H'];
const KEEP_HUB = ['X', 'R', 'V'];
const CLEARABLE = ['.', ':', ','];  // forest, rocks, ore — lakes stay
const lvlOf = (p, i) => Math.min(10, Math.max(1, p.levels?.[i] || 10));
const NB = Array.from({ length: N * N }, (_, i) => neighbours(i));

// troop space: (100 + Σ Barracks) × (1 + Castle %)
export function troopSpace(p) {
  let bar = 0, castle = 0;
  for (let i = 0; i < N * N; i++) {
    if (p.cells[i] === 'B') bar += BUILDINGS.barracks.eff[lvlOf(p, i) - 1];
    if (p.cells[i] === 'X') castle = Math.max(castle, BUILDINGS.castle.eff[lvlOf(p, i) - 1]);
  }
  return Math.floor((100 + bar) * (1 + castle / 100));
}
// carts (Marketplace) and ships (Harbor)
export function tradeCap(p) {
  let carts = 0, ships = 0;
  for (let i = 0; i < N * N; i++) {
    if (p.cells[i] === 'P') carts += BUILDINGS.marketplace.eff[lvlOf(p, i) - 1];
    if (p.cells[i] === 'R') ships += BUILDINGS.harbor.eff[lvlOf(p, i) - 1];
  }
  return { carts, ships };
}
export function militaryStats(p) {
  return { ts: troopSpace(p), recruit: cityRecruitPct(p), ...tradeCap(p) };
}

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Plots the template may use: empty plots + buildings not kept (+ clearable nodes when allowed).
function plots(plan, keep, clearNodes) {
  const free = [], kept = [], nodes = [];
  for (let i = 0; i < N * N; i++) {
    if (i === TOWNHALL) continue;
    const z = zone(i, plan.water);
    if (z !== 'interior' && z !== 'shore') continue;
    const c = plan.cells[i];
    if (isNode(c)) { if (clearNodes && z === 'interior' && CLEARABLE.includes(c)) nodes.push(i); continue; }
    if (isBuilding(c) && keep.includes(c)) { kept.push(i); continue; }
    free.push(i);
  }
  return { free, kept, nodes };
}

/**
 * Generic annealer. Labels are small ints (0 = nothing / node stays). Every move keeps the number of
 * buildings fixed: swap two buildings, relabel one, or move one to an empty plot (mostly next to the cluster).
 * cfg: { pool, init: Map cell→label, allowed(i,l), update(cnt,i,from,to,lab), score(cnt), ok(cnt),
 *        relabel(l) → array of labels it may become, nCnt, T0, T1, iters, restarts, seed }
 */
function anneal(cfg) {
  const { pool, allowed, update, score, ok } = cfg;
  const inPool = new Uint8Array(N * N);
  for (const i of pool) inPool[i] = 1;
  let best = -Infinity, bestLab = null;
  for (let run = 0; run < (cfg.restarts || 1); run++) {
    const r = rng((cfg.seed || 7) + run * 7919);
    const lab = new Int8Array(N * N);
    const cnt = new Float64Array(cfg.nCnt);
    const set = (i, to) => { const from = lab[i]; if (from === to) return; update(cnt, i, from, to, lab); lab[i] = to; };
    for (const [i, l] of cfg.init) set(i, l);
    const occ = [], emp = [], pos = new Int16Array(N * N).fill(-1);
    for (const i of pool) { if (lab[i]) { pos[i] = occ.length; occ.push(i); } else { pos[i] = emp.length; emp.push(i); } }
    if (!occ.length) return { lab, score: cur };
    let cur = ok(cnt) ? score(cnt) : -Infinity;
    if (!bestLab || cur > best) { best = cur; bestLab = lab.slice(); }
    const iters = cfg.iters || 200000;
    const k = Math.log(cfg.T1 / cfg.T0);
    for (let it = 0; it < iters; it++) {
      const T = cfg.T0 * Math.exp(k * it / iters);
      const m = r();
      let undo;
      if (m < 0.4 && emp.length) {
        // move a building to an empty plot (70% next to another building)
        const a = occ[Math.floor(r() * occ.length)], la = lab[a];
        let e = -1;
        if (r() < 0.7) { const c = occ[Math.floor(r() * occ.length)], nb = NB[c], j = nb[Math.floor(r() * nb.length)]; if (inPool[j] && !lab[j]) e = j; }
        if (e < 0) e = emp[Math.floor(r() * emp.length)];
        if (!allowed(e, la)) continue;
        set(a, 0); set(e, la);
        undo = () => { set(e, 0); set(a, la); };
        if (!ok(cnt)) { undo(); continue; }
        const s = score(cnt);
        if (s >= cur || r() < Math.exp((s - cur) / T)) {
          const pa = pos[a], pe = pos[e];
          occ[pa] = e; pos[e] = pa; emp[pe] = a; pos[a] = pe;
          cur = s;
        } else { undo(); continue; }
      } else if (m < 0.8) {
        const a = occ[Math.floor(r() * occ.length)], b = occ[Math.floor(r() * occ.length)];
        const la = lab[a], lb = lab[b];
        if (la === lb || !allowed(a, lb) || !allowed(b, la)) continue;
        set(a, lb); set(b, la);
        undo = () => { set(b, lb); set(a, la); };
        if (!ok(cnt)) { undo(); continue; }
        const s = score(cnt);
        if (s >= cur || r() < Math.exp((s - cur) / T)) cur = s; else { undo(); continue; }
      } else {
        const a = occ[Math.floor(r() * occ.length)], la = lab[a];
        const opts = cfg.relabel(la);
        if (!opts.length) continue;
        const nl = opts[Math.floor(r() * opts.length)];
        if (!allowed(a, nl)) continue;
        set(a, nl);
        if (!ok(cnt)) { set(a, la); continue; }
        const s = score(cnt);
        if (s >= cur || r() < Math.exp((s - cur) / T)) cur = s; else { set(a, la); continue; }
      }
      if (cur > best) { best = cur; bestLab = lab.slice(); }
    }
  }
  return { lab: bestLab, score: best };
}

// starting layout: the most connected plots first
function denseOrder(pool) {
  const inPool = new Set(pool);
  const dens = (i) => NB[i].filter((j) => inPool.has(j)).length;
  return [...pool].sort((a, b) => dens(b) - dens(a) || a - b);
}

// put a single building (Castle) on the least useful empty plot of the pool
function placeSingle(cells, levels, pool, used, code, avoid) {
  const cand = pool.filter((i) => !used.has(i) && !avoid(i));
  if (!cand.length) return -1;
  const busy = (i) => NB[i].filter((j) => used.has(j)).length;
  cand.sort((a, b) => busy(a) - busy(b) || (isNode(cells[a]) ? 1 : 0) - (isNode(cells[b]) ? 1 : 0) || a - b);
  const i = cand[0];
  cells[i] = code; levels[i] = 10; used.add(i);
  return i;
}

/**
 * Military template.
 * opts: { group: 'G'|'E'|'J'|'Z'|'Y'|'K'|'V', ts: minimum troop space, keep: true, castle: true,
 *         limit: building slots (default 100), clearNodes: false, iters, restarts, seed }
 * Barracks are not only for troop space: a L10 Barracks bordered by 8 recruitment buildings adds +200%,
 * more than one more recruitment building (+150%), so the annealer also decides how many Barracks to use.
 */
export function militaryTemplate(plan, opts = {}) {
  const group = opts.group || 'G', limit = opts.limit || MAX_SLOTS;
  const keep = opts.keep === false ? ['X', 'R'] : KEEP_MIL;
  const cells = plan.cells.split('');
  const levels = [...(plan.levels || Array(N * N).fill(0))];
  const { free, kept, nodes } = plots(plan, keep, opts.clearNodes);
  for (const i of free) { cells[i] = '-'; levels[i] = 0; }
  const shore = (i) => zone(i, plan.water) === 'shore';
  const pool = [...free, ...nodes].filter((i) => !shore(i) || group === 'V');
  const isNodeCell = new Uint8Array(N * N);
  for (const i of nodes) isNodeCell[i] = 1;
  let budget = Math.max(0, limit - kept.length);
  // castle for the army-size bonus (placed after the cluster, on a plot it doesn't need)
  const wantCastle = opts.castle !== false && !kept.some((i) => cells[i] === 'X') && budget > 0;
  if (wantCastle) budget--;
  const castle = wantCastle || kept.some((i) => cells[i] === 'X') ? BUILDINGS.castle.eff[9] : 0;
  const mult = 1 + castle / 100;
  const nonShore = pool.filter((i) => !shore(i)).length;
  let n = Math.min(budget, pool.length - (wantCastle ? 1 : 0));
  const recCells = pool.filter((i) => (group === 'V' ? shore(i) : !shore(i))).length;
  const wantBar = opts.ts ? Math.max(0, Math.ceil((opts.ts / mult - 100) / BUILDINGS.barracks.eff[9])) : 0;
  const minBar = Math.max(0, Math.min(wantBar, n - 1, nonShore - (wantCastle && group !== 'V' ? 1 : 0)));
  n = Math.min(n, minBar + recCells);
  const REC = RECRUIT_BLD_PCT[9], BOOST = group === 'K' ? 0 : BARRACKS_BOOST[9], PEN = 20;
  const okLab = (i, l) => (l === 1 ? !shore(i) : group === 'V' ? shore(i) : !shore(i));
  // counters: 0 recruitment buildings, 1 barracks, 2 bordering pairs, 3 cleared nodes
  const pair = (a, b) => (a === 1 && b === 2) || (a === 2 && b === 1);
  const update = (c, i, from, to, lab) => {
    if (from === 2) c[0]--; if (to === 2) c[0]++;
    if (from === 1) c[1]--; if (to === 1) c[1]++;
    if (isNodeCell[i]) c[3] += (to ? 1 : 0) - (from ? 1 : 0);
    if (!BOOST) return;
    for (const j of NB[i]) { const l = lab[j]; if (!l) continue; if (pair(from, l)) c[2]--; if (pair(to, l)) c[2]++; }
  };
  const score = (c) => REC * c[0] + BOOST * c[2] + 0.5 * c[1] - PEN * c[3];
  const ok = (c) => c[1] >= minBar && c[0] >= 1;
  // start: densest plots, Barracks spread every other plot
  const init = new Map();
  let nb = 0, nr = 0;
  for (const i of denseOrder(pool.filter((i) => !isNodeCell[i])).concat(nodes)) {
    if (nb + nr >= n) break;
    if (nb < minBar && okLab(i, 1) && (nr >= n - minBar || (nb + nr) % 2 === 0)) { init.set(i, 1); nb++; }
    else if (nr < n - minBar && okLab(i, 2)) { init.set(i, 2); nr++; }
    else if (nb < minBar && okLab(i, 1)) { init.set(i, 1); nb++; }
  }
  const res = anneal({
    pool, init, allowed: okLab, update, score, ok, nCnt: 4,
    relabel: (l) => (l === 1 ? [2] : [1]),
    T0: 120, T1: 0.3, iters: opts.iters || 250000, restarts: opts.restarts || 3, seed: opts.seed || 7
  });
  const used = new Set();
  for (const i of pool) {
    const l = res.lab[i];
    if (!l) continue;
    cells[i] = l === 1 ? 'B' : group; levels[i] = 10; used.add(i);
  }
  if (wantCastle) placeSingle(cells, levels, pool, used, 'X', (i) => shore(i));
  const out = { ...plan, cells: cells.join(''), levels };
  const rec = cityRecruitPct(out)[RECRUIT_CODES.indexOf(group)];
  const vals = [...used].map((i) => cells[i]);
  const tsNow = troopSpace(out);
  return {
    plan: out,
    stats: {
      pct: rec?.pct || 0, ts: tsNow, tsShort: !!opts.ts && tsNow < opts.ts,
      nBar: vals.filter((c) => c === 'B').length, nRec: vals.filter((c) => c === group).length, minBar,
      cleared: nodes.filter((i) => used.has(i)).length, used: used.size + kept.length, slots: limit
    }
  };
}

// ---- hub: warehouses bordered by processing buildings (+200% storage each at L10) and marketplaces ----
const PROC_OF = { L: 'wood', A: 'stone', D: 'iron', M: 'food' };
export function hubStorage(p) {
  const st = { wood: 0, stone: 0, iron: 0, food: 0 };
  for (let i = 0; i < N * N; i++) {
    if (p.cells[i] !== 'S') continue;
    const base = BUILDINGS.warehouse.eff[lvlOf(p, i) - 1];
    const pct = { wood: 0, stone: 0, iron: 0, food: 0 };
    for (const j of neighbours(i)) { const r = PROC_OF[p.cells[j]]; if (r) pct[r] += BY_CODE[p.cells[j]].eff2[lvlOf(p, j) - 1]; }
    for (const r in st) st[r] += Math.ceil(base * (100 + pct[r]) / 100 - 1e-9);
  }
  return st;
}
/**
 * Hub template: the largest balanced storage (the weakest resource first), plus Marketplaces and
 * (water cities) Harbors on the shore.
 * opts: { markets, harbors, keep: true, limit, clearNodes: false, iters, restarts, seed }
 */
export function hubTemplate(plan, opts = {}) {
  const limit = opts.limit || MAX_SLOTS;
  const keep = opts.keep === false ? ['X', 'R', 'V'] : KEEP_HUB;
  const cells = plan.cells.split('');
  const levels = [...(plan.levels || Array(N * N).fill(0))];
  const { free, kept, nodes } = plots(plan, keep, opts.clearNodes);
  for (const i of free) { cells[i] = '-'; levels[i] = 0; }
  const shore = (i) => zone(i, plan.water) === 'shore';
  let budget = Math.max(0, limit - kept.length);
  // harbors on free shore plots (ships: 10,000 resources each)
  let nH = 0;
  if (plan.water && opts.harbors > 0) {
    for (const i of free.filter(shore)) {
      if (nH >= opts.harbors || budget <= 0) break;
      cells[i] = 'R'; levels[i] = 10; nH++; budget--;
    }
  }
  const pool = [...free.filter((i) => !shore(i)), ...nodes];
  const isNodeCell = new Uint8Array(N * N);
  for (const i of nodes) isNodeCell[i] = 1;
  const n = Math.min(budget, pool.length);
  const nP = Math.max(0, Math.min(opts.markets ?? 10, n - 2));
  // labels: 1 Warehouse, 2..5 Sawmill/Stonemason/Foundry/Mill, 6 Marketplace
  const CODE = [null, 'S', 'L', 'A', 'D', 'M', 'P'];
  const WH = BUILDINGS.warehouse.eff[9] / 1e5, BON = BUILDINGS.sawmill.eff2[9] / 100; // 100k units
  // counters: 0 warehouses, 1..4 warehouse–processing pairs per resource, 5 cleared nodes
  const update = (c, i, from, to, lab) => {
    if (from === 1) c[0]--; if (to === 1) c[0]++;
    if (isNodeCell[i]) c[5] += (to ? 1 : 0) - (from ? 1 : 0);
    if (from !== 1 && to !== 1 && (from < 2 || from > 5) && (to < 2 || to > 5)) return;
    for (const j of NB[i]) {
      const l = lab[j];
      if (!l) continue;
      if (from === 1 && l >= 2 && l <= 5) c[l - 1]--;
      if (to === 1 && l >= 2 && l <= 5) c[l - 1]++;
      if (l === 1 && from >= 2 && from <= 5) c[from - 1]--;
      if (l === 1 && to >= 2 && to <= 5) c[to - 1]++;
    }
  };
  const store = (c, r) => WH * (c[0] + BON * c[r]);
  const score = (c) => {
    const a = store(c, 1), b = store(c, 2), d = store(c, 3), e = store(c, 4);
    return Math.min(a, b, d, e) + 0.05 * (a + b + d + e) - 0.5 * c[5];
  };
  // start: densest plots in stripes (Warehouse row / processing row), Marketplaces on the least connected
  const order = denseOrder(pool.filter((i) => !isNodeCell[i])).concat(nodes).slice(0, n);
  const init = new Map();
  order.slice(n - nP).forEach((i) => init.set(i, 6));
  let k = 0;
  for (const i of order.slice(0, n - nP)) init.set(i, Math.floor(i / N) % 2 ? 1 : 2 + (k++ % 4));
  const res = anneal({
    pool, init, allowed: () => true, update, score, ok: () => true, nCnt: 6,
    relabel: (l) => (l === 6 ? [] : [1, 2, 3, 4, 5].filter((x) => x !== l)),
    T0: 4, T1: 0.005, iters: opts.iters || 250000, restarts: opts.restarts || 3, seed: opts.seed || 11
  });
  let cleared = 0, used = 0;
  for (const i of pool) {
    const l = res.lab[i];
    if (!l) continue;
    cells[i] = CODE[l]; levels[i] = 10; used++;
    if (isNodeCell[i]) cleared++;
  }
  const out = { ...plan, cells: cells.join(''), levels };
  return { plan: out, stats: { storage: hubStorage(out), ...tradeCap(out), cleared, used: used + nH + kept.length, slots: limit } };
}
export { BARRACKS_BOOST, RECRUIT_BLD_PCT };
