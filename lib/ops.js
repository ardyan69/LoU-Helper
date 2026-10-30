// 🎯 Operations: coordinated attacks (send times so every wave lands on time) and the defense assistant
// (which of your cities can still support a city under attack, and with what). Times are LOCAL ms
// (game times are server ms: local = server − serverOffset).
import { unitById } from './cheatsheet.js';
import { armyTravel, FRIGATE_SPACE } from './travel.js';
import { battle, wallSlotsInput } from './battle.js';
import { rpct } from './research.js';

const keyOf = (x, y) => `${x}:${y}`;
// own cities with their troops at home (movements.training holds every city's units)
export function ownCities(state) {
  const out = new Map();
  for (const c of Object.values(state.cities || {})) if (c.x != null) out.set(c.key || keyOf(c.x, c.y), { key: c.key || keyOf(c.x, c.y), name: c.name, x: c.x, y: c.y, castle: !!c.castle, water: !!c.water, home: {} });
  for (const tr of state.movements?.training || []) {
    const k = keyOf(tr.x, tr.y);
    const o = out.get(k) || { key: k, name: tr.name, x: tr.x, y: tr.y, castle: false, water: false };
    out.set(k, { ...o, home: tr.units || {} });
  }
  return [...out.values()];
}

/**
 * Coordinated attack.
 * rows: [{ key, from: {x,y}, units: {id: n}, wave: 1.., order }]
 * opts: { state, target: {x,y}, arriveAt: local ms or null (= as soon as possible), gap: seconds between waves,
 *         ready: ms to get ready when arriveAt is null, now }
 * → { rows: [{ ...row, travel, arriveAt, sendAt, late }], first, earliest }
 */
export function planAttack(rows, opts) {
  const now = opts.now ?? Date.now();
  const gap = Math.max(0, opts.gap || 0) * 1000;
  const items = rows.map((r) => ({ ...r, wave: Math.max(1, Math.floor(r.wave) || 1), travel: armyTravel(opts.state, r.from, opts.target, r.units) }));
  const ok = items.filter((r) => r.travel.ok);
  // earliest landing of wave 1 so that every wave can still be sent
  const earliest = ok.length ? Math.max(...ok.map((r) => now + r.travel.ms - (r.wave - 1) * gap)) : null;
  let first = opts.arriveAt || null;
  if (!first && earliest != null) first = Math.ceil((earliest + (opts.ready ?? 120000)) / 1000) * 1000;
  for (const r of ok) {
    r.arriveAt = first + (r.wave - 1) * gap;
    r.sendAt = r.arriveAt - r.travel.ms;
    r.late = r.sendAt < now;
  }
  return { rows: items, first, earliest };
}

/**
 * Defense assistant for one incoming attack.
 * inc: { toX, toY, arriveAt (server ms), units, order, owner }
 * → { target, arriveAt, home, options: [{ key, name, dist, units: [{ id, n, ms, sendBy, ok, reason }] }],
 *     reach: units that can arrive in time, estimate: { att, homeOnly, withSupport } | null }
 */
export function defenseOptions(state, inc, now = Date.now(), attackLog = []) {
  const off = state.movements?.serverOffset || 0;
  const arriveAt = inc.arriveAt - off;
  const target = { x: inc.toX, y: inc.toY };
  const cities = ownCities(state);
  const tc = cities.find((c) => c.x === target.x && c.y === target.y);
  const home = { ...(tc?.home || {}) };
  const options = [];
  const reach = {};
  for (const c of cities) {
    if (c === tc) continue;
    const units = [];
    for (const [id, n] of Object.entries(c.home || {})) {
      const u = unitById(id);
      if (!(n > 0) || !u || !(u.spd > 0) || id === 'baron') continue;
      let tv = armyTravel(state, c, target, { [id]: n }), sent = n, frigates = 0;
      // across the sea: land units ride along on the city's Frigates (500 troop space each)
      if (!tv.ok && tv.reason === 'continent' && (c.home.frigate || 0) > 0 && !u.naval) {
        frigates = c.home.frigate;
        sent = Math.min(n, Math.floor((frigates * FRIGATE_SPACE) / Math.max(1, u.space)));
        if (sent > 0) tv = armyTravel(state, c, target, { [id]: sent, frigate: frigates });
      }
      if (!tv.ok) { units.push({ id, n, ok: false, reason: tv.reason }); continue; }
      const sendBy = arriveAt - tv.ms;
      const ok = sendBy >= now;
      units.push({ id, n: sent, of: n, frigates, ms: tv.ms, sendBy, ok, lateBy: ok ? 0 : now - sendBy });
      if (ok) reach[id] = (reach[id] || 0) + sent;
    }
    if (units.length) options.push({ key: c.key, name: c.name, dist: Math.hypot(c.x - target.x, c.y - target.y), units: units.sort((a, b) => (+b.ok - +a.ok) || (a.ms ?? Infinity) - (b.ms ?? Infinity)) });
  }
  options.sort((a, b) => a.dist - b.dist);
  // attacker: visible units, else the largest army this player sent before (attack log)
  let att = inc.units && Object.values(inc.units).some((n) => n > 0) ? inc.units : null, attFrom = att ? 'visible' : null;
  if (!att && inc.owner) {
    const prev = attackLog.filter((a) => a.owner === inc.owner && a.units && Object.values(a.units).some((n) => n > 0));
    const size = (u) => Object.values(u).reduce((s, n) => s + n, 0);
    const big = prev.sort((a, b) => size(b.units) - size(a.units))[0];
    if (big) { att = big.units; attFrom = 'history'; }
  }
  let estimate = null;
  if (att) {
    const c = state.cities?.[keyOf(target.x, target.y)];
    const ws = wallSlotsInput(c?.towers);
    const base = { order: inc.order || 'assault', att, wall: c?.wallLevel || 0, defBonus: rpct(state, 'military'), atkBonus: 0, towers: ws.towers, traps: ws.traps };
    const withAll = { ...home };
    for (const [id, n] of Object.entries(reach)) withAll[id] = (withAll[id] || 0) + n;
    estimate = { att, attFrom, homeOnly: battle({ ...base, def: home }), withSupport: battle({ ...base, def: withAll }) };
  }
  return { target, targetName: tc?.name || inc.target?.name || null, arriveAt, home, options, reach, estimate };
}
