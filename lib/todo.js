// ✅ "What should I do now?" — one list over all cities, most urgent first. Pure function: the view adds texts.
// Each item: { id, sev: 0 critical | 1 high | 2 medium | 3 low, kind, key?, city?, at?, n?, res?, go }
// `id` is stable, so an item can be snoozed (settings in storage `todoSnooze`: { id: until }).
import { RES, fullAt, emptyAt, projected, trainingTimes } from './shared.js';
import { withEstimates, liveLayout } from './cityrates.js';
import { exploredEst } from './history.js';

const H = 3.6e6;
const MIL = new Set(['B', 'K', 'G', 'E', 'J', 'Z', 'Y', 'V', 'X']); // buildings that recruit
export const IDLE_TROOPS_MIN = 200; // units at home before "troops idle" is worth a line

export function buildTodos(state, now = Date.now()) {
  const out = [];
  const mv = state.movements || {};
  const off = mv.serverOffset || 0; // movement times are server time
  const pct = state.settings?.alerts?.fullThreshold ?? 95;
  const cities = Object.values(state.cities || {}).map((c) => withEstimates(state, c));
  const byXY = new Map(cities.map((c) => [`${c.x}:${c.y}`, c]));
  const keyOf = (l, x, y) => (l && l.x != null ? `${l.x}:${l.y}` : `${x}:${y}`);

  // incoming attacks: one item per target city, at the first arrival
  const inc = new Map();
  for (const a of mv.incoming || []) {
    const at = (a.arriveAt || 0) - off;
    if (at && at < now) continue;
    const k = keyOf(a.target, a.toX, a.toY);
    const cur = inc.get(k) || { n: 0, at: Infinity };
    cur.n++; cur.at = Math.min(cur.at, at || Infinity);
    inc.set(k, cur);
  }
  for (const [k, v] of inc) out.push({ id: `incoming|${k}`, sev: 0, kind: 'incoming', key: k, city: byXY.get(k)?.name || k, n: v.n, at: v.at, go: 'operasi' });

  const out2 = new Set(); // cities with own troops on the move
  for (const a of mv.armies || []) if (!a.trade && a.home) out2.add(keyOf(a.home));
  const raided = new Set((mv.armies || []).filter((a) => !a.trade && /raid/i.test(a.order || '')).map((a) => `${a.toX}:${a.toY}`));
  const training = new Map((mv.training || []).map((c) => [`${c.x}:${c.y}`, c]));

  for (const c of cities) {
    const k = c.key, name = c.name || k, go = `kota/${k}`;
    // food running out
    const e = c.res ? emptyAt(c.res.food, c.seenAt) : null;
    if (e && e - now < 12 * H) out.push({ id: `food|${k}`, sev: e - now < 2 * H ? 0 : 1, kind: 'food', key: k, city: name, at: e, go });
    // warehouse full / filling up (earliest resource)
    let full = null;
    if (c.res) for (const r of RES) {
      const x = c.res[r];
      if (!x?.cap) continue;
      const v = projected(x, c.seenAt, now);
      const at = v >= (x.cap * pct) / 100 ? now : fullAt(x, c.seenAt, pct);
      if (at && at - now < 2 * H && (!full || at < full.at)) full = { r, at };
    }
    if (full) out.push({ id: `full|${k}`, sev: full.at <= now ? 1 : 2, kind: 'full', key: k, city: name, res: full.r, at: full.at, go });
    // construction queue
    const q = c.queue;
    if (q && q.count === 0) out.push({ id: `queue|${k}`, sev: 1, kind: 'queue', key: k, city: name, go });
    else if (q?.endsAt && q.endsAt > now && q.endsAt - now < 30 * 60000) out.push({ id: `queueSoon|${k}`, sev: 2, kind: 'queueSoon', key: k, city: name, at: q.endsAt, go });
    // recruitment queue empty in a city that can recruit
    const l = liveLayout(state, k);
    const tr = training.get(k);
    if (tr && l && [...l.cells].some((x) => MIL.has(x))) {
      const items = trainingTimes(tr.queue, now + off);
      if (!items.length) out.push({ id: `recruit|${k}`, sev: 2, kind: 'recruit', key: k, city: name, go: 'gerak' });
    }
    // troops at home doing nothing (no army of this city on the move, no attack coming)
    const home = Object.values(tr?.units || {}).reduce((s, n) => s + (n || 0), 0);
    if (home >= IDLE_TROOPS_MIN && !out2.has(k) && !inc.has(k)) out.push({ id: `idle|${k}`, sev: 3, kind: 'idle', key: k, city: name, n: home, go: `dungeon` });
  }

  // dungeons being raided that are almost fully explored
  for (const d of Object.values(state.dungeons || {})) {
    if (!raided.has(d.key) || d.kind === 'boss') continue;
    const ex = exploredEst(d, state.dungeonGains?.[d.key]);
    if (ex >= 90) out.push({ id: `dungeon|${d.key}`, sev: 3, kind: 'dungeon', key: d.key, n: ex, type: d.type, level: d.level, go: `dungeon/${d.key}` });
  }

  // snoozed items are left out until their time is up
  const snooze = state.todoSnooze || {};
  return out.filter((x) => !(snooze[x.id] > now)).sort((a, b) => a.sev - b.sev || (a.at ?? Infinity) - (b.at ?? Infinity) || String(a.city || '').localeCompare(String(b.city || '')));
}
