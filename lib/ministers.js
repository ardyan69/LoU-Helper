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
import { unitById, cityRecruitPct, RECRUIT_CODES, dungeonNeed } from './cheatsheet.js';
import { troopSpace } from './templates.js';
import { planSteps } from './buildorder.js';
import { liveLayout } from './cityrates.js';
import { prodFactors } from './research.js';
import { upkeepPerHour, mainUnit } from './food.js';

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
const LAND = ['mountain', 'forest', 'hill'];
export function raidUnits(home) {
  return Object.entries(home || {}).filter(([id, n]) => { const u = unitById(id); return n > 0 && u && u.carry > 0 && u.spd > 0 && !u.naval && id !== 'baron' && id !== 'scout'; });
}
// how many times the city's raid troops cover the attack a level-L dungeon needs (worst land kind)
export function raidCover(home, level) {
  const list = raidUnits(home);
  if (!list.length) return 0;
  let worst = Infinity;
  for (const kind of LAND) {
    let cover = 0;
    for (const [id, n] of list) { const need = dungeonNeed(kind, level, 0, unitById(id)); if (need) cover += n / need.byAtk; }
    worst = Math.min(worst, cover);
  }
  return worst;
}
export function recWar(state, c) {
  const layout = liveLayout(state, c.key);
  const role = cityRole(layout), front = frontline(state, c);
  const cur = current(state, 'military', c.id) || DEFAULTS.military();
  const units = raidUnits(c.home).map(([id]) => id);
  if (!units.length) return { config: { ...DEFAULTS.military(), ...cur, enabled: false }, why: ['war-none'], role, info: {} };
  let maxLevel = 1;
  for (let L = 1; L <= 10; L++) if (raidCover(c.home, L) >= 1.5) maxLevel = L;
  const cover = raidCover(c.home, maxLevel);
  const maxArmies = clamp(Math.floor(cover / 1.5), 1, 5);
  const keepHomePct = front ? 0.3 : role === 'military' ? 0 : 0.1;
  // radius: far enough for ~12 known dungeons of a fitting level
  const dg = Object.values(state.dungeons || {}).filter((d) => d.kind !== 'boss' && d.x != null && d.level <= maxLevel && String(d.type || '').toLowerCase() !== 'sea')
    .map((d) => Math.hypot(d.x - c.x, d.y - c.y)).sort((a, b) => a - b);
  const radius = dg.length >= 3 ? clamp(Math.ceil(dg[Math.min(11, dg.length - 1)]), 5, 60) : 20;
  const why = ['war-level', front ? 'war-front' : role === 'military' ? 'war-all' : 'war-keep', dg.length >= 3 ? 'war-radius' : 'war-radius-default'];
  return { config: { ...DEFAULTS.military(), ...cur, enabled: true, maxLevel, radius, keepHomePct, maxArmies, units }, why, role, info: { cover, dungeons: dg.length } };
}

// ---------- 🛒 Trade ----------
const round = (v, step = 1000) => Math.max(0, Math.round(v / step) * step);
/** → { settings: { minShipment, cities }, why: { cityId: [codes] }, hub } */
export function recTrade(state, cities) {
  const M = ministersOf(state);
  const curT = M?.trade || {};
  const info = cities.map((c) => {
    const l = liveLayout(state, c.key);
    const st = l ? cityStats(l) : null;
    const cap = st ? st.store : (state.cities?.[c.key]?.res ? Object.fromEntries(RES.map((r) => [r, state.cities[c.key].res[r]?.cap || 0])) : null);
    return { c, role: cityRole(l), cap, total: cap ? RES.reduce((a, r) => a + (cap[r] || 0), 0) : 0, eat: upkeepPerHour(c.home) };
  });
  const why = {};
  const out = {};
  if (info.length < 2) return { settings: { ...curT, cities: { ...(curT.cities || {}) } }, why, hub: null };
  // hub: a hub layout, else the largest storage that is not a military city
  const pick = [info.filter((x) => x.role === 'hub'), info.filter((x) => x.cap && x.role !== 'military' && x.role !== 'unknown'), info.filter((x) => x.cap)].find((l) => l.length) || info;
  const hub = pick.slice().sort((a, b) => b.total - a.total)[0];
  for (const x of info) {
    const id = x.c.id;
    if (x === hub) { out[id] = { target: {}, surplus: 'keep' }; why[id] = ['trade-hub']; continue; }
    if (!x.cap || x.role === 'unknown') { out[id] = curT.cities?.[id] || { target: {}, surplus: 'keep' }; why[id] = ['no-layout']; continue; }
    const share = x.role === 'military' ? { wood: 0.2, stone: 0.2, iron: 0.6, food: 0.8 } : x.role === 'new' ? { wood: 0.6, stone: 0.6, iron: 0.3, food: 0.3 } : { wood: 0.4, stone: 0.4, iron: 0.4, food: 0.4 };
    const target = {};
    for (const r of RES) target[r] = round((x.cap[r] || 0) * share[r]);
    if (x.role === 'military' && x.eat > 0) target.food = Math.min(round(x.cap.food * 0.95), Math.max(target.food, round(x.eat * 24)));
    for (const r of RES) if (!target[r]) delete target[r]; // a resource without a target is never sent
    out[id] = { target, requestFrom: hub.c.id, surplus: x.role === 'military' ? 'keep' : 'send', ...(x.role === 'military' ? {} : { sendTo: hub.c.id }) };
    why[id] = [x.role === 'military' ? 'trade-mil' : x.role === 'new' ? 'trade-new' : 'trade-eco'];
  }
  return { settings: { minShipment: Math.max(curT.minShipment || 0, 5000), cities: out }, why, hub: hub.c };
}

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
