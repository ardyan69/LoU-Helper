// Total cost to have every building of a plan at its planned level — from an empty city, or from the city as it
// is in the game (same building on the same tile counts from its current level). Base build time (no Cottage /
// research speed). Demolishing nodes or other buildings is free in the game and not counted.
import { N, TOWNHALL, isBuilding } from './city.js';
import { BY_CODE, levelCost } from './gamedata.js';
import { tradeCap } from './templates.js';
import { CART_CAP, SHIP_CAP } from './gamedata.js';

const lvl = (p, i) => Math.min(10, Math.max(1, p?.levels?.[i] || 10));
export const RES5 = ['wood', 'stone', 'iron', 'food', 'gold'];

/** → { cost: {wood,stone,iron,food,gold}, total, time, orders } */
export function planCost(plan, base = null) {
  const cost = Object.fromEntries(RES5.map((r) => [r, 0]));
  let time = 0, orders = 0;
  for (let i = 0; i < N * N; i++) {
    const code = i === TOWNHALL ? 'T' : plan.cells[i];
    const b = BY_CODE[code];
    if (!b || (i !== TOWNHALL && !isBuilding(code))) continue;
    const to = lvl(plan, i);
    // a new city starts with Town Hall level 1
    let from = i === TOWNHALL ? 1 : 0;
    if (base && (i === TOWNHALL || base.cells[i] === code)) from = Math.max(from, base.levels?.[i] || 0);
    if (to <= from) continue;
    const c = levelCost(b, from, to);
    for (const r of RES5) cost[r] += c.cost[r] || 0;
    time += c.time;
    orders += to - from;
  }
  return { cost, total: RES5.reduce((s, r) => s + cost[r], 0), time, orders };
}

// trade capacity of a plan: carts (Marketplace) and ships (Harbor), and what they carry at once
export function tradeInfo(plan) {
  const { carts, ships } = tradeCap(plan);
  return { carts, ships, cartLoad: carts * CART_CAP, shipLoad: ships * SHIP_CAP };
}
