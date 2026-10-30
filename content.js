// LoU Revival Helper — content script.
// READ-ONLY: it only reads what the game already shows on screen (aria labels and open panels)
// and saves it to chrome.storage.local. It never clicks, types or sends anything to the game server.
(() => {
  'use strict';
  if (window.__louHelperLoaded) return;
  window.__louHelperLoaded = true;

  // selectors, labels & parsers for the game's page: lib/game-dom.js (loaded before this file)
  const D = window.LOU_DOM;
  if (!D) { console.warn('[LoU Helper] lib/game-dom.js missing'); return; }
  // UI language for the small in-game messages (dictionary from lib/i18n/content-dict.js)
  let uiLang = 'id', langSetting = 'id', gameLangSeen = null;
  const LANG_OK = ['id', 'en', 'es', 'fr', 'de', 'it', 'hu', 'el'];
  function applyLang(setting, gameLang) {
    langSetting = setting || 'id';
    if (gameLang) gameLangSeen = gameLang;
    setting = langSetting;
    const g = String(gameLangSeen || '').slice(0, 2).toLowerCase();
    uiLang = setting && setting !== 'auto' ? setting : LANG_OK.includes(g) ? g : 'en';
  }
  function tr(src, p) {
    const D = typeof LOU_I18N !== 'undefined' ? LOU_I18N : {};
    let s = uiLang === 'id' ? src : (D[uiLang] && D[uiLang][src]) || (D.en && D.en[src]) || src;
    if (p) s = s.replace(/\{(\w+)\}/g, (m, k) => (p[k] != null ? p[k] : m));
    return s;
  }
  let capture = { cities: true, dungeons: true };
  let alive = true;
  let pollTimer = null, observer = null;
  const lastWrite = {}; // key -> {sig, at}

  // ---------- 🩺 diagnostics: what was read from where, and when (shown in the dashboard → About → Diagnostics) ----------
  const diag = { startedAt: Date.now(), msgs: {}, readers: {}, storage: {} };
  function seen(name, ok, note) {
    const r = diag.readers[name] || (diag.readers[name] = {});
    if (ok) { r.okAt = Date.now(); r.note = note || null; } else { r.failAt = Date.now(); if (note) r.note = note; }
  }
  const ownKeys = new Set(); // "x:y" of the player's cities (from the game state)
  const ownById = new Map(); // game city id -> { key, name, cont }
  let currentId = null; // the city open in the game (from the game state)
  let groupsFromState = false; // city groups come from the game state (else from the "Your cities" list)
  const knownDungeons = new Map(); // "x:y" -> { kind, type, level, explored } from the map

  // ---------- storage ----------
  const VOLATILE = new Set(['seenAt', 'v', 'at', 'endsAt', 'nextAt', 'measuredAt', 'syncedAt', 'storeAt', 'rateAt']);
  function update(field, key, patch, force) {
    if (!alive) return Promise.resolve();
    const sig = JSON.stringify(patch, (k, v) => (VOLATILE.has(k) ? undefined : v));
    const lw = lastWrite[field + key];
    const now = Date.now();
    // values tick every second; write at most every 20 s (5 s when forced) unless something structural changed
    if (lw && lw.sig === sig && now - lw.at < (force ? 5000 : 20000)) return Promise.resolve();
    lastWrite[field + key] = { sig, at: now };
    // Batched: all updates made within 50 ms (e.g. every city of one game snapshot) are written with ONE
    // read-modify-write per field, instead of one full read + write of `cities` per city.
    const pf = pendingWrites[field] || (pendingWrites[field] = {});
    pf[key] = pf[key] ? deepMerge(pf[key], patch) : patch;
    return new Promise((resolve) => {
      flushWaiters.push(resolve);
      if (!flushTimer) flushTimer = setTimeout(flushWrites, 50);
    });
  }
  let pendingWrites = {}, flushWaiters = [], flushTimer = null;
  function flushWrites() {
    flushTimer = null;
    const batch = pendingWrites, waiters = flushWaiters;
    pendingWrites = {};
    flushWaiters = [];
    // serialized with the other read-modify-writes so parallel updates don't overwrite each other
    writeChain = writeChain.then(async () => {
      if (!alive) return;
      const fields = Object.keys(batch);
      try {
        const d = await chrome.storage.local.get(fields);
        const out = {};
        for (const field of fields) {
          const all = d[field] || {};
          for (const [key, patch] of Object.entries(batch[field])) all[key] = deepMerge(all[key] || {}, patch);
          out[field] = all;
        }
        await chrome.storage.local.set(out);
        diag.storage.okAt = Date.now();
      } catch (e) {
        for (const field of fields) for (const key of Object.keys(batch[field])) delete lastWrite[field + key]; // not saved: retry with the next reading
        stop(e);
      }
    }).finally(() => waiters.forEach((r) => r()));
  }
  let writeChain = Promise.resolve();
  function deepMerge(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
    }
    return out;
  }
  // The extension was reloaded/updated: this old copy of the script lost its connection to the extension.
  const contextGone = (e) => /context invalidated/i.test(String(e && (e.message || e))) || !(chrome.runtime && chrome.runtime.id);
  // true while this copy can still use chrome.*; switches the script off (quietly) as soon as it cannot.
  // chrome.storage / chrome.runtime calls THROW synchronously in an orphaned script ("Extension context
  // invalidated"), so every entry point checks this first instead of relying on .catch().
  function ctxOk() {
    if (!alive) return false;
    if (chrome.runtime && chrome.runtime.id) return true;
    stop();
    return false;
  }
  function stop(e) {
    if (!alive) return;
    // Any other error (e.g. the extension storage is full) must not switch the reader off for good:
    // report it and keep going, so data flows again as soon as the problem is gone.
    if (e && !contextGone(e)) { storageProblem(e); return; }
    alive = false;
    try {
      if (observer) observer.disconnect();
      clearInterval(pollTimer);
      clearTimeout(flushTimer);
      clearTimeout(movTimer);
    } catch (_) { /* called before the timers exist */ }
    // The background normally injects a fresh copy right away; if none took over, ask for a refresh.
    setTimeout(() => {
      if (document.documentElement.dataset.louHelper === INSTANCE) toast(tr('Extension diperbarui — tekan F5 agar data kota terus terupdate'), 8000);
    }, 4000);
  }
  let lastProblemToast = 0;
  function storageProblem(e) {
    console.warn('[LoU Helper]', e);
    diag.storage.err = String(e && (e.message || e)).slice(0, 200);
    diag.storage.errAt = Date.now();
    const now = Date.now();
    if (now - lastProblemToast < 10 * 60000) return; // at most one message every 10 minutes
    lastProblemToast = now;
    const full = /quota|QUOTA_BYTES|storage.*full/i.test(String(e && (e.message || e)));
    toast(full ? tr('Penyimpanan extension penuh — data baru tidak tersimpan. Buka LoU Helper → Pengaturan → Penyimpanan.')
      : tr('LoU Helper gagal menyimpan data: {e}', { e: String(e && (e.message || e)).slice(0, 120) }), 9000);
  }
  const INSTANCE = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  document.documentElement.dataset.louHelper = INSTANCE;

  // ---------- page readers (the parsing itself lives in lib/game-dom.js) ----------
  // the open city: from the page's city chip, else from the game state
  function currentCity() {
    const c = D.readActiveCity(document);
    if (c) return c;
    const o = currentId && ownById.get(currentId);
    return o ? { ...o, fromState: true } : null;
  }

  // resource bar of the open city: capacity and production/h exist only on the page
  function scrapeActiveCity() {
    const c = D.readActiveCity(document);
    seen('cityChip', !!c);
    if (!c) return;
    const res = D.readResources(document);
    seen('resourceBar', !!res, res ? Object.keys(res).join(',') : null);
    if (!res) return;
    const now = Date.now();
    // the game's own production/h & capacity: mark as real (replaces a rate computed by "Refresh all cities")
    for (const k of Object.keys(res)) { res[k].rateAt = now; res[k].calcAt = null; }
    const patch = { key: c.key, name: c.name, cont: c.cont, x: c.x, y: c.y, res, seenAt: now };
    const b = D.readBuildings(document);
    if (b) patch.buildings = b;
    const qCount = D.readQueueCount(document);
    const panel = D.readQueuePanel(document, now); // Construction panel open → exact times
    if (panel) seen('queuePanel', true);
    const queue = { count: qCount };
    if (panel) { queue.endsAt = panel.endsAt; queue.measuredAt = now; if (panel.nextAt) queue.nextAt = panel.nextAt; queue.count = panel.count || queue.count; }
    if (queue.count === 0) { queue.endsAt = null; queue.nextAt = null; }
    if (qCount != null || panel) patch.queue = queue;
    update('cities', c.key, patch, !!panel);
  }

  function scrapeSheets() {
    document.querySelectorAll(D.SEL.sheet).forEach((sheet) => {
      if (capture.cities && D.isCityList(sheet, ownKeys)) scrapeCityList(sheet);
      else if (capture.dungeons) scrapeDungeon(sheet);
    });
  }

  function scrapeCityList(sheet) {
    const rows = D.readCityList(sheet);
    seen('cityList', rows.length > 0, rows.length ? `${rows.length} · ${rows.some((r) => r.score != null) ? 'score' : 'no score'}` : null);
    const at = Date.now();
    for (const r of rows) {
      const patch = { key: r.key, name: r.name, cont: r.cont, x: r.x, y: r.y, listAt: at };
      if (r.group && !groupsFromState) patch.group = r.group; // the game state has the groups (all of them) when available
      if (r.score != null) patch.score = r.score;
      if (r.troops != null) patch.troops = r.troops;
      update('cities', r.key, patch);
    }
  }

  function scrapeDungeon(sheet) {
    const rec = D.readDungeonPanel(sheet, knownDungeons);
    if (!rec) return;
    seen('dungeonPanel', true);
    rec.seenAt = Date.now();
    if (rec.explored == null) delete rec.explored; // keep what is known
    const isNew = !lastWrite['dungeons' + rec.key];
    update('dungeons', rec.key, rec).then(() => isNew && alive && toast(tr('Disimpan: {x}', { x: `${rec.type} L${rec.level} (${rec.key})` })));
  }

  // ---------- tiny feedback toast (pointer-events: none, never blocks the game) ----------
  function toast(msg, ms = 2200) {
    let el = document.getElementById('lou-helper-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'lou-helper-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;' +
        'background:rgba(28,22,15,.92);color:#f3e6c8;border:1px solid #c99a3e;border-radius:8px;padding:6px 12px;' +
        'font:500 12px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.4);transition:opacity .3s;opacity:0';
      document.body.appendChild(el);
    }
    el.textContent = '🛡 LoU Helper · ' + msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.opacity = '0'), ms);
  }

  // ---------- city layout share strings (game: City planner → Plans & share → Copy share string) ----------
  let lastShare = '';
  function onShareString(text) {
    if (!alive || !text || !/\[ShareString\.\d+\.\d+\][:;]/.test(text) || text === lastShare) return;
    lastShare = text;
    const city = currentCity();
    try {
      chrome.runtime.sendMessage({ type: 'share-captured', text, city }).then((r) => {
        if (r?.ok) toast(tr('Layout {c} tersimpan ke Perencana Layout', { c: city ? city.name : tr('kota') }));
      }).catch(() => {});
    } catch (e) {
      stop(e);
    }
  }
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || !e.data.__louHelper || !ctxOk()) return;
    try { onPageMessage(e); } catch (err) { report(err); }
  });
  // an error in a handler: an orphaned script switches off; anything else is noted for 🩺 Diagnostics
  function report(err) {
    if (contextGone(err)) stop(err);
    else { console.warn('[LoU Helper]', err); diag.error = { msg: String(err && (err.message || err)).slice(0, 200), at: Date.now() }; }
  }
  function onPageMessage(e) {
    const kind = e.data.__louHelper;
    if (kind) { const m = diag.msgs[kind] || (diag.msgs[kind] = { n: 0 }); m.n++; m.at = Date.now(); }
    if (kind === 'hook-status') diag.hook = { ...e.data.status, at: Date.now() };
    if (kind === 'icons') onHookIcons(e.data.icons);
    if (e.data.__louHelper === 'share-string') onShareString(String(e.data.text));
    if (e.data.__louHelper === 'city-state') onCityState(e.data);
    if (e.data.__louHelper === 'movements') onMovements(e.data.data);
    if (e.data.__louHelper === 'cities-store' && capture.cities) onCitiesStore(e.data);
    if (e.data.__louHelper === 'map-cities') onMapCities(e.data.cities);
    if (e.data.__louHelper === 'map-dungeons' && capture.dungeons) onMapDungeons(e.data.dungeons);
  }

  // Armies, incoming attacks, trades, recruitment (from the game's own state)
  let lastMovWrite = 0, movTimer = null, pendingMov = null;
  // All cities from the game's store (language-independent): exact resources, build queue, troops at home.
  function onCitiesStore(d) {
    if (!alive || !Array.isArray(d.cities)) return;
    const off = d.serverOffset || 0; // server time = local time + offset
    if (d.currentCityId != null) currentId = d.currentCityId;
    ownKeys.clear();
    for (const c of d.cities) {
      if (c.x == null || c.y == null) continue;
      const key = `${c.x}:${c.y}`;
      ownKeys.add(key);
      ownById.set(c.id, { key, x: c.x, y: c.y, cont: c.cont, name: c.name });
      const patch = { key, name: c.name, cont: c.cont, x: c.x, y: c.y, water: c.water, castle: !!c.castle, gameId: c.id };
      if (c.res && c.resAt) {
        patch.res = {};
        for (const k of ['wood', 'stone', 'iron', 'food', 'gold']) if (typeof c.res[k] === 'number') patch.res[k] = { v: Math.round(c.res[k]) };
        patch.storeAt = c.resAt - off;
        patch.seenAt = patch.storeAt; // values are exact at that moment; projections run from there
      }
      patch.syncedAt = Date.now();
      const q = c.queue || {};
      patch.queue = { count: q.count || 0, nextAt: q.nextAt ? q.nextAt - off : null, endsAt: q.endsAt ? q.endsAt - off : null, measuredAt: Date.now() };
      patch.troopsHome = Object.values(c.home || {}).reduce((a, n) => a + (n || 0), 0);
      if (c.troopsTotal != null) patch.troopsTotal = c.troopsTotal; // at home + on the move
      if (c.score != null) patch.score = c.score; // from the map (any game language)
      if (Array.isArray(c.groups)) { patch.group = c.groups.join(', '); groupsFromState = true; } // the player's city groups
      patch.wallLevel = c.wallLevel || 0;
      patch.towers = c.towers || {};
      update('cities', key, patch, false);
    }
  }

  // Other players' cities seen on the map → "players" (name, alliance, cities).
  let lastPlayersSig = '';
  function onMapCities(list) {
    if (!alive || !Array.isArray(list) || !list.length) return;
    const sig = JSON.stringify(list.map((c) => [c.x, c.y, c.owner, c.tag, c.name]));
    if (sig === lastPlayersSig) return;
    lastPlayersSig = sig;
    writeChain = writeChain.then(async () => {
      if (!alive) return;
      try {
        const d = await chrome.storage.local.get('players');
        const all = d.players || {};
        const now = Date.now();
        for (const c of list) {
          const key = `${c.x}:${c.y}`;
          // a city can change hands: drop it from its previous owner
          for (const p of Object.values(all)) if (p.name !== c.owner && p.cities?.[key]) delete p.cities[key];
          const p = all[c.owner] || (all[c.owner] = { name: c.owner, cities: {} });
          p.tag = c.tag || null; p.id = c.ownerId || p.id || null; p.seenAt = now;
          p.cities[key] = { key, x: c.x, y: c.y, name: c.name, score: c.score, water: c.water, castle: c.castle, seenAt: now };
        }
        await chrome.storage.local.set({ players: all });
      } catch (e) { lastPlayersSig = ''; stop(e); }
    });
  }

  function onMovements(data) {
    if (!alive || !data) return;
    if (data.lang && data.lang !== gameLangSeen) applyLang(langSetting, data.lang);
    pendingMov = data;
    const write = () => {
      movTimer = null;
      const d = pendingMov;
      pendingMov = null;
      lastMovWrite = Date.now();
      try {
        chrome.storage.local.set({ movements: { ...d, at: Date.now() } }).catch(stop);
        if (d.incoming?.length) chrome.runtime.sendMessage({ type: 'incoming', list: d.incoming, off: d.serverOffset || 0 }).catch(() => {});
      } catch (e) { stop(e); }
    };
    // incoming attacks go out immediately; everything else at most every 2 s
    if (data.incoming?.length || Date.now() - lastMovWrite > 2000) { clearTimeout(movTimer); write(); }
    else if (!movTimer) movTimer = setTimeout(write, 2000);
  }

  // Every dungeon / boss the game has loaded on the region map
  function onMapDungeons(list) {
    if (!alive || !Array.isArray(list) || !list.length) return;
    const cont = currentCity()?.cont ?? null;
    writeChain = writeChain.then(async () => {
      try {
        const d = await chrome.storage.local.get('dungeons');
        const all = d.dungeons || {};
        const now = Date.now();
        for (const m of list) {
          const key = `${m.x}:${m.y}`;
          const type = String(m.type || '').replace(/^\w/, (ch) => ch.toUpperCase());
          knownDungeons.set(key, { kind: m.kind === 'boss' ? 'boss' : 'dungeon', type, level: m.level, explored: m.progress != null ? Math.round(m.progress * 10) / 10 : null });
          all[key] = {
            ...(all[key] || {}), key, x: m.x, y: m.y, cont: all[key]?.cont ?? cont,
            kind: m.kind === 'boss' ? 'boss' : 'dungeon', type, level: m.level,
            explored: m.progress != null ? Math.round(m.progress * 10) / 10 : all[key]?.explored ?? null,
            seenAt: now, fromMap: true
          };
        }
        await chrome.storage.local.set({ dungeons: all });
      } catch (e) { stop(e); }
    });
  }

  // Live city snapshot from the game's city view (grid + real levels + build queue)
  const syncedOnce = new Set();
  function onCityState(d) {
    if (!alive || !d.city || typeof d.cells !== 'string' || d.cells.length !== 441) return;
    const key = `${d.city.x}:${d.city.y}`;
    const now = Date.now();
    // exact construction queue for the city overview
    if (capture.cities && Array.isArray(d.queue)) {
      const active = d.queue.filter((q) => q.endAt);
      const waiting = d.queue.filter((q) => !q.endAt);
      const activeEnd = active.length ? Math.max(...active.map((q) => q.endAt)) : now;
      const endsAt = d.queue.length ? activeEnd + waiting.reduce((a, q) => a + (q.durationMs || 0), 0) : null;
      update('cities', key, {
        key, name: d.city.name, cont: d.city.cont, x: d.city.x, y: d.city.y,
        queue: { count: d.queue.length, endsAt, nextAt: active.length ? Math.min(...active.map((q) => q.endAt)) : null, measuredAt: now, exact: true }
      }, true);
    }
    try {
      chrome.runtime.sendMessage({
        type: 'city-layout',
        city: { key, name: d.city.name, cont: d.city.cont, water: d.city.water },
        cells: d.cells, levels: d.levels, queue: d.queue
      }).then((r) => {
        if (r?.created && !syncedOnce.has(key)) toast(tr('Layout {c} tersinkron otomatis ke Perencana Layout', { c: d.city.name }));
        syncedOnce.add(key);
      }).catch(() => {});
    } catch (e) {
      stop(e);
    }
  }
  // Is the page hook running? Chrome, Edge and Firefox load it into the page from the manifest (world: MAIN);
  // Safari (and anything that ignores that) gets it here as a <script> from the extension.
  (function ensurePageHook() {
    let pong = false;
    const onPong = (e) => { if (e.source === window && e.data && e.data.__louHelper === 'pong') pong = true; };
    window.addEventListener('message', onPong);
    const ask = () => window.postMessage({ __louHelperCmd: 'ping' }, location.origin);
    ask();
    setTimeout(ask, 600);
    setTimeout(() => {
      window.removeEventListener('message', onPong);
      if (pong || !alive) return;
      try {
        const sc = document.createElement('script');
        sc.src = chrome.runtime.getURL('page-hook.js');
        sc.onload = () => sc.remove();
        (document.head || document.documentElement).appendChild(sc);
      } catch (e) { console.warn('[LoU Helper] page hook injection failed', e); }
    }, 1600);
  })();

  // dashboard → "Refresh all cities": forget the last-sent signatures and ask the page hook for a fresh snapshot
  try {
    chrome.runtime.onMessage.addListener((m, _s, reply) => {
      // dashboard → 🎩 Ministers "Apply to game": hand the minister settings to the page hook, return its answers
      if (m?.type === 'lou-minister' && alive && Array.isArray(m.msgs)) {
        const id = Math.random().toString(36).slice(2);
        const onRes = (e) => {
          if (e.source !== window || e.data?.__louHelper !== 'minister-result' || e.data.id !== id) return;
          window.removeEventListener('message', onRes);
          lastMovWrite = 0; // the fresh minister settings that follow are written immediately
          reply({ ok: true, results: e.data.results });
        };
        window.addEventListener('message', onRes);
        window.postMessage({ __louHelperCmd: 'minister', id, msgs: m.msgs }, location.origin);
        setTimeout(() => { window.removeEventListener('message', onRes); reply({ ok: false, error: 'timeout' }); }, 15000);
        return true; // async reply
      }
      // dashboard → 🩺 Diagnostics: this script's readings + a fresh status from the page hook
      if (m?.type === 'lou-diag') {
        const onStatus = (e) => {
          if (e.source !== window || e.data?.__louHelper !== 'hook-status') return;
          window.removeEventListener('message', onStatus);
          clearTimeout(timer);
          answer({ ...e.data.status, at: Date.now() });
        };
        const answer = (hook) => reply({
          ok: true, alive, version: chrome.runtime.getManifest().version, url: location.origin + location.pathname,
          gameLang: gameLangSeen, ownCities: ownKeys.size, knownDungeons: knownDungeons.size, capture, diag, hook,
          visible: !document.hidden, ua: navigator.userAgent
        });
        const timer = setTimeout(() => { window.removeEventListener('message', onStatus); answer(null); }, 800);
        window.addEventListener('message', onStatus);
        window.postMessage({ __louHelperCmd: 'diag' }, location.origin);
        return true; // async reply
      }
      if (m?.type !== 'lou-refresh' || !alive) return;
      for (const k of Object.keys(lastWrite)) delete lastWrite[k];
      window.postMessage({ __louHelperCmd: 'refresh' }, location.origin);
      reply({ ok: true });
    });
  } catch (e) { stop(e); }

  // also catch a manual Ctrl+C of a share string (e.g. from the game's text box)
  document.addEventListener('copy', () => {
    const t = String(window.getSelection() || '');
    if (t.includes('[ShareString')) onShareString(t.trim());
  });

  // ---------- building / node icons as drawn by the game (Build bar + Guide), cached locally for the planner ----------
  // Two sources: the page hook finds them by the game's own icon keys ("building:farm" → any game language);
  // this script also matches English names on the page (fallback).
  const iconSeen = {};
  let iconBusy = false, iconQueue = {};
  function scrapeIcons() { saveIcons(D.readIcons(document)); }
  function onHookIcons(byCode) {
    const found = {};
    for (const [code, src] of Object.entries(byCode || {})) {
      const name = D.ICON_BY_CODE[code];
      if (name && typeof src === 'string' && src.startsWith('data:image/')) found[name] = src;
    }
    saveIcons(found);
  }
  function saveIcons(found) {
    if (!ctxOk()) return;
    Object.assign(iconQueue, found);
    if (iconBusy) return;
    const fresh = Object.entries(iconQueue).filter(([n, s]) => iconSeen[n] !== s.length);
    iconQueue = {};
    if (!fresh.length) return;
    iconBusy = true;
    Promise.resolve().then(() => chrome.storage.local.get('gameIcons')).then(async (d) => {
      const all = d.gameIcons || {};
      let changed = false;
      const added = [];
      for (const [n, s] of fresh) {
        iconSeen[n] = s.length;
        if (!all[n]) added.push(n);
        if (all[n] !== s) { all[n] = s; changed = true; }
      }
      if (changed) await chrome.storage.local.set({ gameIcons: all });
      seen('icons', true, `${Object.keys(all).length}/28`);
      if (added.length) toast(tr('Ikon game tersimpan ({n}/28): {l}', { n: Object.keys(all).length, l: added.slice(0, 6).join(', ') + (added.length > 6 ? '…' : '') }), 4000);
    }).catch(stop).finally(() => { iconBusy = false; if (alive && Object.keys(iconQueue).length) saveIcons({}); });
  }

  // ---------- loop ----------
  let scheduled = false;
  function tick() {
    scheduled = false;
    if (!ctxOk()) return;
    try {
      if (capture.cities) scrapeActiveCity();
      scrapeSheets();
      scrapeIcons();
    } catch (e) { report(e); }
  }
  function schedule() {
    if (scheduled || !alive) return;
    scheduled = true;
    setTimeout(tick, 700); // debounce bursts of DOM mutations
  }

  observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
  pollTimer = setInterval(schedule, 30000);

  Promise.resolve().then(() => chrome.storage.local.get(['settings', 'movements', 'dungeons'])).then((d) => {
    if (d.settings?.capture) capture = { ...capture, ...d.settings.capture };
    for (const [k, x] of Object.entries(d.dungeons || {})) if (x && x.level) knownDungeons.set(k, { kind: x.kind, type: x.type, level: x.level, explored: x.explored ?? null });
    applyLang(d.settings?.lang || 'id', d.movements?.lang);
    schedule();
  }).catch(stop);
  try {
    chrome.storage.onChanged.addListener(onStorageChanged);
  } catch (e) { stop(e); }
  function onStorageChanged(ch) {
    if (!alive) return;
    if (ch.settings?.newValue?.capture) capture = { ...capture, ...ch.settings.newValue.capture };
    if (ch.settings?.newValue) applyLang(ch.settings.newValue.lang || 'id', null);
  }
})();
