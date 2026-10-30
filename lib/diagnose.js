// 🩺 Diagnostics: turns what the game tab reports (content script + page hook) and what is stored into one
// status per data source. Pure function (texts are added by views/diag.js), tested in tests/game-dom.test.mjs.
//
// status: 'ok' | 'warn' | 'bad' | 'idle' (optional source not used yet — not a problem)
export const SOURCES = ['hook', 'shape', 'cities', 'movements', 'layouts', 'map', 'resourceBar', 'queuePanel', 'cityList', 'dungeonPanel', 'icons', 'storage', 'errors'];

/** @param {{ tab: any, stored?: { cities?: object, movements?: any, layouts?: any[], gameIcons?: object }, now?: number }} input */
export function diagnose({ tab, stored = {}, now = Date.now() }) {
  const rows = [];
  const row = (id, status, at = null, detail = null) => rows.push({ id, status, at, detail });
  const icons = Object.keys(stored.gameIcons || {}).length;

  if (!tab) {
    // no game tab: only what was saved
    const cities = Object.values(stored.cities || {});
    const lastCity = Math.max(0, ...cities.map((c) => Math.max(c.syncedAt || 0, c.seenAt || 0)));
    const lastLayout = Math.max(0, ...(stored.layouts || []).filter((l) => l.source === 'game').map((l) => l.capturedAt || 0));
    row('hook', 'bad', null, 'no-tab');
    row('cities', cities.length ? 'idle' : 'bad', lastCity || null, cities.length ? { cities: cities.length } : 'never');
    row('movements', stored.movements?.at ? 'idle' : 'bad', stored.movements?.at || null);
    row('layouts', lastLayout ? 'idle' : 'bad', lastLayout || null);
    row('icons', icons >= 28 ? 'ok' : icons ? 'warn' : 'idle', null, { n: icons });
    return rows;
  }

  const h = tab.hook, d = tab.diag || {}, msgs = d.msgs || {}, rd = d.readers || {};
  // page hook: reads the game state
  if (!h) row('hook', 'bad', null, 'no-answer');
  else if (h.via === 'store') row('hook', 'ok', h.lastSnapAt, { v: h.v, mutable: !!h.mutable });
  else if (h.via === 'city-view') row('hook', 'warn', h.lastSnapAt, 'city-view');
  else row('hook', 'bad', h.lastSnapAt, h.foundAt ? 'lost' : 'not-found');
  // game state shape
  if (!h || h.via !== 'store') row('shape', 'idle');
  else if (h.shape?.length) row('shape', 'bad', null, { missing: h.shape });
  else row('shape', 'ok');
  // data from the game state
  const msg = (id, kind, optional) => {
    const m = msgs[kind];
    if (m?.n) row(id, 'ok', m.at, { n: m.n });
    else row(id, optional || !h || h.via !== 'store' ? 'idle' : 'bad', null, 'never');
  };
  msg('cities', 'cities-store');
  msg('movements', 'movements');
  msg('layouts', 'city-state');
  const mapAt = Math.max(msgs['map-dungeons']?.at || 0, msgs['map-cities']?.at || 0);
  row('map', mapAt ? 'ok' : 'idle', mapAt || null, mapAt ? { dungeons: tab.knownDungeons || 0 } : 'open-region');

  // page readers
  const reader = (id, optional) => {
    const r = rd[id] || {};
    if (r.okAt && !(r.failAt > r.okAt)) row(id, 'ok', r.okAt, r.note || null);
    else if (r.failAt && !optional) row(id, r.okAt ? 'warn' : 'bad', r.okAt || null, 'unreadable');
    else row(id, 'idle', r.okAt || null, 'not-opened');
  };
  if ((rd.cityChip || {}).okAt) reader('resourceBar');
  else row('resourceBar', 'idle', null, 'no-city-view');
  reader('queuePanel', true);
  reader('cityList', true);
  reader('dungeonPanel', true);
  // icons are captured in any game language (the game's own icon keys); missing ones just were not shown yet
  row('icons', icons >= 28 ? 'ok' : 'idle', null, { n: icons });

  // saving & errors
  const st = d.storage || {};
  if (st.errAt && !(st.okAt > st.errAt)) row('storage', 'bad', st.errAt, { err: st.err });
  else row('storage', st.okAt ? 'ok' : 'idle', st.okAt || null);
  const errs = [h?.lastError && `page: ${h.lastError}`, d.error?.msg && `content: ${d.error.msg}`].filter(Boolean);
  row('errors', errs.length ? 'warn' : 'ok', d.error?.at || null, errs.length ? { list: errs } : null);
  return rows;
}

// overall verdict: worst status of the rows that matter
export function verdict(rows) {
  if (rows.some((r) => r.status === 'bad')) return 'bad';
  if (rows.some((r) => r.status === 'warn')) return 'warn';
  return 'ok';
}
