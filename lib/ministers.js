// 🎩 Ministers (Build, Defense, War = "military", Trade) — game data model, recommendations and the
// commands the game itself sends from its Ministers screen. Config shapes (from the game client):
//   build    { enabled, plan:[{slot,type,level}], wallLevel 0-10, keepQueued 1-4, demolishUnplanned, upgradeExisting,
//              evenBuild, typeLevels:{type: level} }
//   defense  { enabled, targets:{unit: count}, wallLevel 0-10, towerLevel 0-10 }
//   military { enabled, maxLevel 1-10, radius 1-60, keepHomePct 0-1, maxArmies 1-5, units:[unit] }   (automatic raids)
//   trade    { reservePct, fillPct, minShipment, defaults, cities:{ cityId: { target:{wood,stone,iron,food}, requestFrom,
//              surplus:'keep'|'send'|'purify', sendTo } } }
// Commands: { t:'ministerCity', key, cityId, config } · { t:'ministerTrade', settings } · { t:'ministerToggle', key, enabled }
import { N, TOWNHALL, B, isBuilding, cityStats } from './city.js';
import { unitById, cityRecruitPct, RECRUIT_CODES, dungeonNeed, dungeonLevel } from './cheatsheet.js';
import { troopSpace, tradeCap } from './templates.js';
import { continentOf, minPerField } from './travel.js';
import { planSteps } from './buildorder.js';
import { liveLayout } from './cityrates.js';
import { prodFactors } from './research.js';
import { upkeepPerHour, mainUnit, planFood } from './food.js';

export const KEYS = ['build', 'defense', 'military', 'trade'];
export const DEFAULTS = {
  build: () => ({ enabled: true, plan: [], wallLevel: 0, keepQueued: 2, demolishUnplanned: false, upgradeExisting: false }),
  defense: () => ({ enabled: true, targets: {}, wallLevel: 0, towerLevel: 0 }),
  military: () => ({ enabled: true, maxLevel: 3, radius: 20, keepHomePct: 0.2, maxArmies: 1, units: [] })
};
const RES = ['wood', 'stone', 'iron', 'food'];
const MILB = new Set(['B', 'K', 'G', 'E', 'J', 'Z', 'Y', 'V', 'X']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
export const sameConfig = (a, b) => stable(a ?? null) === stable(b ?? null);

// own cities with their game id (from the game store snapshot)
export function ministerCities(state) {
  const out = [];
  const seen = new Set();
  for (const tr of state.movements?.training || []) {
    if (!tr.id || seen.has(tr.id)) continue;
    seen.add(tr.id);
    const key = `${tr.x}:${tr.y}`;
    const c = state.cities?.[key] || {};
    out.push({ id: tr.id, key, name: tr.name || c.name, x: tr.x, y: tr.y, castle: !!c.castle, water: !!c.water, home: tr.units || {} });
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
}
export const ministersOf = (state) => state.movements?.ministers || null;
export const ministerUntil = (state) => state.movements?.ministerUntil || null;
export function current(state, key, cityId) {
  const M = ministersOf(state);
  if (key === 'trade') return M?.trade?.cities?.[cityId] || null;
  return M?.[key]?.cities?.[cityId] || null;
}

// what a city is for, from its synced layout
export function cityRole(layout) {
  if (!layout) return 'unknown';
  let n = 0, mil = 0, wh = 0;
  for (const c of layout.cells) { if (!isBuilding(c)) continue; n++; if (MILB.has(c)) mil++; if (c === 'S') wh++; }
  if (n < 20) return 'new';
  if (mil / n >= 0.3) return 'military';
  if (wh / n >= 0.25) return 'hub';
  return 'economy';
}
// attacked in the last 14 days (attack log) → frontline
export function frontline(state, c, now = Date.now()) {
  return (state.attackLog || []).some((a) => a.toX === c.x && a.toY === c.y && (a.arriveAt || a.seenAt || 0) > now - 14 * 864e5);
}

// ---------- 🔨 Build ----------
/** Layout plan → the Build Minister's list, in the smart build order (lib/buildorder.js). Buildings already at
 *  their planned level come first (nothing to do), then every slot at its first step; one entry per slot. */
export function planToMinister(plan, base) {
  const out = [], seen = new Set();
  const lvl = (i) => plan.levels?.[i] || 10;
  const push = (i, code) => { if (seen.has(i)) return; seen.add(i); out.push({ slot: i, type: code === 'T' ? 'townhall' : B[code].id, level: i === TOWNHALL ? Math.max(1, plan.levels?.[TOWNHALL] || 10) : lvl(i) }); };
  const { steps } = planSteps(plan, base);
  const touched = new Set(steps.filter((s) => s.kind !== 'demolish').map((s) => s.i));
  for (let i = 0; i < N * N; i++) if (isBuilding(plan.cells[i]) && !touched.has(i)) push(i, plan.cells[i]);
  for (const s of steps) if (s.kind !== 'demolish') push(s.i, s.code);
  return out;
}
// the game's own rule: every type in the plan gets the highest level planned for it
export function typeLevelsFrom(plan, existing = {}) {
  const tl = { ...existing }, m = new Map();
  for (const p of plan) if (p.type) m.set(p.type, Math.max(m.get(p.type) || 0, p.level));
  for (const [k, v] of m) { if (v > 0) tl[k] = v; else delete tl[k]; }
  return tl;
}
const wallFor = (role, c, front) => (front || c.castle || role === 'military' ? 10 : 0);

/** opts.plan: a layout to send as the build plan (optional) */
export function recBuild(state, c, opts = {}) {
  const layout = liveLayout(state, c.key);
  const role = cityRole(layout), front = frontline(state, c);
  const cur = current(state, 'build', c.id) || DEFAULTS.build();
  const why = layout ? [] : ['no-layout'];
  const cfg = { ...DEFAULTS.build(), ...cur, enabled: true, keepQueued: 4 };
  why.push('keepQueued');
  cfg.wallLevel = wallFor(role, c, front);
  why.push(cfg.wallLevel ? (front ? 'wall-front' : 'wall-mil') : 'wall-eco');
  if (opts.plan && layout) {
    cfg.plan = planToMinister(opts.plan, layout);
    cfg.typeLevels = typeLevelsFrom(cfg.plan, cur.typeLevels);
    cfg.evenBuild = false;
    cfg.demolishUnplanned = true;
    cfg.upgradeExisting = true;
    why.push('plan');
  } else {
    cfg.upgradeExisting = true;
    cfg.evenBuild = true;
    if (layout) {
      const tl = { ...(cur.typeLevels || {}) };
      for (const ch of new Set(layout.cells)) if (isBuilding(ch)) tl[B[ch].id] = 10;
      cfg.typeLevels = tl;
    }
    why.push('upgrade');
  }
  return { config: cfg, why, role };
}

// ---------- 🛡️ Defense ----------
const DEF_PICK = { G: ['guardian', 'ranger'], E: ['crossbowman'], Z: ['paladin', 'templar'], J: [], Y: ['ballista'], K: [], V: [] };
export function recDefense(state, c) {
  const layout = liveLayout(state, c.key);
  const role = cityRole(layout), front = frontline(state, c);
  const cur = current(state, 'defense', c.id) || DEFAULTS.defense();
  const why = [];
  const cfg = { ...DEFAULTS.defense(), ...cur, enabled: true, targets: {} };
  cfg.wallLevel = wallFor(role, c, front);
  cfg.towerLevel = front || c.castle ? 10 : 0;
  if (!layout) return { config: { ...cur }, why: ['no-layout'], role, info: {} };
  const ts = troopSpace(layout);
  const rec = cityRecruitPct(layout);
  let unit = null, share = 1;
  if (role === 'military') { unit = mainUnit(layout); why.push('def-army'); }
  else {
    // a garrison: the best defensive unit this city can recruit, half the troop space
    rec.forEach((g, i) => { if (unit || !g.n) return; for (const id of DEF_PICK[RECRUIT_CODES[i]] || []) { const u = unitById(id); if (u && u.lvl <= g.maxLvl && (!u.castle || c.castle)) { unit = u; break; } } });
    share = 0.5;
    if (unit) why.push('def-garrison');
  }
  const info = { ts, unit: unit?.id || null };
  if (unit && ts > 100) {
    const n = Math.floor((ts * share) / unit.space);
    cfg.targets = { [unit.id]: n };
    const gross = cityStats(layout).prod.food * prodFactors(state).food;
    const eat = upkeepPerHour({ [unit.id]: n });
    info.eat = eat; info.gross = gross;
    if (eat > gross) why.push('def-food');
  } else if (!unit) why.push('def-none');
  why.push(cfg.wallLevel ? 'wall-mil' : 'wall-eco');
  return { config: cfg, why, role, info };
}

// ---------- ⚔️ War (automatic raids) ----------
// The War Minister raids the nearest land dungeons up to `maxLevel` with idle troops and "sends only what is
// needed to clear it with few losses", so loot per raid ≈ the carry of an army just strong enough for the level.
// Loot per hour therefore grows with the troops actually in use: pick the level where `maxArmies` (≤ 5) armies
// of that level use (almost) all raiding troops, and a radius that reaches enough dungeons of that level.
const LAND = ['mountain', 'forest', 'hill'];
const OFFENSIVE = new Set(['berserker', 'knight', 'mage', 'warlock']);
export function raidUnits(home) {
  return Object.entries(home || {}).filter(([id, n]) => { const u = unitById(id); return n > 0 && u && u.carry > 0 && u.spd > 0 && !u.naval && id !== 'baron' && id !== 'scout'; });
}
// raiding troops of a city: at home + out raiding (they come back idle)
export function raidPool(state, c) {
  const out = { ...(c.home || {}) };
  for (const a of state.movements?.armies || []) {
    if (a.trade || !a.home || a.home.x !== c.x || a.home.y !== c.y || !/raid|return/i.test(a.order || '')) continue;
    for (const [id, n] of Object.entries(a.units || {})) if (n > 0) out[id] = (out[id] || 0) + n;
  }
  return out;
}
const coverBy = (units, level, kind) => { let cv = 0; for (const [id, n] of raidUnits(units)) { const need = dungeonNeed(kind, level, 0, unitById(id)); if (need) cv += n / need.byAtk; } return cv; };
// how many armies strong enough for a level-L dungeon the troops make (worst land kind / average)
export function raidCover(units, level) { return Math.min(...LAND.map((k) => coverBy(units, level, k))); }
export const raidCoverAvg = (units, level) => LAND.reduce((a, k) => a + coverBy(units, level, k), 0) / LAND.length;

export function recWar(state, c, now = Date.now()) {
  const layout = liveLayout(state, c.key);
  const role = cityRole(layout), front = frontline(state, c, now);
  const cur = current(state, 'military', c.id) || DEFAULTS.military();
  const off = state.movements?.serverOffset || 0;
  const attacked = (state.movements?.incoming || []).some((a) => a.toX === c.x && a.toY === c.y && (a.arriveAt || 0) - off > now);
  const pool = raidPool(state, c);
  let ids = raidUnits(pool).map(([id]) => id);
  const why = [];
  if (!ids.length) return { config: { ...DEFAULTS.military(), ...cur, enabled: false }, why: ['war-none'], role, info: {} };
  if (attacked) return { config: { ...DEFAULTS.military(), ...cur, enabled: false }, why: ['war-attacked'], role, info: {} };
  if (front && ids.some((id) => OFFENSIVE.has(id)) && ids.some((id) => !OFFENSIVE.has(id))) { ids = ids.filter((id) => OFFENSIVE.has(id)); why.push('war-offense-only'); }
  const units = Object.fromEntries(ids.map((id) => [id, pool[id]]));
  if (raidCover(units, 1) < 1) return { config: { ...DEFAULTS.military(), ...cur, enabled: false }, why: ['war-weak'], role, info: {} };
  let maxLevel = 1;
  for (let L = 1; L <= 10; L++) { if (raidCover(units, L) < 1) break; maxLevel = L; if (raidCoverAvg(units, L) <= 5) break; }
  // recorded land dungeons within the minister's reach (60 fields)
  const near = Object.values(state.dungeons || {}).filter((d) => d.kind !== 'boss' && d.x != null && LAND.includes(String(d.type || '').toLowerCase()) && (d.explored ?? 0) < 100)
    .map((d) => ({ d: Math.hypot(d.x - c.x, d.y - c.y), lv: d.level })).filter((x) => x.d <= 60).sort((a, b) => a.d - b.d);
  why.push('war-level');
  // no dungeon of that level around: aim at the highest level that does exist nearby
  if (near.length && !near.some((x) => x.lv >= maxLevel - 2 && x.lv <= maxLevel)) {
    const top = Math.max(...near.filter((x) => x.lv <= maxLevel).map((x) => x.lv), 1);
    if (top < maxLevel) { maxLevel = top; why.push({ k: 'war-cap', p: { l: top } }); }
  }
  const avg = raidCoverAvg(units, maxLevel);
  const maxArmies = clamp(Math.floor(avg), 1, 5);
  // keep at home
  let keepHomePct = role === 'military' ? 0 : 0.1;
  const gross = layout ? cityStats(layout).prod.food * prodFactors(state).food : null;
  if (gross != null && gross - upkeepPerHour(c.home) < 0) { keepHomePct = 0; why.push('war-food'); }
  if (front) { keepHomePct = 0.3; why.push('war-front'); } else if (role === 'military') why.push('war-all'); else if (keepHomePct) why.push('war-keep');
  // radius: reach ~3 dungeons per army near the chosen level (levels L-2…L), all land kinds
  const good = near.filter((x) => x.lv <= maxLevel && x.lv >= maxLevel - 2);
  const need = maxArmies * 3;
  let radius = 20;
  if (good.length) { radius = clamp(Math.ceil(good[Math.min(need, good.length) - 1].d) + 1, 5, 60); why.push('war-radius'); } else why.push('war-radius-default');
  // expected loot per hour: armies × (carry of one army) ÷ round trip
  const mpf = Math.max(...ids.map((id) => minPerField(state, id) || unitById(id).spd));
  const used = good.slice(0, need);
  const dist = used.length ? used.reduce((a, x) => a + x.d, 0) / used.length : radius / 2;
  const carryArmy = ids.reduce((a, id) => a + (units[id] / Math.max(1, avg)) * unitById(id).carry, 0);
  const loot = Math.min(carryArmy, LAND.reduce((a, k) => a + dungeonLevel(k, maxLevel, 0).loot, 0) / LAND.length);
  const tripH = Math.max(1 / 60, (2 * dist * mpf) / 60);
  const info = { cover: avg, armies: maxArmies, usedPct: Math.min(100, Math.round((maxArmies / Math.max(1, avg)) * 100)), dungeons: good.length, lootH: Math.round((maxArmies * loot) / tripH), dist: Math.round(dist) };
  why.push({ k: 'war-info', p: { a: maxArmies, u: info.usedPct, l: info.lootH, n: info.dungeons } });
  return { config: { ...DEFAULTS.military(), ...cur, enabled: true, maxLevel, radius, keepHomePct, maxArmies, units: ids }, why, role, info };
}

// ---------- 🛒 Trade ----------
// Carts travel over land: each continent gets its own hub (a hub layout, else the best-placed non-military city
// with the largest storage and most carts). Cities alone on a continent can only trade by sea (Harbor + ships).
const round = (v, step = 1000) => Math.max(0, Math.round(v / step) * step);
const SHARE = { military: { wood: 0.2, stone: 0.2, iron: 0.6, food: 0.5 }, new: { wood: 0.6, stone: 0.6, iron: 0.3, food: 0.3 }, economy: { wood: 0.4, stone: 0.4, iron: 0.4, food: 0.4 }, hub: { wood: 0.4, stone: 0.4, iron: 0.4, food: 0.4 } };
/** → { settings: { minShipment, cities }, why: { cityId: [codes] }, hub (first), hubs: { continent: city } } */
export function recTrade(state, cities) {
  const M = ministersOf(state);
  const curT = M?.trade || {};
  const info = cities.map((c) => {
    const l = liveLayout(state, c.key);
    const st = l ? cityStats(l) : null;
    const tc = l ? tradeCap(l) : { carts: 0, ships: 0 };
    let moon10 = false;
    if (l) for (let i = 0; i < N * N; i++) if (l.cells[i] === 'J' && (l.levels?.[i] || 0) >= 10) moon10 = true;
    const pf = l ? planFood(l, 0) : null;
    return { c, l, role: cityRole(l), cap: st ? st.store : null, total: st ? RES.reduce((a, r) => a + st.store[r], 0) : 0, carts: tc.carts, ships: tc.ships, moon10,
      eatNow: upkeepPerHour(c.home), eatFull: pf?.eat || 0, cont: continentOf(c.x, c.y) };
  });
  const why = {}, out = {}, hubs = {};
  if (info.length < 2) return { settings: { ...curT, cities: { ...(curT.cities || {}) } }, why, hub: null, hubs };
  const byCont = new Map();
  for (const x of info) { if (!byCont.has(x.cont)) byCont.set(x.cont, []); byCont.get(x.cont).push(x); }
  const avgDist = (x, list) => list.length > 1 ? list.filter((y) => y !== x).reduce((a, y) => a + Math.hypot(x.c.x - y.c.x, x.c.y - y.c.y), 0) / (list.length - 1) : 0;
  const pickHub = (list) => {
    const ok = list.filter((x) => x.cap && x.role !== 'unknown');
    const cand = [ok.filter((x) => x.role === 'hub'), ok.filter((x) => x.role !== 'military'), ok].find((l) => l.length);
    if (!cand) return null;
    return cand.map((x) => ({ x, score: x.total / 1e5 + x.carts / 40 - avgDist(x, list) / 8 })).sort((a, b) => b.score - a.score)[0].x;
  };
  for (const [cont, list] of byCont) if (list.length >= 2) { const h = pickHub(list); if (h) hubs[cont] = h; }
  // a global sea hub for lone cities: the land hub with the most ships
  const seaHub = Object.values(hubs).filter((h) => h.ships > 0).sort((a, b) => b.ships - a.ships)[0] || null;
  for (const x of info) {
    const id = x.c.id;
    const hub = hubs[x.cont];
    if (hub === x) {
      out[id] = { target: {}, surplus: 'keep' };
      why[id] = ['trade-hub', { k: 'trade-hub-info', p: { n: list(byCont.get(x.cont)).length - 1, c: x.carts } }];
      if (x.carts < 50) why[id].push({ k: 'trade-carts', p: { n: x.carts } });
      continue;
    }
    if (!x.cap || x.role === 'unknown') { out[id] = curT.cities?.[id] || { target: {}, surplus: 'keep' }; why[id] = ['no-layout']; continue; }
    const from = hub || (x.ships > 0 && seaHub && seaHub !== x ? seaHub : null);
    const share = SHARE[x.role] || SHARE.economy;
    const target = {};
    for (const r of RES) target[r] = round((x.cap[r] || 0) * share[r]);
    /** @type {any[]} */
    const codes = [x.role === 'military' ? 'trade-mil' : x.role === 'new' ? 'trade-new' : 'trade-eco'];
    if (x.role === 'military') {
      const eat = Math.max(x.eatNow, x.eatFull);
      if (eat > 0) { target.food = Math.min(round(x.cap.food * 0.95), Math.max(target.food, round(eat * 24))); codes.push({ k: 'trade-food', p: { n: round(eat * 24) } }); }
    }
    for (const r of RES) if (!target[r]) delete target[r]; // a resource without a target is never sent
    if (!from) {
      out[id] = { target: {}, surplus: x.moon10 ? 'purify' : 'keep' };
      why[id] = ['trade-alone', ...(x.moon10 ? ['trade-purify'] : [])];
      continue;
    }
    const cfg = { target, requestFrom: from.c.id };
    if (x.role === 'military') cfg.surplus = 'keep';
    else if (from === hub) { cfg.surplus = 'send'; cfg.sendTo = hub.c.id; }
    else cfg.surplus = x.moon10 ? 'purify' : 'keep';
    out[id] = cfg;
    if (!hub) codes.push('trade-sea');
    codes.push({ k: 'trade-dist', p: { c: from.c.name, d: Math.round(Math.hypot(x.c.x - from.c.x, x.c.y - from.c.y)) } });
    why[id] = codes;
  }
  const hubCarts = Math.max(0, ...Object.values(hubs).map((h) => h.carts));
  const minShipment = hubCarts >= 200 ? 10000 : hubCarts >= 50 ? 5000 : 2000;
  return { settings: { minShipment, cities: out }, why, hub: Object.values(hubs)[0]?.c || null, hubs };
}
const list = (l) => l || [];

// ---------- commands ----------
export const cityCmd = (key, cityId, config) => ({ t: 'ministerCity', key, cityId, config });
// the game's Trade screen saves every city at once (replace: true) — keep the cities we don't touch
export function tradeCmd(state, edits, minShipment) {
  const cur = ministersOf(state)?.trade || {};
  const cities = { ...(cur.cities || {}), ...edits };
  for (const [id, v] of Object.entries(cities)) if (!v) delete cities[id];
  return { t: 'ministerTrade', settings: { minShipment: minShipment ?? cur.minShipment ?? 500, ...(cur.defaults ? { defaults: cur.defaults } : {}), cities, replace: true } };
}
export const toggleCmd = (key, enabled) => ({ t: 'ministerToggle', key, enabled: !!enabled });
