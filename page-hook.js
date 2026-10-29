// Runs in the game's page context. Passive / read-only:
//  1. When the game copies a City Planner share string, pass a copy of it to the LoU Helper content script.
//  2. Every few seconds, read the ACTIVE city (grid with building levels + build queue) that the game's
//     city view already holds in memory, and pass a snapshot to the content script when it changes.
// Nothing here sends anything to the game server or changes the game.
(() => {
  // versioned guard: a newer hook (after an extension update) may install next to an older one
  const HOOK_V = 3;
  if ((window.__louHelperPageHookV || 0) >= HOOK_V) return;
  window.__louHelperPageHookV = HOOK_V;
  window.__louHelperPageHook = true;
  const post = (msg) => window.postMessage({ __louHelper: msg.kind, ...msg }, location.origin);

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
    if (lastSig[c.id] === sig) return;
    lastSig[c.id] = sig;
    post({ kind: 'city-state', city: { id: c.id, name: c.name, x: c.x, y: c.y, cont: c.continent, water: !!c.water }, cells, levels, queue });
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
  const plain = (o) => { try { return JSON.parse(JSON.stringify(o)); } catch (_) { return null; } };
  function snapStore() {
    const S = findStore();
    if (!S) return false;
    if (S.map && typeof S.map.values === 'function' && S.mapVersion !== lastMapVer) {
      lastMapVer = S.mapVersion;
      const dungeons = [];
      for (const e of S.map.values()) {
        if (!e || !e.id) continue;
        if (e.kind === 'city' || e.kind === 'dungeon' || e.kind === 'boss') {
          const l = { kind: e.kind, name: e.name || null, x: e.x, y: e.y, level: e.level || null, type: e.dungeon || e.boss || null, owner: e.ownerName || null, tag: e.allianceTag || null };
          names.set(e.id, l);
          atXY.set(`${e.x}:${e.y}`, l);
        }
        if (e.kind === 'dungeon' || e.kind === 'boss') dungeons.push({ kind: e.kind, type: e.dungeon || e.boss, level: e.level, progress: e.progress, x: e.x, y: e.y });
      }
      if (dungeons.length) post({ kind: 'map-dungeons', dungeons });
    }
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
    const data = { serverOffset: S.serverOffset || 0, lang: (S.player && S.player.lang) || null, armies, incoming, incomingTrades, training, marketMine };
    const sig = JSON.stringify(data, (key, v) => (key === 'serverOffset' ? undefined : v));
    if (sig !== lastMovSig) { lastMovSig = sig; post({ kind: 'movements', data }); }
    // language-independent city summary: resources (exact at resAt), build queue, troops at home
    const sum = cities.map((c) => {
      const q = Array.isArray(c.buildQueue) ? c.buildQueue : [];
      const first = q.find((o) => o.endAt) || null;
      let end = first ? first.endAt : null;
      if (end) for (const o of q) if (o !== first && !o.endAt) end += o.durationMs || 0;
      return {
        id: c.id, name: c.name, x: c.x, y: c.y, cont: c.continent, water: !!c.water, castle: !!c.castle,
        res: c.res ? { wood: c.res.wood, stone: c.res.stone, iron: c.res.iron, food: c.res.food, gold: c.res.gold } : null,
        resAt: c.resAt || null, queue: { count: q.length, nextAt: first ? first.endAt : null, endsAt: end },
        home: c.units || {}
      };
    });
    const cSig = JSON.stringify(sum.map((c) => [c.id, c.name, c.resAt, c.queue, c.home]));
    if (cSig !== lastCitySig) { lastCitySig = cSig; post({ kind: 'cities-store', serverOffset: S.serverOffset || 0, cities: sum }); }
    for (const c of cities) postCity(c); // every city's layout, not just the open one
    return true;
  }

  function snapshot() {
    try {
      if (snapStore()) return;
      const r = findRef();
      if (r) postCity(r.current.city);
    } catch (_) { /* never break the game */ }
  }
  setInterval(snapshot, 3000);
})();
