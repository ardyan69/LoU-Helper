// 📈 Player activity: total score of every player seen on the map, kept over time (a point only when it changes,
// or once a day), so the Players tab can show growth and who seems inactive.
// history: { [player]: [[t, score, cities], …] }  (oldest first)
export const KEEP_POINTS = 60;
export const KEEP_DAYS = 90;
const D = 864e5;

export function playerTotals(players) {
  const out = {};
  for (const [name, p] of Object.entries(players || {})) {
    const cs = Object.values(p?.cities || {});
    const scored = cs.filter((c) => typeof c?.score === 'number');
    if (!scored.length) continue;
    out[name] = { score: scored.reduce((s, c) => s + c.score, 0), cities: cs.length, seenAt: Math.max(0, ...cs.map((c) => c.seenAt || 0), p.seenAt || 0) };
  }
  return out;
}

// add today's totals; returns the new history, or null when nothing changed
export function recordScores(history, players, now = Date.now()) {
  const h = { ...(history || {}) };
  let changed = false;
  for (const [name, x] of Object.entries(playerTotals(players))) {
    const pts = h[name] ? [...h[name]] : [];
    const last = pts[pts.length - 1];
    // only what was really observed: the newest sighting of this player's cities
    const t = Math.min(now, x.seenAt || now);
    if (last && last[1] === x.score && last[2] === x.cities && t - last[0] < D) continue;
    if (last && t <= last[0]) {
      if (last[1] === x.score && last[2] === x.cities) continue;
      pts[pts.length - 1] = [last[0], x.score, x.cities]; // same moment, corrected value
    } else pts.push([t, x.score, x.cities]);
    h[name] = pts.filter((p) => p[0] >= now - KEEP_DAYS * D).slice(-KEEP_POINTS);
    changed = true;
  }
  // forget histories of players no longer known
  for (const name of Object.keys(h)) if (!players?.[name]) { delete h[name]; changed = true; }
  return changed ? h : null;
}

/**
 * Activity from a player's points.
 * status: 'active' (score changed in the last 2 days) · 'inactive' (no change although seen over ≥ 3 days) · 'unknown'
 */
export function activity(points, now = Date.now()) {
  if (!points?.length) return { status: 'unknown', score: null, delta7: null, perDay: null, lastChange: null, span: 0 };
  const last = points[points.length - 1];
  let lastChange = null;
  for (let i = points.length - 1; i > 0; i--) if (points[i][1] !== points[i - 1][1]) { lastChange = points[i][0]; break; }
  const first = points[0];
  const span = last[0] - first[0];
  // value about 7 days ago: the newest point at or before then, else the oldest
  const ref = [...points].reverse().find((p) => p[0] <= now - 7 * D) || first;
  const days = Math.max((last[0] - ref[0]) / D, 0);
  const delta7 = ref === last ? null : last[1] - ref[1];
  const perDay = days >= 0.5 && delta7 != null ? delta7 / days : null;
  let status = 'unknown';
  if (lastChange && now - lastChange < 2 * D) status = 'active';
  else if (span >= 3 * D && (!lastChange || last[0] - lastChange >= 3 * D)) status = 'inactive';
  return { status, score: last[1], delta7, perDay, lastChange, span };
}
