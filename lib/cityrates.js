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
// A rate read from the game's resource bar (the city was open in the game) is the real one: it is kept for
// REAL_RATE_MS; an older one, or a city never opened, gets the rate computed from its layout.
export const REAL_RATE_MS = 12 * 3.6e6;
export const isRealRate = (x, now = Date.now()) => !!x && x.rate != null && !x.calcAt && !!x.rateAt && now - x.rateAt < REAL_RATE_MS;

/** a cities patch: computed rate & cap for every city with a synced layout ({ key: { res } }); real rates kept */
export function refreshAllRates(state, now = Date.now()) {
  const out = {};
  let real = 0;
  for (const [key, c] of Object.entries(state.cities || {})) {
    const r = calcRates(state, key);
    if (!r) continue;
    if (!c.res) continue; // no stock values yet: nothing to project from
    const res = { ...c.res };
    let changed = false;
    for (const k of RES) {
      if (!res[k] || typeof res[k].v !== 'number') continue;
      if (isRealRate(res[k], now)) { real++; continue; }
      res[k] = { ...res[k], rate: r.rate[k], cap: r.cap[k], calcAt: now };
      changed = true;
    }
    if (changed) out[key] = { ...c, res, seenAt: c.seenAt || now };
  }
  Object.defineProperty(out, 'realKept', { value: real, enumerable: false });
  return out;
}

// For display: a city whose resources have no rate (never opened in the game, "Refresh all" not pressed yet)
// gets the rate & capacity computed from its synced layout, marked est: true — so its stock keeps moving
// from the game's last snapshot instead of standing still. Memoized per layout version / research / troops.
const memo = new Map();
export function withEstimates(state, c) {
  if (!c?.res || RES.every((k) => !c.res[k] || c.res[k].rate != null)) return c;
  const l = liveLayout(state, c.key);
  if (!l) return c;
  const sig = `${l.id}:${l.updatedAt || l.capturedAt || 0}:${JSON.stringify(state.movements?.research || null)}`;
  let m = memo.get(c.key);
  if (!m || m.sig !== sig) { m = { sig, r: calcRates(state, c.key) }; memo.set(c.key, m); }
  if (!m.r) return c;
  const res = { ...c.res };
  for (const k of RES) if (res[k] && res[k].rate == null && typeof res[k].v === 'number') res[k] = { ...res[k], rate: m.r.rate[k], cap: res[k].cap ?? (m.r.cap[k] || undefined), est: true };
  return { ...c, res };
}
