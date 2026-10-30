// 🗓️ Timeline: everything that happens in each city on one time axis — own troops (out & back), trade carts/ships
// (out, back, incoming deliveries), incoming attacks, the construction queue and the recruitment queue.
// Pure function (the view draws it). All times are local time (the game's server times minus the offset).
import { trainingTimes } from './shared.js';
import { B } from './city.js';
import { liveLayout } from './cityrates.js';

export const LANES = ['incoming', 'army', 'trade', 'build', 'recruit'];
const NAME_BY_ID = Object.fromEntries(Object.values(B).filter((b) => b?.id).map((b) => [b.id, b.n]));
export const buildingName = (id) => NAME_BY_ID[id] || String(id || '').replace(/_/g, ' ');
const ATTACK = /attack|siege|plunder|assault|scout/i;

/** → { from, to, now, rows: [{ key, name, lanes: { kind: bars[] } }] }; bar = { s, e, kind, cls, …details } */
export function buildTimeline(state, { from, to, now = Date.now() }) {
  const mv = state.movements || {};
  const off = mv.serverOffset || 0;
  const L = (t) => (t ? t - off : null); // server → local time
  const rows = new Map();
  const cities = Object.values(state.cities || {}).filter((c) => c.x != null).sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  for (const c of cities) rows.set(c.key, { key: c.key, name: c.name || c.key, lanes: Object.fromEntries(LANES.map((k) => [k, []])) });
  const at = (x, y) => rows.get(`${x}:${y}`);
  const add = (row, lane, bar) => {
    if (!row || bar.e == null || bar.e < from || (bar.s ?? bar.e) > to) return;
    row.lanes[lane].push({ ...bar, s: Math.max(from, bar.s ?? now), e: Math.min(to, bar.e), s0: bar.s, e0: bar.e });
  };

  for (const a of mv.armies || []) {
    const home = a.home && at(a.home.x, a.home.y);
    const s = L(a.departAt), e = L(a.arriveAt);
    if (a.stationed) continue;
    if (a.trade) {
      add(home, 'trade', { s, e, kind: 'trade', cls: a.order === 'return' ? 'back' : 'out', ships: !!a.tradeShips, load: a.tradeLoad || 0, target: a.target?.name || `${a.toX}:${a.toY}`, back: a.order === 'return' });
      // the delivery shows in the receiving own city too
      if (a.order !== 'return') add(at(a.toX, a.toY), 'trade', { s, e, kind: 'tradeIn', cls: 'in', ships: !!a.tradeShips, load: a.tradeLoad || 0, from: a.home?.name || `${a.fromX}:${a.fromY}` });
    } else {
      const ret = a.order === 'return';
      add(home, 'army', { s, e, kind: 'army', cls: ret ? 'back' : ATTACK.test(a.order || '') ? 'attack' : /raid/i.test(a.order || '') ? 'raid' : 'support', order: a.order, units: a.units || {}, target: ret ? a.home?.name : a.target?.name || `${a.toX}:${a.toY}`, repeat: !!a.repeat });
    }
  }
  for (const a of mv.incoming || []) add(at(a.toX, a.toY), 'incoming', { s: L(a.departAt), e: L(a.arriveAt), kind: 'incoming', cls: 'enemy', owner: a.owner, order: a.order, units: a.units, from: a.src?.name || `${a.fromX}:${a.fromY}` });
  for (const tr of mv.incomingTrades || []) {
    const e = L(tr.arriveAt || tr.endsAt || tr.at);
    if (tr.toX != null) add(at(tr.toX, tr.toY), 'trade', { s: L(tr.departAt) ?? e, e, kind: 'tradeIn', cls: 'in', load: tr.load || tr.tradeLoad || tr.amount || 0, from: tr.fromName || tr.senderName || tr.ownerName || '?' });
  }
  // construction queue (synced in-game layout): running orders have an end, waiting ones follow one after another
  for (const row of rows.values()) {
    const l = liveLayout(state, row.key);
    const q = l?.queue || [];
    let tEnd = null;
    for (const o of q.filter((x) => x.endAt)) {
      const e = L(o.endAt);
      add(row, 'build', { s: e - (o.durationMs || 0), e, kind: 'build', cls: o.kind === 'demolish' ? 'demolish' : 'build', type: o.type, toLevel: o.toLevel, demolish: o.kind === 'demolish' });
      tEnd = Math.max(tEnd || 0, e);
    }
    let t = tEnd ?? now;
    for (const o of q.filter((x) => !x.endAt)) {
      const e = t + (o.durationMs || 0);
      add(row, 'build', { s: t, e, kind: 'build', cls: 'wait', type: o.type, toLevel: o.toLevel, waiting: true, demolish: o.kind === 'demolish' });
      t = e;
    }
  }
  for (const c of mv.training || []) {
    const row = at(c.x, c.y);
    for (const it of trainingTimes(c.queue, now + off)) add(row, 'recruit', { s: L(it.start), e: L(it.end), kind: 'recruit', cls: it.active ? 'recruit' : 'wait', unit: it.unit, count: it.count, done: it.done });
  }
  return { from, to, now, rows: [...rows.values()] };
}
