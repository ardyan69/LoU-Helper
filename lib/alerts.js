// Desktop alert planning (pure helpers; storage, alarms and notifications are handled by background.js).
//
// One chrome alarm ("next") is set to the earliest pending event instead of one alarm per city × resource:
// browsers cap the number of alarms (Chrome: 500), which a big account (~80+ cities) would exceed.
// Events that fall due together are grouped into one notification per city, or one summary notification.
import { RES, fullAt, emptyAt, trainingTimes } from './shared.js';

export const MIN_AHEAD = 30 * 1000; // events closer than this are not scheduled (the alarm could not fire in time)
export const DUE_WINDOW = 60 * 1000; // events due within this window fire together
export const MAX_SINGLE = 3; // more notifications of one kind than this → one summary notification

// every upcoming event: { name, kind, key, res?, when }  (name is unique and stable per event)
export function computeEvents({ cities, settings, movements: mv }, now = Date.now()) {
  const a = settings.alerts;
  const out = [];
  const add = (name, kind, key, when, res) => { if (when && when > now + MIN_AHEAD) out.push({ name, kind, key, when, ...(res ? { res } : {}) }); };
  for (const c of Object.values(cities || {})) {
    if (!c.res || !c.seenAt) continue;
    if (a.full) for (const r of RES) add(`full|${c.key}|${r}`, 'full', c.key, fullAt(c.res[r], c.seenAt, a.fullThreshold), r);
    if (a.foodEmpty) add(`empty|${c.key}|food`, 'empty', c.key, emptyAt(c.res.food, c.seenAt));
    if (a.queue && c.queue?.endsAt) add(`queue|${c.key}`, 'queue', c.key, c.queue.endsAt);
  }
  if (mv) {
    const off = mv.serverOffset || 0; // server time = local time + offset
    if (a.training) for (const c of mv.training || []) {
      const items = trainingTimes(c.queue, now + off);
      const last = items[items.length - 1];
      if (last) add(`train|${c.id}`, 'train', String(c.id), last.end - off);
    }
    if (a.trade) for (const t of mv.armies || []) {
      if (t.trade && t.order !== 'return' && t.arriveAt) add(`trade|${t.id}`, 'trade', String(t.id), t.arriveAt - off);
    }
  }
  return out.sort((x, y) => x.when - y.when);
}

// drop events that already fired (the coalescing window fires some events up to DUE_WINDOW early,
// so recomputing right after would schedule them again)
export function notFired(events, fired) {
  return events.filter((e) => !(fired?.[e.name] && Math.abs(fired[e.name] - e.when) < 2 * DUE_WINDOW));
}

// split a plan into events due now (incl. the next DUE_WINDOW) and the rest
export function splitDue(plan, now = Date.now()) {
  const due = [], rest = [];
  for (const e of plan || []) (e.when <= now + DUE_WINDOW ? due : rest).push(e);
  return { due, rest };
}

// group due events: full → per city with its resources; others → list of keys (one entry per city/army)
export function groupDue(due) {
  const g = { full: new Map(), empty: [], queue: [], train: [], trade: [] };
  for (const e of due) {
    if (e.kind === 'full') (g.full.get(e.key) || g.full.set(e.key, []).get(e.key)).push(e.res);
    else if (g[e.kind] && !g[e.kind].includes(e.key)) g[e.kind].push(e.key);
  }
  return g;
}

// ---- incoming attacks: one notification per (target city, attacker), updated as more waves show up ----
export const INCOMING_GROUP_MS = 15 * 60 * 1000; // new waves within this time join the same notification

// state: { seen: { armyId: firstSeenAt }, groups: { gid: { target, owner, waves: [{ id, order, from, arriveAt }], updatedAt } } }
// returns { state, changed: [gid…] }  — changed groups need their notification (re)shown
export function groupIncoming(state, list, now = Date.now()) {
  const seen = { ...(state?.seen || {}) };
  const groups = {};
  for (const [gid, gr] of Object.entries(state?.groups || {})) if (now - gr.updatedAt < 6 * 3.6e6) groups[gid] = gr;
  for (const k of Object.keys(seen)) if (seen[k] < now - 864e5) delete seen[k];
  const changed = new Set();
  for (const a of list || []) {
    if (!a?.id || seen[a.id]) continue;
    seen[a.id] = now;
    const base = `${a.toX}:${a.toY}|${a.owner || '?'}`;
    // the open group for this target & attacker, else a new one (a later, separate attack gets its own)
    let gid = Object.keys(groups).find((k) => groups[k].base === base && now - groups[k].updatedAt < INCOMING_GROUP_MS);
    if (!gid) gid = `${base}|${now}`;
    const gr = groups[gid] || (groups[gid] = { base, target: a.target?.name || null, toX: a.toX, toY: a.toY, owner: a.owner || null, waves: [], updatedAt: now });
    gr.waves = [...gr.waves, { id: a.id, order: a.order || 'attack', from: `${a.fromX}:${a.fromY}`, arriveAt: a.arriveAt || null, guess: a.guess || null }];
    gr.updatedAt = now;
    changed.add(gid);
  }
  return { state: { seen, groups }, changed: [...changed] };
}

// short summaries for a group's notification text
export function summarizeWaves(waves) {
  const orders = {};
  for (const w of waves) orders[w.order] = (orders[w.order] || 0) + 1;
  const from = [...new Set(waves.map((w) => w.from))];
  const times = waves.map((w) => w.arriveAt).filter(Boolean).sort((a, b) => a - b);
  return {
    orders: Object.entries(orders).map(([o, n]) => (n > 1 ? `${o} ×${n}` : o)).join(', '),
    from: from.length > 3 ? `${from.slice(0, 3).join(', ')}…` : from.join(', '),
    first: times[0] || null,
    last: times[times.length - 1] || null
  };
}
