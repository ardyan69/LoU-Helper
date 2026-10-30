// Runs in the game's page context. Passive / read-only:
//  1. When the game copies a City Planner share string, pass a copy of it to the LoU Helper content script.
//  2. Every few seconds, read the ACTIVE city (grid with building levels + build queue) that the game's
//     city view already holds in memory, and pass a snapshot to the content script when it changes.
// Nothing here sends anything to the game server or changes the game (exception: 🎩 Ministers → Apply, below).
//
// GAME STATE — what this file reads from the game's own state (language-independent). When a game update
// renames something here, 🩺 Diagnostics (dashboard → About) lists it under "Game state", see checkShape().
//   store (found through the React tree): armies, incoming, incomingTrades, cities, market.mine, player, world,
//     map (Map of entities), mapVersion, serverOffset, currentCityId
//   city: id, name, x, y, continent, water, castle, grid[441] {b, lvl}, buildQueue[] {slot, type, kind, toLevel,
//     endAt, durationMs}, res {wood…gold}, resAt, units, recruitQueue[] {unit, count, doneCount, perUnitMs, startAt},
//     wallLevel
//   army: id, order, trade, tradeLoad, units, carry, fromX/Y, toX/Y, departAt, arriveAt, homeCityId, targetId
//   map entity: id, kind (city|dungeon|boss), x, y, name, level, dungeon|boss, progress, ownerId, ownerName,
//     allianceTag, score
//   player: id, name, lang, research, ministers, ministerUntil, cityNotes[cityId].groups (city groups)
//   icons: <img> elements whose React props carry the game's icon key k = "building:<code>" (any language)
// The page's HTML is read by the content script instead: see lib/game-dom.js.
(() => {
  // versioned guard: a newer hook (after an extension update) may install next to an older one
  const HOOK_V = 11;
  if ((window.__louHelperPageHookV || 0) >= HOOK_V) return;
  window.__louHelperPageHookV = HOOK_V;
  window.__louHelperPageHook = true;
  const post = (msg) => window.postMessage({ __louHelper: msg.kind, ...msg }, location.origin);
  // 🩺 for the diagnostics page
  const status = { v: HOOK_V, via: null, lastSnapAt: null, foundAt: null, misses: 0, mutable: false, cities: 0, icons: 0, shape: [], errors: 0, lastError: null };
  const noteError = (e) => { status.errors++; status.lastError = String((e && e.message) || e).slice(0, 200); };

  // ---- 0. the game's own WebSocket (only used for 🎩 Ministers → "Apply to game", on your explicit click) ----
  // Remember the socket the game sends its messages on, so a minister setting can be sent exactly the way the
  // game's Ministers screen sends it. Nothing else is ever sent.
  const wsSend = WebSocket.prototype.__louOrigSend || WebSocket.prototype.send;
  if (!WebSocket.prototype.__louOrigSend) {
    Object.defineProperty(WebSocket.prototype, '__louOrigSend', { value: wsSend });
    WebSocket.prototype.send = function (d) {
      try { if (typeof d === 'string' && d.startsWith('{"t":')) window.dispatchEvent(new CustomEvent('lou-game-ws', { detail: this })); } catch (_) { /* never break the game */ }
      return wsSend.apply(this, arguments);
    };
  }
  let gameWs = null;
  window.addEventListener('lou-game-ws', (e) => { gameWs = e.detail; });
  const MINISTER_CMDS = new Set(['ministerCity', 'ministerTrade', 'ministerToggle']);
  // does the game's own state already hold what we sent? (the server pushes the new settings right after saving)
  const sub = (want, have) => {
    if (want === null || typeof want !== 'object') return want === have;
    if (!have || typeof have !== 'object') return false;
    if (Array.isArray(want)) return Array.isArray(have) && want.length === have.length && want.every((v, i) => sub(v, have[i]));
    return Object.keys(want).every((k) => sub(want[k], have[k]));
  };
  function applied(m) {
    try {
      const M = findStore()?.player?.ministers;
      if (!M) return false;
      if (m.t === 'ministerToggle') return !!M[m.key]?.enabled === !!m.enabled;
      if (m.t === 'ministerCity') return sub(m.config, M[m.key]?.cities?.[m.cityId]);
      if (m.t === 'ministerTrade') return Object.entries(m.settings.cities || {}).every(([id, c]) => sub(c, M.trade?.cities?.[id])) && (m.settings.minShipment == null || m.settings.minShipment === M.trade?.minShipment);
    } catch (_) { /* not readable */ }
    return false;
  }
  // one request; resolves on the server's ok/error, or as soon as the game state shows the new settings
  function sendMinister(m) {
    return new Promise((resolve) => {
      if (!m || !MINISTER_CMDS.has(m.t)) return resolve({ ok: false, error: 'not allowed' });
      const ws = gameWs;
      if (!ws || ws.readyState !== 1) return resolve({ ok: false, error: 'no-socket' });
      const reqId = 1000000000 + Math.floor(Math.random() * 900000000);
      const cid = `louhelper.${reqId}`;
      let timer = null, poll = null, finished = false;
      const onMsg = (ev) => {
        let d; try { d = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (_) { return; }
        if (!d || (d.t !== 'ok' && d.t !== 'error')) return;
        if (String(d.reqId) === String(reqId) || d.cid === cid) done({ ok: d.t === 'ok', error: d.message || null });
      };
      const done = (r) => { if (finished) return; finished = true; clearTimeout(timer); clearInterval(poll); ws.removeEventListener('message', onMsg); resolve(r); };
      timer = setTimeout(() => done(applied(m) ? { ok: true, via: 'state' } : { ok: false, error: 'timeout' }), 8000);
      poll = setInterval(() => { if (applied(m)) done({ ok: true, via: 'state' }); }, 200);
      ws.addEventListener('message', onMsg);
      try { wsSend.call(ws, JSON.stringify({ ...m, reqId, cid })); } catch (err) { done({ ok: false, error: String(err) }); }
    });
  }
  window.addEventListener('message', async (e) => {
    if (e.source !== window || !e.data || e.data.__louHelperCmd !== 'minister' || !Array.isArray(e.data.msgs)) return;
    // a newer hook version may be installed next to this one: handle each request only once
    const seen = window.__louMinisterSeen || (window.__louMinisterSeen = new Set());
    if (seen.has(e.data.id)) return;
    seen.add(e.data.id);
    // all requests at once (like the game's own client), not one after another
    const results = await Promise.all(e.data.msgs.map(sendMinister));
    post({ kind: 'minister-result', id: e.data.id, results });
    // push the fresh settings to the dashboard right away instead of waiting for the next 3-second snapshot
    setTimeout(() => { try { lastMovSig = ''; lastRefs = null; snapshot(); } catch (_) { /* ignore */ } }, 150);
  });

  // the content script asks whether a hook is running in the page (else it injects one itself)
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.__louHelperCmd === 'ping') post({ kind: 'pong', v: HOOK_V });
  });

  // ---- 1. share strings ----
  const cb = navigator.clipboard;
  if (cb && !cb.__louHelperHooked) {
    const orig = cb.writeText.bind(cb);
    cb.writeText = function (text) {
      try { if (typeof text === 'string' && text.includes('[ShareString')) post({ kind: 'share-string', text }); } catch (_) { /* never break the game */ }
      return orig(text);
    };
    Object.defineProperty(cb, '__louHelperHooked', { value: true });
  }

  // ---- 2. live city state ----
  const CODE = {
    forest: '.', stone: ':', iron: ',', lake: ';', woodcutter: '2', quarry: '3', ironmine: '4', farm: '1',
    sawmill: 'L', stonemason: 'A', foundry: 'D', mill: 'M', warehouse: 'S', cottage: 'C', hideout: 'H',
    marketplace: 'P', townhouse: 'U', barracks: 'B', cityguard_house: 'K', training_ground: 'G', stable: 'E',
    moonglow_tower: 'J', trinsic_temple: 'Z', workshop: 'Y', harbor: 'R', shipyard: 'V', castle: 'X', townhall: 'T'
  };
  const isCityRef = (v) => v && typeof v === 'object' && v.current && v.current.city && Array.isArray(v.current.city.grid) && v.current.city.grid.length === 441;
  let ref = null;
  function findRef() {
    if (isCityRef(ref)) return ref;
    ref = null;
    const rootEl = document.getElementById('root');
    if (!rootEl) return null;
    const k = Object.keys(rootEl).find((x) => x.startsWith('__reactContainer'));
    if (!k) return null;
    let f = rootEl[k];
    f = (f && f.stateNode && f.stateNode.current) || f;
    const stack = [f];
    let n = 0;
    while (stack.length && n < 4000) {
      const x = stack.pop();
      n++;
      let h = x.memoizedState, i = 0;
      while (h && typeof h === 'object' && i < 60) {
        if (isCityRef(h.memoizedState)) { ref = h.memoizedState; return ref; }
        h = h.next;
        i++;
      }
      if (x.sibling) stack.push(x.sibling);
      if (x.child) stack.push(x.child);
    }
    return null;
  }

  const lastSig = {};
  function postCity(c) {
    if (!c || !Array.isArray(c.grid) || c.grid.length !== 441) return;
    let cells = '';
    const levels = [];
    for (let i = 0; i < 441; i++) {
      const g = c.grid[i];
      cells += g && g.b ? CODE[g.b] || '?' : '-';
      levels.push((g && g.lvl) || 0);
    }
    const queue = Array.isArray(c.buildQueue)
      ? c.buildQueue.map((o) => ({ slot: o.slot, type: o.type, kind: o.kind, toLevel: o.toLevel, endAt: o.endAt || null, durationMs: o.durationMs || 0 }))
      : [];
    const sig = cells + levels.join(',') + JSON.stringify(queue.map((o) => [o.slot, o.toLevel, o.endAt]));
    if (lastSig[c.id] === sig) return false;
    lastSig[c.id] = sig;
    post({ kind: 'city-state', city: { id: c.id, name: c.name, x: c.x, y: c.y, cont: c.continent, water: !!c.water }, cells, levels, queue });
    return true;
  }

  // ---- 3. the game's main store (all cities, armies, trades, recruitment, map) ----
  const isStore = (s) => s && typeof s === 'object' && s.armies !== undefined && s.cities !== undefined && s.incoming !== undefined;
  let storeGet = null;
  function findStore() {
    if (storeGet) { try { const s = storeGet(); if (isStore(s)) return s; } catch (_) { /* re-scan */ } storeGet = null; }
    const rootEl = document.getElementById('root');
    const k = rootEl && Object.keys(rootEl).find((x) => x.startsWith('__reactContainer'));
    if (!k) return null;
    let f = rootEl[k];
    f = (f && f.stateNode && f.stateNode.current) || f;
    const stack = [f];
    let n = 0;
    while (stack.length && n < 4000) {
      const x = stack.pop();
      n++;
      let h = x.memoizedState, i = 0;
      while (h && typeof h === 'object' && i < 80) {
        const m = h.memoizedState;
        // store selector hooks keep the store's getState in their memo dependencies
        if (Array.isArray(m) && Array.isArray(m[1])) {
          for (const fn of m[1]) {
            if (typeof fn !== 'function' || fn.length !== 0) continue;
            try { if (isStore(fn())) { storeGet = fn; return fn(); } } catch (_) { /* not it */ }
          }
        }
        h = h.next;
        i++;
      }
      if (x.sibling) stack.push(x.sibling);
      if (x.child) stack.push(x.child);
    }
    return null;
  }

  const names = new Map(); // entity id -> label info (from the map / own cities)
  const atXY = new Map(); // "x:y" -> same label, to name where an attack comes from
  let lastMapVer = -1, lastMovSig = '', lastCitySig = '';
  // Cheap change detection: the game replaces a part of its state object when that part changes, so if none of
  // the parts we read was replaced since the last tick, nothing needs to be rebuilt, compared or sent.
  // Every FULL_EVERY ms (15 s) everything is checked anyway; if that finds a change although no part was replaced,
  // the game edits its state in place and the shortcut is switched off for good (`mutable`).
  const FULL_EVERY = 15000;
  let lastRefs = null, lastFull = 0, mutable = false;
  const cityRefs = new Map(); // city id -> [grid, buildQueue] seen at its last check
  const plain = (o) => { try { return JSON.parse(JSON.stringify(o)); } catch (_) { return null; } };
  // does the game state still look the way this file expects? → list of what is missing (for 🩺 Diagnostics)
  function checkShape(S) {
    const bad = [];
    const need = (ok, what) => { if (!ok) bad.push(what); };
    for (const k of ['armies', 'incoming', 'cities', 'player']) need(S[k] && typeof S[k] === 'object', `store.${k}`);
    need(S.map && typeof S.map.values === 'function', 'store.map');
    need(typeof S.serverOffset === 'number', 'store.serverOffset');
    const cities = Object.values(S.cities || {});
    need(cities.length > 0, 'store.cities (empty)');
    const c = cities[0];
    if (c) {
      need(Array.isArray(c.grid) && c.grid.length === 441, 'city.grid[441]');
      need(Array.isArray(c.grid) && c.grid.some((g) => g && 'b' in g && 'lvl' in g), 'city.grid[].b/lvl');
      need(c.res && typeof c.res.wood === 'number', 'city.res');
      need(typeof c.resAt === 'number', 'city.resAt');
      need(Array.isArray(c.buildQueue), 'city.buildQueue');
      need(c.recruitQueue == null || Array.isArray(c.recruitQueue), 'city.recruitQueue');
      need(typeof c.x === 'number' && typeof c.y === 'number', 'city.x/y');
      need(c.units && typeof c.units === 'object', 'city.units');
    }
    const a = Object.values(S.armies || {})[0];
    if (a) need(a.arriveAt != null && a.order != null, 'army.order/arriveAt');
    const P = S.player || {};
    need(typeof P.lang === 'string', 'player.lang');
    need(P.research && typeof P.research === 'object', 'player.research');
    if (S.map && typeof S.map.values === 'function') {
      let ent = 0;
      for (const e of S.map.values()) { if (ent++ > 50) break; if (e && (e.kind === 'dungeon' || e.kind === 'boss')) { need(typeof e.level === 'number' && (e.dungeon || e.boss), 'map.dungeon.level/type'); break; } }
    }
    return bad;
  }

  function snapStore() {
    const S = findStore();
    if (!S) return false;
    if (S.map && typeof S.map.values === 'function' && S.mapVersion !== lastMapVer) {
      lastMapVer = S.mapVersion;
      const dungeons = [];
      for (const e of S.map.values()) {
        if (!e || !e.id) continue;
        if (e.kind === 'city' || e.kind === 'dungeon' || e.kind === 'boss') {
          const l = { kind: e.kind, name: e.name || null, x: e.x, y: e.y, level: e.level || null, type: e.dungeon || e.boss || null, owner: e.ownerName || null, tag: e.allianceTag || null, score: e.score ?? null };
          names.set(e.id, l);
          atXY.set(`${e.x}:${e.y}`, l);
        }
        if (e.kind === 'dungeon' || e.kind === 'boss') dungeons.push({ kind: e.kind, type: e.dungeon || e.boss, level: e.level, progress: e.progress, x: e.x, y: e.y });
      }
      if (dungeons.length) post({ kind: 'map-dungeons', dungeons });
      // other players' cities on the loaded map (for the Players tab)
      const me = S.player && S.player.id;
      const others = [];
      for (const e of S.map.values()) {
        if (!e || e.kind !== 'city' || !e.ownerName || (me && e.ownerId === me)) continue;
        others.push({ x: e.x, y: e.y, name: e.name || null, owner: e.ownerName, ownerId: e.ownerId || null, tag: e.allianceTag || null, score: e.score ?? e.points ?? null, water: !!e.water, castle: !!e.castle });
      }
      if (others.length) post({ kind: 'map-cities', cities: others });
    }
    const now = Date.now();
    const periodic = mutable || now - lastFull >= FULL_EVERY;
    const refs = [S.armies, S.incoming, S.incomingTrades, S.cities, S.market, S.player, S.world, S.map, S.mapVersion];
    const sameRefs = !!lastRefs && refs.every((r, i) => r === lastRefs[i]);
    if (sameRefs && !periodic) return true;
    lastRefs = refs;
    if (periodic) { lastFull = now; status.shape = checkShape(S); }
    let posted = false;
    const cities = Object.values(S.cities || {});
    for (const c of cities) names.set(c.id, { kind: 'own', name: c.name, x: c.x, y: c.y });
    const label = (id) => (id && names.get(id)) || null;
    const armies = Object.values(S.armies || {}).map((a) => ({
      id: a.id, order: a.order, trade: !!a.trade, tradeLoad: a.tradeLoad || 0, tradeShips: !!a.tradeShips,
      units: a.units || {}, carry: a.carry || {}, fromX: a.fromX, fromY: a.fromY, toX: a.toX, toY: a.toY,
      departAt: a.departAt || null, arriveAt: a.arriveAt || null, repeat: !!a.repeat, stationed: !!a.stationed,
      home: label(a.homeCityId), target: label(a.targetId)
    }));
    const incoming = Object.values(S.incoming || {}).map((a) => ({
      id: a.id, order: a.order, owner: a.ownerName || null, units: a.units || null, fromX: a.fromX, fromY: a.fromY, toX: a.toX, toY: a.toY,
      src: atXY.get(`${a.fromX}:${a.fromY}`) || null,
      departAt: a.departAt || null, arriveAt: a.arriveAt || null, target: label(a.targetId)
    }));
    const incomingTrades = Object.values(S.incomingTrades || {}).map(plain).filter(Boolean);
    const training = cities.map((c) => ({
      id: c.id, name: c.name, x: c.x, y: c.y, units: c.units || {},
      queue: (c.recruitQueue || []).map((q) => ({ unit: q.unit, count: q.count, done: q.doneCount || 0, perUnitMs: q.perUnitMs || 0, startAt: q.startAt || null }))
    }));
    const marketMine = ((S.market && S.market.mine) || []).map(plain).filter(Boolean);
    const P = S.player || {};
    const data = { serverOffset: S.serverOffset || 0, lang: P.lang || null, player: P.name || null, research: P.research || null, ministers: P.ministers || null, ministerUntil: P.ministerUntil || null, worldSpeed: (S.world && S.world.speed) || 1, armies, incoming, incomingTrades, training, marketMine };
    const sig = JSON.stringify(data, (key, v) => (key === 'serverOffset' ? undefined : v));
    if (sig !== lastMovSig) { lastMovSig = sig; post({ kind: 'movements', data }); posted = true; }
    // towers & traps in the wall slots: { ranger_tower: [levels…], pitfall_trap: [...] }
  const WALL_SLOT = /_tower$|_trap$|^barricade$/;
  function wallSlots(c) {
    const o = {};
    for (const g of c.grid || []) if (g && g.b && g.lvl > 0 && WALL_SLOT.test(g.b) && g.b !== 'moonglow_tower') (o[g.b] = o[g.b] || []).push(g.lvl);
    return o;
  }
  // troops on the move per home city (raids, attacks, supports…), for the city's total
    const count = (u) => Object.values(u || {}).reduce((t, n) => t + (+n || 0), 0);
    const troopsOut = new Map();
    for (const a of Object.values(S.armies || {})) if (a && !a.trade && a.homeCityId) troopsOut.set(a.homeCityId, (troopsOut.get(a.homeCityId) || 0) + count(a.units));
  // language-independent city summary: resources (exact at resAt), build queue, troops at home
    const sum = cities.map((c) => {
      const q = Array.isArray(c.buildQueue) ? c.buildQueue : [];
      const first = q.find((o) => o.endAt) || null;
      let end = first ? first.endAt : null;
      if (end) for (const o of q) if (o !== first && !o.endAt) end += o.durationMs || 0;
      const me = atXY.get(`${c.x}:${c.y}`);
      return {
        id: c.id, name: c.name, x: c.x, y: c.y, cont: c.continent, water: !!c.water, castle: !!c.castle,
        score: me && me.score != null ? me.score : null, troopsTotal: (troopsOut.get(c.id) || 0) + count(c.units),
        groups: P.cityNotes && P.cityNotes[c.id] && Array.isArray(P.cityNotes[c.id].groups) ? P.cityNotes[c.id].groups.map(String) : (P.cityNotes ? [] : null),
        res: c.res ? { wood: c.res.wood, stone: c.res.stone, iron: c.res.iron, food: c.res.food, gold: c.res.gold } : null,
        resAt: c.resAt || null, queue: { count: q.length, nextAt: first ? first.endAt : null, endsAt: end },
        home: c.units || {}, wallLevel: c.wallLevel || 0, towers: wallSlots(c)
      };
    });
    const cSig = JSON.stringify([S.currentCityId, sum.map((c) => [c.id, c.name, c.resAt, c.queue, c.home, c.score, c.troopsTotal, c.groups])]);
    if (cSig !== lastCitySig) { lastCitySig = cSig; post({ kind: 'cities-store', serverOffset: S.serverOffset || 0, currentCityId: S.currentCityId ?? null, cities: sum }); posted = true; }
    status.cities = cities.length;
    // every city's layout, not just the open one — rebuilt only for cities whose grid or build queue was replaced
    for (const c of cities) {
      const r = cityRefs.get(c.id);
      const same = !!r && r[0] === c.grid && r[1] === c.buildQueue;
      if (same && !periodic) continue;
      cityRefs.set(c.id, [c.grid, c.buildQueue]);
      if (postCity(c) && same) mutable = true;
    }
    if (sameRefs && posted) mutable = true;
    return true;
  }

  function snapshot() {
    try {
      if (snapStore()) { status.via = 'store'; return found(); }
      const r = findRef();
      if (r) { postCity(r.current.city); status.via = 'city-view'; return found(); }
    } catch (e) { noteError(e); /* never break the game */ }
    status.via = null;
    return false;
  }
  function found() { status.lastSnapAt = Date.now(); status.foundAt = status.foundAt || status.lastSnapAt; return true; }
  // ---- 4. building & node icons, by the game's own icon key (language-free) ----
  // The game draws icons as <img src="data:…"> inside a component with the prop k = "building:farm" (nodes:
  // "building:forest" …). Only icons not sent yet (or changed) are posted.
  const iconSent = new Map(); // code -> src length
  function scanIcons() {
    const found = {};
    for (const img of document.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      if (!src.startsWith('data:image/')) continue;
      const fk = Object.keys(img).find((k) => k.startsWith('__reactFiber'));
      let f = fk ? img[fk] : null;
      for (let d = 0; f && d < 5; d++, f = f.return) {
        const k = f.memoizedProps && f.memoizedProps.k;
        if (typeof k !== 'string') continue;
        const m = k.match(/^building:([a-z_]+)$/);
        if (m && CODE[m[1]] && !found[m[1]]) found[m[1]] = src;
        break; // the nearest icon key decides
      }
    }
    const fresh = Object.entries(found).filter(([c, s]) => iconSent.get(c) !== s.length);
    for (const [c, s] of fresh) iconSent.set(c, s.length);
    status.icons = iconSent.size;
    if (fresh.length) post({ kind: 'icons', icons: Object.fromEntries(fresh) });
  }

  // Every 3 s while the tab is visible, 10 s while it is in the background (attack warnings keep working;
  // browsers throttle hidden tabs anyway). While the game is not loaded (login screen…) the search for its
  // state backs off up to 30 s instead of walking the React tree every 3 s.
  let misses = 0, loopTimer = null;
  function loop() {
    clearTimeout(loopTimer);
    if ((window.__louHelperPageHookV || 0) > HOOK_V) return; // a newer hook (extension update) took over
    misses = snapshot() ? 0 : misses + 1;
    if (!misses && !document.hidden) { try { scanIcons(); } catch (e) { noteError(e); } }
    status.misses = misses;
    status.mutable = mutable;
    const base = document.hidden ? 10000 : 3000;
    loopTimer = setTimeout(loop, misses ? Math.min(30000, base * 2 ** Math.min(misses, 4)) : base);
  }
  loopTimer = setTimeout(loop, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { misses = 0; clearTimeout(loopTimer); loopTimer = setTimeout(loop, 300); } });
  // 🩺 Diagnostics (via the content script): report how reading the game goes
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__louHelperCmd !== 'diag') return;
    if ((window.__louHelperPageHookV || 0) > HOOK_V) return; // a newer hook answers
    try { const S = findStore(); if (S) status.shape = checkShape(S); } catch (err) { noteError(err); }
    post({ kind: 'hook-status', status: { ...status, hidden: document.hidden } });
  });
  // "Refresh all cities" from the dashboard (via the content script): resend everything now
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__louHelperCmd !== 'refresh') return;
    for (const k of Object.keys(lastSig)) delete lastSig[k];
    lastMapVer = -1; lastMovSig = ''; lastCitySig = ''; lastRefs = null; lastFull = 0; cityRefs.clear(); iconSent.clear();
    snapshot();
  });
})();
