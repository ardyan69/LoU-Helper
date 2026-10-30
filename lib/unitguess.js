// 🔎 Which units are in an incoming army whose troops are hidden? An army moves at the speed of its slowest
// unit, so its minutes per field (travel time ÷ distance) points to a unit class:
//   Baron 40 · siege (Ram, Ballista, Catapult) 30 · infantry & Mage 20 · cavalry & Warlock 10 · Scout 8 · ships 5
// (base minutes per field from the game data, × this world's speed factor). Speed bonuses of the attacker only
// make an army faster, so a class fits when the army is at most as slow as the class and not implausibly faster.
import { REV_UNITS } from './cheatsheet.js';
import { continentOf, fieldDist } from './travel.js';

export const MAX_BONUS = 1.0; // up to +100% speed (research, artifacts…) is considered possible
const TOLERANCE = 0.04; // rounding of the game's times

// unit classes by base speed (minutes per field), slowest first
export const SPEED_CLASSES = (() => {
  const by = new Map();
  for (const u of REV_UNITS) if (u.spd > 0) (by.get(u.spd) || by.set(u.spd, []).get(u.spd)).push(u);
  return [...by.entries()].sort((a, b) => b[0] - a[0]).map(([spd, units]) => ({ spd, naval: units.every((u) => u.naval), units: units.map((u) => u.id), names: units.map((u) => u.name) }));
})();

/**
 * @param {{ fromX: number, fromY: number, toX: number, toY: number, departAt?: number, arriveAt?: number }} a
 * @param {number} [factor] minutes multiplier of this world (speed calibration factor, or 1 / world speed)
 * @returns {null | { mpf: number, dist: number, water: boolean, best: { spd: number, units: string[], names: string[], bonus: number }, alts: any[] }}
 */
export function guessUnits(a, factor = 1) {
  if (!a?.departAt || !a?.arriveAt || a.arriveAt <= a.departAt) return null;
  const dist = fieldDist({ x: a.fromX, y: a.fromY }, { x: a.toX, y: a.toY });
  if (!(dist > 0)) return null;
  const mpf = (a.arriveAt - a.departAt) / 60000 / dist;
  const water = continentOf(a.fromX, a.fromY) !== continentOf(a.toX, a.toY); // only ships cross the sea
  const fits = [];
  for (const c of SPEED_CLASSES) {
    if (water && !c.naval) continue;
    const base = c.spd * factor;
    const ratio = mpf / base; // 1 = no bonus, 0.5 = +100% speed
    if (ratio > 1 + TOLERANCE || ratio < 1 / (1 + MAX_BONUS) - TOLERANCE) continue;
    fits.push({ spd: c.spd, units: c.units, names: c.names, bonus: Math.max(0, Math.round((1 / ratio - 1) * 100)) });
  }
  if (!fits.length) return { mpf, dist, water, best: null, alts: [] };
  // the smallest needed speed bonus is the most likely
  fits.sort((x, y) => x.bonus - y.bonus);
  return { mpf, dist, water, best: fits[0], alts: fits.slice(1) };
}
