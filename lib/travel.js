// Army travel in Revival (game rules + this extension's speed calibration):
// - travel time = distance (fields, Euclidean) × minutes/field of the slowest unit × 60,000 ms;
//   minutes/field is calibrated from your own armies (Settings → Units), which already includes the world speed
// - an army with ships moves at the ships' speed; land troops cannot leave their continent without ships:
//   each Frigate carries 500 troop space of land units
// - continents are 100 × 100 fields, numbered row × 10 + column (C00 … C55)
import { unitById } from './cheatsheet.js';

export const FRIGATE_SPACE = 500;
export const continentOf = (x, y) => Math.floor(y / 100) * 10 + Math.floor(x / 100);
export const fieldDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function parseCoord(s) {
  const m = /(\d{1,3})\s*[:|,;/ ]\s*(\d{1,3})/.exec(String(s || ''));
  return m ? { x: +m[1], y: +m[2] } : null;
}

// minutes per field of one unit type: calibrated value from Settings, else game base × calibration factor
export function minPerField(state, id) {
  const s = (state?.settings?.units || []).find((u) => u.id === id || (id === 'crossbowman' && u.id === 'xbow'));
  if (s?.minPerField > 0) return s.minPerField;
  const u = unitById(id);
  if (!u?.spd) return 0;
  const f = state?.speedCal?.factor || 1 / (state?.movements?.worldSpeed || 1);
  return u.spd * f;
}

/** { ok, ms, mpf, dist, slow, reason?: 'empty'|'continent'|'frigate'|'immobile', need? } */
export function armyTravel(state, from, to, units) {
  const list = Object.entries(units || {}).filter(([id, n]) => n > 0 && unitById(id));
  if (!list.length) return { ok: false, reason: 'empty' };
  const immobile = list.filter(([id]) => !(unitById(id).spd > 0));
  if (immobile.length) return { ok: false, reason: 'immobile', unit: immobile[0][0] };
  const dist = fieldDist(from, to);
  const ships = list.filter(([id]) => unitById(id).naval), land = list.filter(([id]) => !unitById(id).naval);
  if (ships.length) {
    const space = land.reduce((a, [id, n]) => a + n * unitById(id).space, 0);
    const cap = (units.frigate || 0) * FRIGATE_SPACE;
    if (space > cap) return { ok: false, reason: 'frigate', need: Math.ceil(space / FRIGATE_SPACE), dist };
  } else if (continentOf(from.x, from.y) !== continentOf(to.x, to.y)) return { ok: false, reason: 'continent', dist };
  let mpf = 0, slow = null;
  for (const [id] of ships.length ? ships : land) { const m = minPerField(state, id); if (m > mpf) { mpf = m; slow = id; } }
  return { ok: true, ms: dist * mpf * 60000, mpf, dist, slow };
}
