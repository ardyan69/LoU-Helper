// History & logs kept by the background worker (pure helpers; storage handled by the caller).
import { dungeonLevel } from './cheatsheet.js';
import { projected, RES } from './shared.js';

const RES5 = ['wood', 'stone', 'iron', 'food', 'gold'];
export const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---- hourly city snapshots: [t, score, troops, wood/h, stone/h, iron/h, food/h, gold/h, stock total] ----
export const HIST_MAX = 24 * 60; // 60 days of hourly points
export function snapshotCities(hist, cities, now = Date.now()) {
  const h = { ...(hist || {}) };
  for (const c of Object.values(cities || {})) {
    if (!c.key || !c.res) continue;
    const rows = h[c.key] ? [...h[c.key]] : [];
    const last = rows[rows.length - 1];
    if (last && now - last[0] < 50 * 60000) continue; // at most one point per ~hour
    const rate = (r) => Math.round(c.res[r]?.rate || 0);
    const stock = RES.reduce((a, r) => a + projected(c.res[r], c.seenAt, now), 0);
    rows.push([now, c.score ?? null, c.troops ?? c.troopsHome ?? null, ...RES5.map(rate), Math.round(stock)]);
    h[c.key] = rows.slice(-HIST_MAX);
  }
  return h;
}

// ---- loot from raids: counted once per returning army ----
// returns { log, gains } updates or null
export function trackLoot(lootLog, gains, dungeons, mv, now = Date.now()) {
  const log = { days: { ...(lootLog?.days || {}) }, seen: { ...(lootLog?.seen || {}) }, byCity: { ...(lootLog?.byCity || {}) } };
  const g = { ...(gains || {}) };
  const off = mv?.serverOffset || 0;
  let changed = false;
  for (const a of mv?.armies || []) {
    if (a.trade || !/return/i.test(a.order || '') || log.seen[a.id]) continue;
    const carry = a.carry || {};
    const total = RES5.reduce((s, r) => s + (carry[r] || 0), 0);
    if (!total) continue;
    log.seen[a.id] = now;
    const day = dayKey((a.arriveAt || now) - off);
    const d = log.days[day] = { ...(log.days[day] || { raids: 0 }) };
    for (const r of RES5) d[r] = (d[r] || 0) + (carry[r] || 0);
    d.raids++;
    const city = a.home?.name || '?';
    const bc = log.byCity[city] = { ...(log.byCity[city] || { raids: 0 }) };
    for (const r of RES5) bc[r] = (bc[r] || 0) + (carry[r] || 0);
    bc.raids++;
    // explored % gained at that dungeon: 2.5 × carried ÷ max loot (game rule)
    const key = `${a.fromX}:${a.fromY}`, dg = dungeons?.[key];
    if (dg && dg.kind !== 'boss' && dg.level) {
      const kind = String(dg.type || '').toLowerCase();
      const res4 = RES.reduce((s, r) => s + (carry[r] || 0), 0);
      try {
        const max = dungeonLevel(kind, dg.level, dg.explored || 0).loot;
        const delta = Math.round(Math.min(2.5, 2.5 * res4 / max) * 100) / 100;
        g[key] = [...(g[key] || []), { id: a.id, at: (a.departAt || now) - off, delta }].slice(-60);
      } catch (_) { /* unknown dungeon type */ }
    }
    changed = true;
  }
  // forget old army ids and very old days
  for (const [id, t] of Object.entries(log.seen)) if (now - t > 4 * 864e5) { delete log.seen[id]; changed = true; }
  const days = Object.keys(log.days).sort();
  while (days.length > 120) { delete log.days[days.shift()]; changed = true; }
  return changed ? { log, gains: g } : null;
}

// estimated explored % = last value seen on the map + raids that left after that
export function exploredEst(d, gains) {
  const base = d.explored ?? 0;
  const add = (gains || []).filter((x) => x.at > (d.seenAt || 0)).reduce((s, x) => s + x.delta, 0);
  return Math.min(100, Math.round((base + add) * 10) / 10);
}

// ---- incoming attacks log ----
export function logIncoming(log, mv, now = Date.now()) {
  const list = [...(log || [])];
  const ids = new Set(list.map((x) => x.id));
  const off = mv?.serverOffset || 0;
  let changed = false;
  for (const a of mv?.incoming || []) {
    if (!a.id || ids.has(a.id)) continue;
    list.push({ id: a.id, owner: a.owner || a.src?.owner || null, tag: a.src?.tag || null, order: a.order || null, fromX: a.fromX, fromY: a.fromY,
      src: a.src?.name || null, target: a.target?.name || null, toX: a.toX, toY: a.toY, units: a.units || null, arriveAt: a.arriveAt ? a.arriveAt - off : null, seenAt: now });
    changed = true;
  }
  return changed ? list.slice(-500) : null;
}
