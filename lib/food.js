// Army food balance. Revival rules (game guide "Food & upkeep"): each unit eats its food upkeep per DAY
// (berserker 6, knight 25, war galleon 2,500 …); only troops AT HOME eat — troops out raiding, attacking or
// supporting eat nothing until they return. The city's food production shown in the game is net
// (farms × food research − upkeep). At 0 food with negative production troops desert.
import { unitById, RECRUIT_GROUPS, RECRUIT_CODES, cityRecruitPct } from './cheatsheet.js';
import { troopSpace } from './templates.js';
import { cityStats } from './city.js';
import { prodFactors } from './research.js';

export const foodPerHour = (id) => (unitById(id)?.food || 0) / 24;
const each = (units, f) => Object.entries(units || {}).reduce((a, [id, n]) => a + (n > 0 && unitById(id) ? f(unitById(id), n) : 0), 0);
export const upkeepPerHour = (units) => each(units, (u, n) => (n * u.food) / 24);
export const spaceOf = (units) => each(units, (u, n) => n * u.space);
export function addUnits(...lists) {
  const o = {};
  for (const l of lists) for (const [id, n] of Object.entries(l || {})) if (n > 0) o[id] = (o[id] || 0) + n;
  return o;
}

// the unit a plan would recruit (strongest recruitment group), counted at its hungriest unlocked unit
export function mainUnit(p) {
  const rec = cityRecruitPct(p);
  /** @type {{ g: any, i: number } | null} */
  let best = null;
  rec.forEach((g, i) => { if (g.n && RECRUIT_CODES[i] !== 'K' && (!best || g.pct > best.g.pct)) best = { g, i }; });
  if (!best) return null;
  // worst case: the unlocked unit that eats the most per troop space
  const units = RECRUIT_GROUPS[best.i].units.map(unitById).filter((u) => u.lvl <= best.g.maxLvl && u.id !== 'baron' && u.space > 0);
  return units.sort((a, b) => b.food / b.space - a.food / a.space)[0] || null;
}

/** Plan: food eaten when the troop space is full of `unit` (default: mainUnit) vs the plan's food production/h. */
export function planFood(p, foodProd, unit = mainUnit(p)) {
  const ts = troopSpace(p);
  if (!unit || !unit.space || ts <= 100) return null;
  const eat = ((ts / unit.space) * unit.food) / 24;
  return { ts, unit, eat, prod: foodProd, net: foodProd - eat };
}

/**
 * A real city: { gross, home, away, queued, all, eatHome, eatAll, eatFull, ts, used, netNow, netAll, netFull,
 *   stock, cap, emptyAt (net now), emptyAtFull, source: 'layout'|'game' }  — per hour, local timestamps.
 */
export function cityFood(state, key, now = Date.now()) {
  const c = state.cities?.[key];
  if (!c) return null;
  const [x, y] = key.split(':').map(Number);
  const mv = state.movements || {};
  const tr = (mv.training || []).find((t) => t.x === x && t.y === y);
  const home = tr?.units || {};
  const queued = {};
  for (const q of tr?.queue || []) { const left = Math.max(0, (q.count || 0) - (q.done || 0)); if (left) queued[q.unit] = (queued[q.unit] || 0) + left; }
  const away = addUnits(...(mv.armies || []).filter((a) => !a.trade && a.home && a.home.x === x && a.home.y === y).map((a) => a.units));
  const all = addUnits(home, away, queued);
  const layout = (state.layouts || []).find((l) => l.source === 'game' && l.cityKey === key);
  const eatHome = upkeepPerHour(home), eatAll = upkeepPerHour(all);
  let gross = null, source = null;
  if (layout) { gross = cityStats(layout).prod.food * prodFactors(state).food; source = 'layout'; }
  else if (typeof c.res?.food?.rate === 'number') { gross = c.res.food.rate + eatHome; source = 'game'; }
  const ts = layout ? troopSpace(layout) : null;
  const used = spaceOf(all);
  // full troop space with the current army mix (or the layout's main unit when there is no army yet)
  let eatFull = null;
  if (ts) {
    if (used > 0) eatFull = used >= ts ? eatAll : (eatAll * ts) / used;
    else { const u = layout && mainUnit(layout); if (u) eatFull = ((ts / u.space) * u.food) / 24; }
  }
  const r = c.res?.food;
  const seen = c.seenAt || now;
  const netNow = gross == null ? null : gross - eatHome;
  let stock = null;
  if (r && typeof r.v === 'number') {
    const rate = netNow ?? r.rate ?? 0;
    stock = Math.max(0, r.v + (rate * (now - seen)) / 3.6e6);
    if (r.cap) stock = Math.min(r.cap, stock);
  }
  const until = (net) => (net != null && net < 0 && stock != null ? now + (stock / -net) * 3.6e6 : null);
  const netAll = gross == null ? null : gross - eatAll, netFull = gross == null || eatFull == null ? null : gross - eatFull;
  return { key, name: c.name, gross, source, home, away, queued, all, eatHome, eatAll, eatFull, ts, used, netNow, netAll, netFull, stock, cap: r?.cap || null, emptyAt: until(netNow), emptyAtAll: until(netAll), emptyAtFull: until(netFull) };
}
