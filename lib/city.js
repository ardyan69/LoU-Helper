// City model for Lord of Ultima: Revival — mirrors the game's own city planner:
// 21×21 mask (walls, towers, ring road, Town Hall in the centre, optional lake corner for water cities),
// the LoU City Planner "ShareString 1.3" codes, and the production formulas the game uses.

import { t } from './i18n.js';

export const N = 21;
export const TOWNHALL = 10 * N + 10;

// '.' outside, '#' wall, 'O'/'o' tower slot, 'r' road, '-' interior plot, 'T' town hall, 'W' water, 'H' shore plot
const LAND = [
  '..#O###O#####O###O#..', '.##-------r-------##.', '##--------r--------##', 'O---------r---------O',
  '#---------r---------#', '#------rorrror------#', '#-----rr-----rr-----#', 'O----rr-------rr----O',
  '#----o---------o----#', '#----r---------r----#', '#rrrrr----T----rrrrr#', '#----r---------r----#',
  '#----o---------o----#', 'O----rr-------rr----O', '#-----rr-----rr-----#', '#------rorrror------#',
  '#---------r---------#', 'O---------r---------O', '##--------r--------##', '.##-------r-------##.',
  '..#O###O#####O###O#..'
];
const WATER = [
  ...LAND.slice(0, 15),
  '#------rorrror--HH--#', '#---------r----HWWH-#', 'O---------r----HWWWHO', '##--------r-----HWWWW',
  '.##-------r------HWW.', '..#O###O#####O###OW..'
];
const ZONE = { '.': 'outside', '#': 'wall', O: 'tower', o: 'tower', r: 'road', '-': 'interior', T: 'townhall', W: 'water', H: 'shore' };
export function zone(i, water) {
  const m = water ? WATER : LAND;
  return ZONE[m[Math.floor(i / N)][i % N]] || 'outside';
}
export const editable = (i, water) => { const z = zone(i, water); return z === 'interior' || z === 'shore'; };

// ShareString 1.3 codes (identical to the game's import/export)
export const B = {
  '-': { id: null, n: 'Empty plot' },
  '.': { id: 'forest', n: 'Forest', node: true, ico: '🌲', bg: '#2e5e2a' },
  ':': { id: 'stone', n: 'Rocks', node: true, ico: '🪨', bg: '#6d6a63' },
  ',': { id: 'iron', n: 'Ore Deposit', node: true, ico: '⛰️', bg: '#4f5f78' },
  ';': { id: 'lake', n: 'Lake', node: true, ico: '💧', bg: '#2f6fa8' },
  2: { id: 'woodcutter', n: "Woodcutter's Hut", g: 'prod', res: 'wood', ico: '🪓', bg: '#8a5a2e' },
  3: { id: 'quarry', n: 'Quarry', g: 'prod', res: 'stone', ico: '⛏️', bg: '#7d7b74' },
  4: { id: 'ironmine', n: 'Iron Mine', g: 'prod', res: 'iron', ico: '⚒️', bg: '#55678a' },
  1: { id: 'farm', n: 'Farm', g: 'prod', res: 'food', ico: '🌾', bg: '#a08a2e' },
  L: { id: 'sawmill', n: 'Sawmill', g: 'proc', res: 'wood', ico: '🪚', bg: '#a66a34' },
  A: { id: 'stonemason', n: 'Stonemason', g: 'proc', res: 'stone', ico: '🧱', bg: '#8f8b80' },
  D: { id: 'foundry', n: 'Foundry', g: 'proc', res: 'iron', ico: '🔥', bg: '#5e6f96' },
  M: { id: 'mill', n: 'Mill', g: 'proc', res: 'food', ico: '🍞', bg: '#b39a3a' },
  C: { id: 'cottage', n: 'Cottage', g: 'eco', ico: '🏡', bg: '#9b6b52' },
  S: { id: 'warehouse', n: 'Warehouse', g: 'eco', ico: '📦', bg: '#7a6040' },
  H: { id: 'hideout', n: 'Hideout', g: 'eco', ico: '🕳️', bg: '#5a5040' },
  U: { id: 'townhouse', n: 'Townhouse', g: 'eco', ico: '🏛️', bg: '#a8862c' },
  P: { id: 'marketplace', n: 'Marketplace', g: 'eco', ico: '🛒', bg: '#9a5e3a' },
  R: { id: 'harbor', n: 'Harbor', g: 'eco', ico: '⚓', bg: '#2f6f8f', shore: true },
  B: { id: 'barracks', n: 'Barracks', g: 'mil', ico: '⛺', bg: '#8a3f36' },
  K: { id: 'cityguard_house', n: 'City Guard House', g: 'mil', ico: '🛡️', bg: '#7d4a40' },
  G: { id: 'training_ground', n: 'Training Ground', g: 'mil', ico: '⚔️', bg: '#8a5036' },
  E: { id: 'stable', n: 'Stable', g: 'mil', ico: '🐎', bg: '#7a5a3a' },
  J: { id: 'moonglow_tower', n: 'Moonglow Tower', g: 'mil', ico: '🔮', bg: '#5a4a8a' },
  Z: { id: 'trinsic_temple', n: 'Trinsic Temple', g: 'mil', ico: '⛪', bg: '#8a7a4a' },
  Y: { id: 'workshop', n: 'Workshop', g: 'mil', ico: '🛠️', bg: '#6a5a4a' },
  V: { id: 'shipyard', n: 'Shipyard', g: 'mil', ico: '⛵', bg: '#2f5f7f', shore: true },
  X: { id: 'castle', n: 'Castle', g: 'mil', ico: '🏰', bg: '#7a3030' },
  T: { id: 'townhall', n: 'Town Hall', ico: '🏯', bg: '#9a7a3a' }
};
// legacy aliases accepted on import (as the game does)
const ALIAS = { W: '2', Q: '3', I: '4', F: '1', _: '-', ' ': '-' };
export const isBuilding = (c) => !!B[c]?.g;
export const isNode = (c) => !!B[c]?.node;

// ---------- game numbers (from the game's own building data) ----------
const PROD = [20, 40, 60, 85, 110, 140, 175, 210, 250, 300]; // woodcutter / quarry / iron mine per hour
const FARM = [5, 10, 15, 20, 30, 45, 75, 120, 200, 300];
const PROC = [30, 35, 40, 45, 50, 55, 60, 65, 70, 75]; // sawmill etc. efficiency %
const PROC_STORE = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200]; // warehouse storage bonus %
const COTTAGE = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
const COTTAGE_SPEED = [4, 10, 16, 25, 35, 46, 58, 71, 85, 100];
const WAREHOUSE = [2500, 5000, 9000, 16000, 26000, 42000, 65000, 100000, 145000, 200000];
// Town Hall (game data): every city with a Town Hall makes 300 wood/h and stores this much of each resource
const TH_WOOD = 300;
const TH_STORE = [5000, 7000, 10000, 15000, 24000, 35000, 50000, 80000, 125000, 175000];
const HIDEOUT = [500, 1000, 2000, 3000, 4500, 6000, 8000, 10000, 12000, 15000];
const TOWNHOUSE = [25, 50, 75, 100, 130, 170, 210, 260, 320, 400];
const MARKET_TAX = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const HARBOR_TAX = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const NODE_FIRST = 50, NODE_NEXT = 40, LAKE = 50, HIDEOUT_FOREST = 10;
const lv = (arr, l) => (l > 0 ? arr[Math.min(10, l) - 1] : 0);
const up = (v, pct) => Math.ceil((v * (100 + pct)) / 100 - 1e-9);

export function neighbours(i) {
  const x = i % N, y = Math.floor(i / N), out = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const a = x + dx, b = y + dy;
    if (a >= 0 && b >= 0 && a < N && b < N) out.push(b * N + a);
  }
  return out;
}

const PROC_OF = { 2: 'L', 3: 'A', 4: 'D', 1: 'M' };
const NODE_OF = { 2: '.', 3: ':', 4: ',' };

// production of one producer cell, same steps and rounding as the game
export function producerOutput(p, i) {
  const c = p.cells[i];
  const d = B[c];
  if (!d || d.g !== 'prod') return null;
  const level = p.levels[i] || 10;
  const base = lv(c === '1' ? FARM : PROD, level);
  let nodes = 0, lakes = 0, cottage = 0, proc = 0;
  for (const j of neighbours(i)) {
    const n = p.cells[j];
    if (c === '1') {
      if (n === ';') lakes++;
      else if (n === '-' && zone(j, p.water) === 'interior') nodes++;
    } else if (n === NODE_OF[c]) nodes++;
    if (n === 'C') cottage += lv(COTTAGE, p.levels[j] || 10);
    else if (n === PROC_OF[c]) proc = Math.max(proc, lv(PROC, p.levels[j] || 10));
  }
  const nodePct = nodes ? NODE_FIRST + NODE_NEXT * (nodes - 1) : 0;
  const lakePct = lakes * LAKE;
  let total = up(base, nodePct);
  total = up(total, cottage);
  if (lakePct) total = up(total, lakePct);
  total = up(total, proc);
  return { res: d.res, base, nodes, nodePct, lakes, lakePct, cottagePct: cottage, procPct: proc, total };
}

export function warehouseOutput(p, i) {
  const base = lv(WAREHOUSE, p.levels[i] || 10);
  const pct = { wood: 0, stone: 0, iron: 0, food: 0 };
  for (const j of neighbours(i)) {
    const d = B[p.cells[j]];
    if (d?.g === 'proc') pct[d.res] += lv(PROC_STORE, p.levels[j] || 10);
  }
  const out = {};
  for (const r of Object.keys(pct)) out[r] = up(base, pct[r]);
  return { base, pct, out };
}

export function townhouseOutput(p, i) {
  let pct = 0;
  for (const j of neighbours(i)) {
    const n = p.cells[j];
    if (n === 'P') pct += lv(MARKET_TAX, p.levels[j] || 10);
    if (n === 'R') pct += lv(HARBOR_TAX, p.levels[j] || 10);
  }
  const base = lv(TOWNHOUSE, p.levels[i] || 10);
  return { base, pct, total: up(base, pct) };
}

export function hideoutOutput(p, i) {
  const forests = neighbours(i).filter((j) => p.cells[j] === '.').length;
  const base = lv(HIDEOUT, p.levels[i] || 10);
  return { base, forests, total: up(base, forests * HIDEOUT_FOREST) };
}

// Whole-city totals
export function cityStats(p) {
  const s = { prod: { wood: 0, stone: 0, iron: 0, food: 0 }, gold: 0, store: { wood: 0, stone: 0, iron: 0, food: 0 }, hide: 0, speed: 0, buildings: 0, count: {}, per: [], th: 0 };
  const th = p.levels?.[TOWNHALL] || 0;
  if (th > 0) {
    s.th = th;
    s.prod.wood += TH_WOOD;
    for (const r in s.store) s.store[r] += lv(TH_STORE, th);
  }
  for (let i = 0; i < N * N; i++) {
    const c = p.cells[i];
    if (!isBuilding(c)) continue;
    s.buildings++;
    s.count[c] = (s.count[c] || 0) + 1;
    const d = B[c];
    if (d.g === 'prod') { const o = producerOutput(p, i); s.prod[o.res] += o.total; s.per[i] = o; }
    else if (c === 'S') { const o = warehouseOutput(p, i); for (const r in o.out) s.store[r] += o.out[r]; s.per[i] = o; }
    else if (c === 'U') { const o = townhouseOutput(p, i); s.gold += o.total; s.per[i] = o; }
    else if (c === 'H') { const o = hideoutOutput(p, i); s.hide += o.total; s.per[i] = o; }
    else if (c === 'C') s.speed += lv(COTTAGE_SPEED, p.levels[i] || 10);
  }
  return s;
}

// Warnings that matter in the game
export function warnings(p) {
  const w = [];
  for (let i = 0; i < N * N; i++) {
    const c = p.cells[i];
    const d = B[c];
    if (!d?.g) continue;
    const nb = neighbours(i).map((j) => p.cells[j]);
    if (d.g === 'proc') {
      const prod = Object.keys(PROC_OF).find((k) => PROC_OF[k] === c);
      if (!nb.includes(prod)) w.push({ i, msg: t('{a} tidak menyentuh {b} (bonusnya terbuang)', { a: d.n, b: B[prod].n }) });
    }
    if (c === 'C' && !nb.some((x) => B[x]?.g === 'prod')) w.push({ i, msg: t('Cottage tidak menyentuh bangunan produksi') });
    if (d.g === 'prod' && c !== '1' && !nb.includes(NODE_OF[c])) w.push({ i, msg: t('{a} tidak menyentuh {b}', { a: d.n, b: B[NODE_OF[c]].n }) });
    if (c === 'U' && !nb.some((x) => x === 'P' || x === 'R')) w.push({ i, msg: t('Townhouse tanpa Marketplace/Harbor di sebelahnya') });
  }
  return w;
}

// ---------- layouts ----------
export function blank(water = false) {
  let cells = '';
  for (let i = 0; i < N * N; i++) {
    const z = zone(i, water);
    cells += i === TOWNHALL ? 'T' : z === 'interior' || z === 'shore' ? '-' : '#';
  }
  return { v: 2, water, cells, levels: Array(N * N).fill(0) };
}

export function parseShareString(text) {
  const m = /\[ShareString\.\d+\.\d+\]([:;])/.exec(text || '');
  if (!m) return null;
  const water = m[1] === ';';
  const body = text.slice(m.index + m[0].length).replace(/\[\/ShareString\]/, '').replace(/\s+/g, '');
  if (body.length < N * N) return null;
  const p = blank(water);
  const cells = p.cells.split('');
  for (let i = 0; i < N * N; i++) {
    if (i === TOWNHALL) continue;
    const z = zone(i, water);
    if (z !== 'interior' && z !== 'shore') continue;
    let c = ALIAS[body[i]] ?? body[i];
    if (!B[c] || c === 'T') c = '-';
    const shoreOnly = B[c]?.shore;
    if (z === 'shore' && c !== '-' && !shoreOnly) c = '-';
    if (z === 'interior' && shoreOnly && water) c = '-';
    cells[i] = c;
    if (isBuilding(c)) p.levels[i] = 10;
  }
  p.cells = cells.join('');
  return p;
}

export function toShareString(p) {
  let s = `[ShareString.1.3]${p.water ? ';' : ':'}`;
  for (let i = 0; i < N * N; i++) {
    const z = zone(i, p.water);
    if (i === TOWNHALL) s += 'T';
    else if (z === 'shore') s += p.cells[i] === '-' ? '_' : p.cells[i];
    else if (z !== 'interior') s += '#';
    else s += p.cells[i] || '-';
  }
  return s + '[/ShareString]';
}

// Old v1 planner layouts -> v2
const OLD = { '.': '-', '#': '-', F: '.', R: ':', O: ',', L: ';', W: '2', Q: '3', I: '4', A: '1', S: 'L', M: 'A', D: 'D', G: 'M', C: 'C', H: 'S', X: 'H', T: 'U', K: 'P', P: 'R', B: 'B', U: 'K', Y: 'G', E: 'E', Z: 'J', N: 'Z', J: 'Y', V: 'V', 1: 'X' };
export function migrate(l) {
  if (l.v === 2) return l;
  const p = blank(false);
  if (l.size === N && l.cells) {
    const cells = p.cells.split('');
    for (let i = 0; i < N * N; i++) {
      if (i === TOWNHALL || zone(i, false) !== 'interior') continue;
      const c = OLD[l.cells[i]] || '-';
      cells[i] = B[c]?.shore ? '-' : c;
      if (isBuilding(cells[i])) p.levels[i] = 10;
    }
    p.cells = cells.join('');
  }
  return { ...p, id: l.id, name: l.name, updatedAt: l.updatedAt || Date.now(), source: 'manual' };
}

// Live snapshot from the game's city view: cells use share-string codes, levels are the real building levels
export function fromGame(cells, levels, water) {
  const p = blank(!!water);
  const out = p.cells.split('');
  for (let i = 0; i < N * N; i++) {
    if (i === TOWNHALL) continue;
    const z = zone(i, p.water);
    if (z !== 'interior' && z !== 'shore') continue;
    let c = cells[i];
    if (!B[c] || c === 'T') c = '-';
    out[i] = c;
    p.levels[i] = isBuilding(c) ? Math.max(1, levels[i] || 1) : 0;
  }
  p.levels[TOWNHALL] = Math.max(0, Math.min(10, levels[TOWNHALL] || 0)); // real Town Hall level
  p.cells = out.join('');
  return p;
}

export const TABLES = { PROD, FARM, PROC, COTTAGE, NODE_FIRST, NODE_NEXT, LAKE, TH_WOOD, TH_STORE };

// English names exactly as shown in the game (build bar, guide) -> share-string code
export const GAME_NAME_TO_CODE = {
  "Woodcutter's Hut": '2', Quarry: '3', 'Iron Mine': '4', Farm: '1', Sawmill: 'L', Stonemason: 'A', Foundry: 'D', Mill: 'M',
  Cottage: 'C', Warehouse: 'S', Hideout: 'H', Townhouse: 'U', Marketplace: 'P', Harbor: 'R', Barracks: 'B', 'City Guard House': 'K',
  'Training Ground': 'G', Stable: 'E', 'Moonglow Tower': 'J', 'Trinsic Temple': 'Z', Workshop: 'Y', Shipyard: 'V', Castle: 'X',
  'Town Hall': 'T', Forest: '.', Rocks: ':', 'Ore Deposit': ',', Lake: ';'
};
