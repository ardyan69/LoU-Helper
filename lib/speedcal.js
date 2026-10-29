// Automatic travel-speed calibration from the troop movements read from the game.
// Game rule: travel ms = distance (fields, Euclidean) × slowest unit's minutes/field × 60 000 ÷ world speed.
// Armies with ships travel at the ships' speed. One factor (= 1 / world speed, incl. any speed bonus)
// therefore converts every unit's base minutes/field into the real value.
import { unitById } from './cheatsheet.js';

export function sampleFactor(a) {
  if (!a || a.trade || !a.departAt || !a.arriveAt || !a.units) return null;
  const dist = Math.hypot((a.toX ?? 0) - (a.fromX ?? 0), (a.toY ?? 0) - (a.fromY ?? 0));
  const dur = a.arriveAt - a.departAt;
  if (!(dist > 0.5) || !(dur > 0)) return null;
  const us = Object.entries(a.units).filter(([id, n]) => n > 0 && unitById(id)).map(([id]) => unitById(id));
  if (!us.length) return null;
  const ships = us.filter((u) => u.naval);
  const base = Math.max(...(ships.length ? ships : us).map((u) => u.spd || 0));
  if (!(base > 0)) return null;
  return dur / 60000 / dist / base;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Merge new samples into the stored calibration; returns the new calibration object or null if unchanged.
export function updateCalibration(cal, armies, now = Date.now()) {
  const samples = { ...(cal?.samples || {}) };
  let added = 0;
  for (const a of armies || []) {
    const f = sampleFactor(a);
    if (f == null || samples[a.id]?.f === f) continue;
    samples[a.id] = { f, at: now };
    added++;
  }
  if (!added) return null;
  const keep = Object.entries(samples).sort((x, y) => y[1].at - x[1].at).slice(0, 40);
  const fs = keep.map(([, s]) => s.f);
  return { samples: Object.fromEntries(keep), factor: +median(fs).toFixed(4), n: fs.length, at: now };
}

// Apply a factor to the unit settings (only units known from the game data).
export function applyFactor(units, factor) {
  let changed = false;
  const out = units.map((u) => {
    const g = unitById(u.id === 'xbow' ? 'crossbowman' : u.id);
    if (!g || !g.spd) return u;
    const mpf = +(g.spd * factor).toFixed(2);
    if (Math.abs((u.minPerField || 0) - mpf) < 0.005) return u;
    changed = true;
    return { ...u, minPerField: mpf };
  });
  return changed ? out : null;
}
