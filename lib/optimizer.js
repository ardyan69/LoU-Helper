// Layout optimizer: places production buildings, processing buildings and cottages around the
// fixed natural nodes to maximise (weighted) production, using the game's own production formula.
// Greedy construction followed by simulated annealing with incremental (local) evaluation.
import { N, TOWNHALL, zone, neighbours, isBuilding, isNode, TABLES as T } from './city.js';

const RES_OF = { 2: 'wood', 3: 'stone', 4: 'iron', 1: 'food' };
const PROC_OF = { 2: 'L', 3: 'A', 4: 'D', 1: 'M' };
const NODE_OF = { 2: '.', 3: ':', 4: ',' };
const PROC_RES = { L: 'wood', A: 'stone', D: 'iron', M: 'food' };
export const ECON = ['2', '3', '4', '1', 'L', 'A', 'D', 'M', 'C'];

const up = (v, p) => Math.ceil((v * (100 + p)) / 100 - 1e-9);

const RI = { wood: 0, stone: 1, iron: 2, food: 3 };

// opts.goal: { type: 'weights', weights: {wood:1,...} }  -> maximise Σ weight × production
//            { type: 'ratio', ratio: {wood:1,stone:1,...} } -> maximise the weakest resource relative to its share
/** @param {(fraction: number) => void} [onProgress] */
export async function optimize(plan, opts, onProgress = (_f) => {}) {
  const goal = opts.goal || { type: 'weights', weights: { wood: 1 } };
  const vec = (o) => [o?.wood || 0, o?.stone || 0, o?.iron || 0, o?.food || 0];
  let Wv = goal.type === 'ratio' ? vec(goal.ratio) : vec(goal.weights);
  if (goal.type === 'ratio') { const sum = Wv.reduce((a, b) => a + b, 0) || 1; Wv = Wv.map((w) => w / sum); }
  const active = Wv.map((w) => w > 0);
  const objective = goal.type === 'ratio'
    ? (t) => { let m = Infinity, sum = 0; for (let r = 0; r < 4; r++) if (active[r]) { m = Math.min(m, t[r] / Wv[r]); sum += t[r]; } return m + 0.02 * sum; }
    : (t) => t[0] * Wv[0] + t[1] * Wv[1] + t[2] * Wv[2] + t[3] * Wv[3];

  const level = Math.max(1, Math.min(10, opts.level || 10));
  const mode = opts.mode || 'econ';
  const iterations = opts.iterations || 200000;
  const restarts = Math.max(1, opts.restarts || 1);
  const rnd = mulberry(opts.seed || 12345);

  const NB = Array.from({ length: N * N }, (_, i) => neighbours(i));
  const interior = Array.from({ length: N * N }, (_, i) => i !== TOWNHALL && zone(i, plan.water) === 'interior');
  const cells = plan.cells.split('');
  const lv = plan.levels.map((v, i) => (isBuilding(cells[i]) ? v || 10 : 0));

  // which plots may the optimizer use?
  // optional: natural nodes may be cleared and replaced, but only if each removal gains >= minGain per hour
  const rm = opts.removeNodes || {};
  const rmTypes = new Set(rm.enabled ? rm.types || ['.', ':', ',', ';'] : []);
  const penalty = Math.max(0, rm.minGain ?? 250);
  const orig = new Array(N * N).fill(null);
  const free = [];
  for (let i = 0; i < N * N; i++) {
    if (!interior[i]) continue;
    const c = cells[i];
    if (isNode(c)) {
      if (rmTypes.has(c)) { orig[i] = c; free.push(i); }
      continue;
    }
    const take = mode === 'fill' ? c === '-' : mode === 'econ' ? c === '-' || ECON.includes(c) : c === '-' || isBuilding(c);
    if (take) { free.push(i); cells[i] = '-'; lv[i] = 0; }
  }
  const isFree = new Uint8Array(N * N);
  free.forEach((i) => (isFree[i] = 1));
  const budget = Math.max(0, Math.min(opts.budget ?? free.length, free.length));
  const isBld = (x) => (isBuilding(x) ? 1 : 0);
  const isNodeCell = (i) => orig[i] !== null && cells[i] === orig[i];
  let removed = 0;
  const cand = ECON.filter((c) => (c === 'C' ? opts.cottage !== false : active[RI[RES_OF[c] || PROC_RES[c]]]));

  // raw production of the producer on plot j (same steps & rounding as the game)
  function prodAt(j) {
    const c = cells[j];
    const res = RES_OF[c];
    if (!res) return 0;
    const base = (c === '1' ? T.FARM : T.PROD)[(lv[j] || 10) - 1];
    const pc = PROC_OF[c], nc = NODE_OF[c];
    let nodes = 0, lakes = 0, cot = 0, proc = 0;
    const nb = NB[j];
    for (let a = 0; a < nb.length; a++) {
      const k = nb[a], n = cells[k];
      if (c === '1') { if (n === ';') lakes++; else if (n === '-' && interior[k]) nodes++; }
      else if (n === nc) nodes++;
      if (n === 'C') cot += T.COTTAGE[(lv[k] || 10) - 1];
      else if (n === pc) { const v = T.PROC[(lv[k] || 10) - 1]; if (v > proc) proc = v; }
    }
    let t = up(base, nodes ? T.NODE_FIRST + T.NODE_NEXT * (nodes - 1) : 0);
    t = up(t, cot);
    if (lakes) t = up(t, lakes * T.LAKE);
    return up(t, proc);
  }
  const tot = [0, 0, 0, 0];
  for (let j = 0; j < N * N; j++) { const r = RES_OF[cells[j]]; if (r) tot[RI[r]] += prodAt(j); }
  const tmp = [0, 0, 0, 0];
  function addLocal(i, sign) {
    const touch = (j) => { const r = RES_OF[cells[j]]; if (r) tmp[RI[r]] += sign * prodAt(j); };
    touch(i);
    const nb = NB[i];
    for (let a = 0; a < nb.length; a++) touch(nb[a]);
  }
  // set plot i to code; returns objective delta (only i and its neighbours can change)
  function set(i, code) {
    const before = objective(tot) - penalty * removed;
    tmp[0] = tmp[1] = tmp[2] = tmp[3] = 0;
    addLocal(i, -1);
    if (orig[i] !== null) removed -= +(cells[i] !== orig[i]);
    cells[i] = code;
    lv[i] = isBuilding(code) ? level : 0;
    if (orig[i] !== null) removed += +(cells[i] !== orig[i]);
    addLocal(i, 1);
    tot[0] += tmp[0]; tot[1] += tmp[1]; tot[2] += tmp[2]; tot[3] += tmp[3];
    return objective(tot) - penalty * removed - before;
  }
  const result = (c, l) => {
    const gone = {};
    c.forEach((x, i) => { if (orig[i] !== null && x !== orig[i]) gone[orig[i]] = (gone[orig[i]] || 0) + 1; });
    return { cells: c.join(''), levels: l, score: objective(tot), used: c.filter((x, i) => isFree[i] && isBuilding(x)).length, budget, free: free.length, removedNodes: gone };
  };
  if (!cand.length || !budget) return result(cells, lv);

  // ---- greedy construction ----
  let used = 0;
  let score = objective(tot) - penalty * removed;
  while (used < budget) {
    let best = 0, bi = -1, bc = null;
    for (const i of free) {
      if (cells[i] !== '-' && !isNodeCell(i)) continue;
      const was = cells[i];
      for (const c of cand) {
        const d = set(i, c);
        set(i, was);
        if (d > best) { best = d; bi = i; bc = c; }
      }
    }
    if (bi < 0) break;
    score += set(bi, bc);
    used++;
  }
  onProgress(0.05);

  // ---- simulated annealing ----
  let bestScore = score, bestCells = cells.slice(), bestLv = lv.slice();
  const startCells = cells.slice(), startLv = lv.slice(), startUsed = used, startTot = tot.slice(), startRemoved = removed;
  const avg = Math.max(1, score / Math.max(1, used));
  const T0 = avg * 0.6, T1 = avg * 0.002;
  const CHUNK = 20000;
  const total = iterations * restarts;
  let done = 0;
  for (let r = 0; r < restarts; r++) {
    if (r > 0) {
      for (let i = 0; i < N * N; i++) { cells[i] = startCells[i]; lv[i] = startLv[i]; }
      used = startUsed; removed = startRemoved; for (let k = 0; k < 4; k++) tot[k] = startTot[k]; score = objective(tot) - penalty * removed;
    }
    for (let it = 0; it < iterations; it++) {
      const temp = T0 * Math.pow(T1 / T0, it / iterations);
      const i = free[(rnd() * free.length) | 0];
      const ci = cells[i];
      if (rnd() < 0.55) {
        // change one plot
        const q = rnd();
        const nc = orig[i] !== null && q < 0.25 ? orig[i] : q < 0.4 ? '-' : cand[(rnd() * cand.length) | 0];
        if (nc === ci || (!isBld(ci) && isBld(nc) && used >= budget)) { done++; continue; }
        const d = set(i, nc);
        if (d >= 0 || rnd() < Math.exp(d / temp)) { score += d; used += isBld(nc) - isBld(ci); }
        else set(i, ci);
      } else {
        // swap two plots (also moves a building onto an empty plot)
        const j = rnd() < 0.5 ? NB[i][(rnd() * NB[i].length) | 0] : free[(rnd() * free.length) | 0];
        const cj = cells[j];
        if (!isFree[j] || cj === ci || isNode(ci) || isNode(cj)) { done++; continue; } // nodes can't be moved
        let d = set(i, cj);
        d += set(j, ci);
        if (d >= 0 || rnd() < Math.exp(d / temp)) score += d;
        else { set(j, cj); set(i, ci); }
      }
      if (score > bestScore + 1e-9) { bestScore = score; bestCells = cells.slice(); bestLv = lv.slice(); }
      if (++done % CHUNK === 0) { onProgress(0.05 + 0.95 * (done / total)); await new Promise((res) => setTimeout(res, 0)); }
    }
  }
  onProgress(1);
  for (let i = 0; i < N * N; i++) { cells[i] = bestCells[i]; lv[i] = bestLv[i]; }
  return { ...result(bestCells, bestLv), score: bestScore };
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
