// Revival battle rules (attack phase, expected values) — used by Cheat Sheet → Battle and the defense assistant.
import { REV_UNITS, unitById } from './cheatsheet.js';
import { WALL, BUILDINGS, TOWERS, TRAPS, ORDERS } from './gamedata.js';

export const TYPES = ['infantry', 'cavalry', 'magic', 'artillery'];
const lvlEff = (id, lvl) => (lvl > 0 ? BUILDINGS[id].eff[Math.min(10, lvl) - 1] : 0);

// a city's wall slots as read from the game ({ ranger_tower: [levels…], pitfall_trap: [...] }) → battle() input
export function wallSlotsInput(slots) {
  const towers = {}, traps = {};
  for (const [k, levels] of Object.entries(slots || {})) {
    const tot = (levels || []).reduce((s, l) => s + lvlEff(k, l), 0);
    if (TOWERS[k]) towers[k] = (towers[k] || 0) + tot;
    else if (TRAPS[k]) traps[TRAPS[k]] = (traps[TRAPS[k]] || 0) + tot;
  }
  return { towers, traps };
}

// Game rules (attack phase): see README → Battle simulator.
export function battle(o) {
  const scout = o.order === 'scout';
  const ord = ORDERS[o.order] || ORDERS.assault;
  const pick = (m) => Object.entries(m || {}).filter(([id, n]) => n > 0 && unitById(id) && (scout ? id === 'scout' : true));
  const A = pick(o.att).filter(([id]) => unitById(id).spd > 0 || id === 'cityguard');
  const D = pick(o.def);
  const u = 1 + (o.atkBonus || 0) / 100, dB = 1 + (o.defBonus || 0) / 100, m = 1 + Math.max(0, o.morale || 0) / 100;
  const wallB = 1 + (o.wall > 0 ? WALL.eff[Math.min(10, o.wall) - 1] : 0) / 100;
  const p = {};
  for (const [id, n] of A) p[unitById(id).type] = (p[unitById(id).type] || 0) + n;
  const g = {};
  for (const k of Object.keys(p)) g[k] = p[k] > 0 ? Math.min(o.traps?.[k] || 0, p[k] * 0.5) / p[k] : 0;
  const y = new Map(D);
  let cg = o.def?.cityguard || 0;
  for (const [tw, T] of Object.entries(o.towers || {})) {
    if (!T) continue;
    const { unit: E, per } = TOWERS[tw];
    if (scout && E !== 'scout') continue;
    const F = o.def?.[E] || 0, R = Math.min(F, T);
    if (R > 0 && y.has(E)) y.set(E, y.get(E) + R);
    if (!scout && cg > 0 && T > R && y.has('cityguard')) { const j = Math.min(cg, (T - R) * per); cg -= j; y.set('cityguard', y.get('cityguard') + j); }
  }
  const groups = A.map(([id, n]) => { const U = unitById(id); return { id, n, type: U.type, a: n * (1 - (g[U.type] || 0)) * U.atk * u, d: 0 }; });
  const x = groups.reduce((s, q) => s + q.a, 0);
  let w = 0;
  const perUnitDef = {}; // defense one extra unit of each type would add
  for (const q of groups) {
    const share = x > 0 ? q.a / x : 1 / Math.max(1, groups.length);
    let E = 0;
    for (const [id, F] of y) { const U = unitById(id); E += F * share * U.def[TYPES.indexOf(q.type)] * (U.naval ? 1 : wallB) * dB * m; }
    for (const U of REV_UNITS) perUnitDef[U.id] = (perUnitDef[U.id] || 0) + share * U.def[TYPES.indexOf(q.type)] * (U.naval ? 1 : wallB) * dB * m;
    q.d = E; w += E;
  }
  const win = D.length === 0 ? A.length > 0 : x > w;
  const attLoss = {}, defLoss = {};
  let defFrac = 0;
  if (D.length && x + w > 0) {
    const P = w > 0 ? x / w : Infinity;
    defFrac = Math.min(1, ord.defender * (win ? Math.sqrt(P) : P));
    for (const [id, n] of D) defLoss[id] = n * defFrac;
    for (const q of groups) { const O = q.a > 0 ? q.d / q.a : Infinity; attLoss[q.id] = q.n * Math.min(1, ord.attacker * (win ? O : Math.sqrt(O))); }
  }
  return { win, x, w, groups, attLoss, defLoss, defFrac, trapped: g, perUnitDef, A, D };
}

