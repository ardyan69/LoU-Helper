// LoU Revival Helper — content script.
// READ-ONLY: it only reads what the game already shows on screen (aria labels and open panels)
// and saves it to chrome.storage.local. It never clicks, types or sends anything to the game server.
(() => {
  'use strict';
  if (window.__louHelperLoaded) return;
  window.__louHelperLoaded = true;

  const RES_MAP = { wood: 'wood', stone: 'stone', iron: 'iron', food: 'food', gold: 'gold' };
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
  const lastWrite = {}; // key -> {sig, at}

  // ---------- parsers ----------
  function parseNum(s) {
    if (s == null) return null;
    s = String(s).trim().toLowerCase().replace(/\s/g, '').replace(/,/g, '');
    const m = s.match(/^(-?[\d.]+)([km])?$/);
    if (!m) return null;
    let n = m[1];
    if (!m[2] && /^-?\d{1,3}(\.\d{3})+$/.test(n)) n = n.replace(/\./g, ''); // "7.000" -> 7000
    let v = parseFloat(n);
    if (m[2] === 'k') v *= 1e3;
    if (m[2] === 'm') v *= 1e6;
    return Math.round(v);
  }
  function parseDur(s) {
    if (!s) return null;
    let ms = 0, hit = false;
    const re = /(\d+)\s*(d|h|j|m|s)\b/gi;
    let m;
    while ((m = re.exec(s))) {
      hit = true;
      const n = +m[1], u = m[2].toLowerCase();
      ms += n * (u === 'd' ? 864e5 : u === 'h' || u === 'j' ? 36e5 : u === 'm' ? 6e4 : 1e3);
    }
    return hit ? ms : null;
  }
  function parseCoord(s) {
    const m = String(s || '').match(/C(\d+)\s*·\s*(\d+):(\d+)/);
    return m ? { cont: +m[1], x: +m[2], y: +m[3], key: `${m[2]}:${m[3]}` } : null;
  }
  const aria = (el) => (el && el.getAttribute('aria-label')) || '';

  // ---------- storage ----------
  function update(field, key, patch, force) {
    if (!alive) return Promise.resolve();
    const VOLATILE = new Set(['seenAt', 'v', 'at', 'endsAt', 'nextAt', 'measuredAt', 'syncedAt', 'storeAt']);
    const sig = JSON.stringify(patch, (k, v) => (VOLATILE.has(k) ? undefined : v));
    const lw = lastWrite[field + key];
    const now = Date.now();
    // values tick every second; write at most every 20 s (5 s when forced) unless something structural changed
    if (lw && lw.sig === sig && now - lw.at < (force ? 5000 : 20000)) return Promise.resolve();
    lastWrite[field + key] = { sig, at: now };
    // serialize read-modify-write so parallel updates don't overwrite each other
    writeChain = writeChain.then(async () => {
      if (!alive) return;
      try {
        const d = await chrome.storage.local.get(field);
        const all = d[field] || {};
        all[key] = deepMerge(all[key] || {}, patch);
        await chrome.storage.local.set({ [field]: all });
      } catch (e) {
        stop(e);
      }
    });
    return writeChain;
  }
  let writeChain = Promise.resolve();
  function deepMerge(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
    }
    return out;
  }
  function stop(e) {
    // Happens after the extension is reloaded/updated: this old script loses its context.
    if (!alive) return;
    alive = false;
    observer && observer.disconnect();
    if (e && !/context invalidated/i.test(String(e))) { console.warn('[LoU Helper]', e); return; }
    // The background normally injects a fresh copy right away; if none took over, ask for a refresh.
    setTimeout(() => {
      if (document.documentElement.dataset.louHelper === INSTANCE) toast(tr('Extension diperbarui — tekan F5 agar data kota terus terupdate'), 8000);
    }, 4000);
  }
  const INSTANCE = String(Date.now()) + Math.random().toString(36).slice(2, 6);
  document.documentElement.dataset.louHelper = INSTANCE;

  // ---------- scrapers ----------
  function scrapeActiveCity() {
    const chip = document.querySelector('button.city-chip');
    if (!chip) return;
    const c = parseCoord(chip.querySelector('.sub')?.textContent);
    if (!c) return;
    const name = chip.querySelector('.name')?.textContent.trim() || c.key;
    // Resource bar: the resource comes from data-tour="res-<kind>" and the numbers by position,
    // so this works in every game language ("<Wood> 34630 <of> 122000, 330 <per hour>").
    const res = {};
    document.querySelectorAll('button.res[data-tour^="res-"]').forEach((b) => {
      const k = RES_MAP[b.dataset.tour.slice(4)];
      if (!k) return;
      const nums = (aria(b).match(/-?\d[\d.,]*/g) || []).map(parseNum).filter((n) => n != null);
      if (nums.length < 2) return;
      if (nums.length >= 3) res[k] = { v: nums[0], cap: nums[1], rate: nums[2] };
      else res[k] = { v: nums[0], rate: nums[1] };
    });
    if (!Object.keys(res).length) return;
    const now = Date.now();
    const patch = { key: c.key, name, cont: c.cont, x: c.x, y: c.y, res, seenAt: now };

    // queue size: the construction-queue button's number; buildings: the "79/80" pill (both language-free)
    const qBtn = document.querySelector('[data-tour="fab-queue"]');
    let qCount = qBtn ? parseNum((qBtn.textContent.match(/\d+/) || ['0'])[0]) : null, bUsed = null, bMax = null;
    document.querySelectorAll('.city-pill, button[aria-label]').forEach((b) => {
      const m = b.textContent.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
      if (m && bUsed == null && b.classList.contains('city-pill')) { bUsed = +m[1]; bMax = +m[2]; }
    });
    if (bUsed != null) patch.buildings = { used: bUsed, max: bMax };

    const queue = { count: qCount };
    // Construction panel open? -> exact finish time of the whole queue.
    const qt = document.querySelector('.sheet .queue-total');
    if (qt) {
      const total = parseDur(qt.querySelector('.num')?.textContent || qt.textContent);
      if (total != null) { queue.endsAt = now + total; queue.measuredAt = now; }
      const first = document.querySelector('.sheet .queue-item .li-sub .num');
      const firstMs = parseDur(first?.textContent);
      if (firstMs != null) queue.nextAt = now + firstMs;
      queue.count = document.querySelectorAll('.sheet .queue-item').length || queue.count;
    }
    if (queue.count === 0) { queue.endsAt = null; queue.nextAt = null; }
    if (qCount != null || qt) patch.queue = queue;

    update('cities', c.key, patch, !!qt);
  }

  function scrapeSheets() {
    document.querySelectorAll('.sheet').forEach((sheet) => {
      const head = sheet.querySelector('.sheet-head');
      const title = (head?.querySelector('h2')?.textContent || head?.innerText || '').trim();
      if (capture.cities && /^Your cities/i.test(title)) scrapeCityList(sheet);
      if (capture.dungeons) scrapeDungeon(sheet, title, head);
    });
  }

  function scrapeCityList(sheet) {
    sheet.querySelectorAll('.list-item').forEach((li) => {
      const sub = li.querySelector('.li-sub')?.textContent || '';
      const c = parseCoord(sub);
      if (!c) return;
      const name = li.querySelector('.li-title')?.textContent.trim();
      const score = parseNum((sub.match(/score\s+([\d.,]+)/i) || [])[1]);
      const troops = parseNum((sub.match(/([\d.,]+[km]?)\s+troops/i) || [])[1]);
      const group = li.querySelector('.chip')?.textContent.trim() || '';
      const list = { at: Date.now() };
      li.querySelectorAll('.cost-item').forEach((ci) => {
        const k = RES_MAP[(ci.querySelector('img')?.alt || '').toLowerCase()];
        if (k) list[k] = parseNum(ci.textContent);
      });
      const busy = (li.innerText.match(/(\d+)\s+building/i) || [])[1];
      update('cities', c.key, { key: c.key, name, cont: c.cont, x: c.x, y: c.y, score, troops, group, list, listBuilding: busy ? +busy : 0 });
    });
  }

  function scrapeDungeon(sheet, title, head) {
    const m = title.match(/^(.*?)\s*·\s*level\s*(\d+)/i);
    if (!m) return;
    const text = sheet.innerText;
    if (!/explored|guardians|max loot/i.test(text)) return; // not a dungeon/boss panel
    const c = parseCoord(head.querySelector('.small, .muted')?.textContent || text);
    if (!c) return;
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const after = (label) => {
      const i = lines.findIndex((l) => l.toLowerCase() === label);
      return i >= 0 ? lines[i + 1] : null;
    };
    const name = m[1].trim();
    const isDungeon = /dungeon/i.test(name);
    const rec = {
      key: c.key, cont: c.cont, x: c.x, y: c.y,
      kind: isDungeon ? 'dungeon' : 'boss',
      type: isDungeon ? name.replace(/\s*dungeon\s*/i, '').trim() : name,
      level: +m[2],
      explored: parseNum((after('explored') || '').replace('%', '')),
      guardians: parseNum(after('guardians')),
      maxLoot: parseNum(after('max loot')),
      weakTo: after('weak to') || '',
      seenAt: Date.now()
    };
    const isNew = !lastWrite['dungeons' + c.key];
    update('dungeons', c.key, rec).then(() => isNew && alive && toast(tr('Disimpan: {x}', { x: `${name} L${rec.level} (${c.key})` })));
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
  function currentCity() {
    const chip = document.querySelector('button.city-chip');
    const c = parseCoord(chip?.querySelector('.sub')?.textContent);
    return c ? { key: c.key, cont: c.cont, name: chip.querySelector('.name')?.textContent.trim() || c.key } : null;
  }
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
    if (e.source !== window || !e.data) return;
    if (e.data.__louHelper === 'share-string') onShareString(String(e.data.text));
    if (e.data.__louHelper === 'city-state') onCityState(e.data);
    if (e.data.__louHelper === 'movements') onMovements(e.data.data);
    if (e.data.__louHelper === 'cities-store' && capture.cities) onCitiesStore(e.data);
    if (e.data.__louHelper === 'map-cities') onMapCities(e.data.cities);
    if (e.data.__louHelper === 'map-dungeons' && capture.dungeons) onMapDungeons(e.data.dungeons);
  });

  // Armies, incoming attacks, trades, recruitment (from the game's own state)
  let lastMovWrite = 0, movTimer = null, pendingMov = null;
  // All cities from the game's store (language-independent): exact resources, build queue, troops at home.
  function onCitiesStore(d) {
    if (!alive || !Array.isArray(d.cities)) return;
    const off = d.serverOffset || 0; // server time = local time + offset
    for (const c of d.cities) {
      if (c.x == null || c.y == null) continue;
      const key = `${c.x}:${c.y}`;
      const patch = { key, name: c.name, cont: c.cont, x: c.x, y: c.y, water: c.water, gameId: c.id };
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
      } catch (e) { stop(e); }
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
        if (d.incoming?.length) chrome.runtime.sendMessage({ type: 'incoming', list: d.incoming }).catch(() => {});
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
  // also catch a manual Ctrl+C of a share string (e.g. from the game's text box)
  document.addEventListener('copy', () => {
    const t = String(window.getSelection() || '');
    if (t.includes('[ShareString')) onShareString(t.trim());
  });

  // ---------- building / node icons as drawn by the game (Build bar + Guide), cached locally for the planner ----------
  const ICON_NAMES = new Set(["Woodcutter's Hut", 'Quarry', 'Iron Mine', 'Farm', 'Sawmill', 'Stonemason', 'Foundry', 'Mill', 'Cottage',
    'Warehouse', 'Hideout', 'Townhouse', 'Marketplace', 'Harbor', 'Barracks', 'City Guard House', 'Training Ground', 'Stable',
    'Moonglow Tower', 'Trinsic Temple', 'Workshop', 'Shipyard', 'Castle', 'Town Hall', 'Forest', 'Rocks', 'Ore Deposit', 'Lake']);
  const iconSeen = {};
  let iconBusy = false;
  function scrapeIcons() {
    if (iconBusy) return;
    const found = {};
    document.querySelectorAll('button.bb-item').forEach((b) => {
      const name = b.getAttribute('aria-label');
      const src = b.querySelector('img')?.getAttribute('src');
      if (ICON_NAMES.has(name) && src && src.startsWith('data:image/')) found[name] = src;
    });
    document.querySelectorAll('img[alt]').forEach((im) => {
      const name = im.getAttribute('alt');
      const src = im.getAttribute('src');
      if (ICON_NAMES.has(name) && src && src.startsWith('data:image/') && !found[name]) found[name] = src;
    });
    // building panels (e.g. tapping the Town Hall) show the same icon in their header
    document.querySelectorAll('.sheet-head').forEach((h) => {
      const name = (h.querySelector('h2')?.textContent || '').split('·')[0].trim();
      const src = h.querySelector('img')?.getAttribute('src');
      if (ICON_NAMES.has(name) && src && src.startsWith('data:image/') && !found[name]) found[name] = src;
    });
    const fresh = Object.entries(found).filter(([n, s]) => iconSeen[n] !== s.length);
    if (!fresh.length) return;
    iconBusy = true;
    chrome.storage.local.get('gameIcons').then(async (d) => {
      const all = d.gameIcons || {};
      let changed = false;
      const added = [];
      for (const [n, s] of fresh) {
        iconSeen[n] = s.length;
        if (!all[n]) added.push(n);
        if (all[n] !== s) { all[n] = s; changed = true; }
      }
      if (changed) await chrome.storage.local.set({ gameIcons: all });
      if (added.length) toast(tr('Ikon game tersimpan ({n}/28): {l}', { n: Object.keys(all).length, l: added.slice(0, 6).join(', ') + (added.length > 6 ? '…' : '') }), 4000);
    }).catch(stop).finally(() => { iconBusy = false; });
  }

  // ---------- loop ----------
  let scheduled = false;
  function tick() {
    scheduled = false;
    if (!alive) return;
    try {
      if (capture.cities) scrapeActiveCity();
      scrapeSheets();
      scrapeIcons();
    } catch (e) {
      if (/context invalidated/i.test(String(e))) stop(e);
      else console.warn('[LoU Helper] scrape error', e);
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(tick, 700); // debounce bursts of DOM mutations
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
  setInterval(schedule, 30000);

  chrome.storage.local.get(['settings', 'movements']).then((d) => {
    if (d.settings?.capture) capture = { ...capture, ...d.settings.capture };
    applyLang(d.settings?.lang || 'id', d.movements?.lang);
    schedule();
  }).catch(stop);
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.settings?.newValue?.capture) capture = { ...capture, ...ch.settings.newValue.capture };
    if (ch.settings?.newValue) applyLang(ch.settings.newValue.lang || 'id', null);
  });
})();
