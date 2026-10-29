// Production per hour and capacity of a city computed the way the game does it (computeCityStats):
// buildings of the synced in-game layout (adjacency, Cottages, processing, Town Hall 300 wood) × account
// production research − food upkeep of the troops at home. Used to fill in cities whose resource panel
// was never opened in the game (the game's store has stock values but no rates).
import { cityStats } from './city.js';
import { prodFactors } from './research.js';
import { upkeepPerHour } from './food.js';

const RES = ['wood', 'stone', 'iron', 'food'];
export function liveLayout(state, key) {
  return (state.layouts || []).find((l) => l.source === 'game' && l.cityKey === key && l.live) || (state.layouts || []).find((l) => l.source === 'game' && l.cityKey === key) || null;
}
/** → { rate: {wood,stone,iron,food}, cap: {…} } or null when the city has no synced layout */
export function calcRates(state, key) {
  const l = liveLayout(state, key);
  if (!l) return null;
  const st = cityStats(l), f = prodFactors(state);
  const [x, y] = key.split(':').map(Number);
  const home = (state.movements?.training || []).find((c) => c.x === x && c.y === y)?.units || {};
  const rate = {}, cap = {};
  for (const r of RES) { rate[r] = Math.round(st.prod[r] * f[r] * 100) / 100; cap[r] = st.store[r]; }
  rate.food = Math.round((rate.food - upkeepPerHour(home)) * 100) / 100;
  return { rate, cap };
}
/** a cities patch: computed rate & cap for every city with a synced layout ({ key: { res } }) */
export function refreshAllRates(state, now = Date.now()) {
  const out = {};
  for (const [key, c] of Object.entries(state.cities || {})) {
    const r = calcRates(state, key);
    if (!r) continue;
    if (!c.res) continue; // no stock values yet: nothing to project from
    const res = { ...c.res };
    for (const k of RES) if (res[k] && typeof res[k].v === 'number') res[k] = { ...res[k], rate: r.rate[k], cap: r.cap[k], calcAt: now };
    out[key] = { ...c, res, seenAt: c.seenAt || now };
  }
  return out;
}
