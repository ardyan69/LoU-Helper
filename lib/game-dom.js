// LoU Helper — everything the content script knows about the game's PAGE (HTML): selectors, the few English
// labels still needed, and the parsers. When a game update changes the interface, this is the file to adjust
// (the game's in-memory state is read by page-hook.js; see the GAME STATE block at its top).
//
// Most data comes from the game's state, which does not depend on the language. The page is only read for:
//   - the resource bar of the open city (capacity and production per hour are not in the game state);
//   - the Construction panel (exact queue times; also in the state, the panel is a fallback);
//   - the "Your cities" list and dungeon/boss panels — only as a fallback (score, troops, groups, dungeons and
//     their details all come from the game state / game data);
//   - building icons by their English names — fallback only: page-hook.js finds them by the game's own icon
//     keys ("building:farm"), in every language.
// Classic script (content scripts are not modules) that also loads as an ES module in the tests:
// it only sets globalThis.LOU_DOM.
(function (g) {
  'use strict';

  const SEL = {
    cityChip: 'button.city-chip', cityChipName: '.name', cityChipSub: '.sub',
    resButton: 'button.res[data-tour^="res-"]', // data-tour="res-wood" … names the resource in every language
    queueFab: '[data-tour="fab-queue"]',
    cityPill: '.city-pill', // "79/80" buildings
    sheet: '.sheet', sheetHead: '.sheet-head', sheetTitle: 'h2', sheetSubtitle: '.small, .muted',
    queueTotal: '.queue-total', queueItem: '.queue-item', queueItemTime: '.li-sub .num', num: '.num',
    listItem: '.list-item', listTitle: '.li-title', listSub: '.li-sub', listChip: '.chip',
    buildBarItem: 'button.bb-item'
  };

  // English game texts. Each one is only a shortcut next to a language-free way (own-city coordinates, dungeons
  // known from the map, the position of the numbers), so nothing depends on the game being in English.
  const LABELS = {
    cityListTitle: /^your cities/i,
    level: /^(.*?)\s*·\s*level\s*(\d+)/i,
    dungeonPanel: /explored|guardians|max loot|health/i,
    dungeonWord: /dungeon/i,
    explored: /^explored$/i,
    score: /score\s+([\d.,\u00a0\u202f]+)/i,
    troops: /([\d.,\u00a0\u202f]+[km]?)\s+troops/i
  };

  const RES = { wood: 'wood', stone: 'stone', iron: 'iron', food: 'food', gold: 'gold' };
  // the game's building / node codes → the names the Layout Planner stores icons under
  const ICON_BY_CODE = {
    woodcutter: "Woodcutter's Hut", quarry: 'Quarry', ironmine: 'Iron Mine', farm: 'Farm', sawmill: 'Sawmill', stonemason: 'Stonemason',
    foundry: 'Foundry', mill: 'Mill', cottage: 'Cottage', warehouse: 'Warehouse', hideout: 'Hideout', townhouse: 'Townhouse',
    marketplace: 'Marketplace', harbor: 'Harbor', barracks: 'Barracks', cityguard_house: 'City Guard House', training_ground: 'Training Ground',
    stable: 'Stable', moonglow_tower: 'Moonglow Tower', trinsic_temple: 'Trinsic Temple', workshop: 'Workshop', shipyard: 'Shipyard',
    castle: 'Castle', townhall: 'Town Hall', forest: 'Forest', stone: 'Rocks', iron: 'Ore Deposit', lake: 'Lake'
  };
  const ICON_NAMES = Object.values(ICON_BY_CODE);

  // ---------- parsers ----------
  // "34630", "34,630", "34.630", "34 630" (no-break / narrow no-break space, e.g. French), "1.5k", "2m", "-1.234"
  function parseNum(s) {
    if (s == null) return null;
    s = String(s).trim().toLowerCase().replace(/[\s\u00a0\u202f]/g, '').replace(/^\+/, '');
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?[km]?$/.test(s)) s = s.replace(/,/g, ''); // 1,234,567(.5)
    else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?[km]?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // 1.234.567(,5)
    else s = s.replace(',', '.'); // 1,5k → 1.5k
    const m = s.match(/^(-?\d+(?:\.\d+)?)([km])?$/);
    if (!m) return null;
    let v = parseFloat(m[1]);
    if (m[2] === 'k') v *= 1e3;
    if (m[2] === 'm') v *= 1e6;
    return Math.round(v);
  }
  // all numbers in a text, in order (thousands separators of any locale kept together)
  const NUM_RE = /-?\d{1,3}(?:[\u00a0\u202f]\d{3})+(?![\d])|-?\d[\d.,]*\d[km]?|-?\d[km]?/gi;
  function numbersIn(text) {
    return (String(text || '').match(NUM_RE) || []).map((x) => parseNum(x.replace(/[.,]$/, ''))).filter((n) => n != null);
  }
  // "1h 5m", "2d 3h", "45s", "1j 5m" (Indonesian jam), "01:02:03" / "02:03"
  function parseDur(s) {
    if (!s) return null;
    s = String(s);
    const clock = s.match(/(?:^|\s)(?:(\d+):)?(\d{1,2}):(\d{2})(?:\s|$)/);
    if (clock) return ((+(clock[1] || 0) * 60 + +clock[2]) * 60 + +clock[3]) * 1000;
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
  // "C12 · 100:200" (any continent prefix, or none)
  function parseCoord(s) {
    const t = String(s || '');
    const m = t.match(/(\d+)\s*[·•]\s*(\d+)\s*:\s*(\d+)/);
    if (m) return { cont: +m[1], x: +m[2], y: +m[3], key: `${m[2]}:${m[3]}` };
    return null;
  }
  // the visible text pieces of an element in document order (like innerText lines, but without needing layout)
  function textLines(el) {
    const out = [];
    const walk = (n) => {
      for (const c of n.childNodes || []) {
        if (c.nodeType === 3) { const v = c.textContent.replace(/\s+/g, ' ').trim(); if (v) out.push(v); }
        else if (c.nodeType === 1 && !/^(SCRIPT|STYLE|SVG)$/i.test(c.tagName)) walk(c);
      }
    };
    walk(el);
    return out;
  }
  const aria = (el) => (el && el.getAttribute('aria-label')) || '';
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

  // ---------- readers (each returns null when its part of the page is not there) ----------
  function readActiveCity(doc) {
    const chip = doc.querySelector(SEL.cityChip);
    if (!chip) return null;
    const c = parseCoord(text(chip.querySelector(SEL.cityChipSub)));
    if (!c) return null;
    return { ...c, name: text(chip.querySelector(SEL.cityChipName)) || c.key };
  }
  // "<Wood> 34630 <of> 122000, 330 <per hour>" — resource from data-tour, numbers by position (any language)
  function readResources(doc) {
    const res = {};
    doc.querySelectorAll(SEL.resButton).forEach((b) => {
      const k = RES[(b.getAttribute('data-tour') || '').slice(4)];
      if (!k) return;
      const nums = numbersIn(aria(b));
      if (nums.length >= 3) res[k] = { v: nums[0], cap: nums[1], rate: nums[2] };
      else if (nums.length === 2) res[k] = { v: nums[0], rate: nums[1] };
    });
    return Object.keys(res).length ? res : null;
  }
  function readQueueCount(doc) {
    const b = doc.querySelector(SEL.queueFab);
    if (!b) return null;
    const n = numbersIn(b.textContent);
    return n.length ? n[0] : 0;
  }
  function readBuildings(doc) {
    for (const b of doc.querySelectorAll(SEL.cityPill)) {
      const m = text(b).match(/^(\d+)\s*\/\s*(\d+)$/);
      if (m) return { used: +m[1], max: +m[2] };
    }
    return null;
  }
  // Construction panel open → exact finish time of the whole queue and of the first order
  function readQueuePanel(doc, now) {
    const qt = doc.querySelector(`${SEL.sheet} ${SEL.queueTotal}`);
    if (!qt) return null;
    const total = parseDur(text(qt.querySelector(SEL.num)) || text(qt));
    if (total == null) return null;
    const firstMs = parseDur(text(doc.querySelector(`${SEL.sheet} ${SEL.queueItem} ${SEL.queueItemTime}`)));
    return { endsAt: now + total, nextAt: firstMs != null ? now + firstMs : null, count: doc.querySelectorAll(`${SEL.sheet} ${SEL.queueItem}`).length || null };
  }
  function sheetTitle(sheet) {
    const head = sheet.querySelector(SEL.sheetHead);
    return { head, title: text(head && (head.querySelector(SEL.sheetTitle) || head)) };
  }
  // "Your cities": by its English title, or — any language — because its rows are the player's own cities
  function isCityList(sheet, ownKeys) {
    const { title } = sheetTitle(sheet);
    if (LABELS.cityListTitle.test(title)) return true;
    if (!ownKeys || !ownKeys.size) return false;
    const items = [...sheet.querySelectorAll(SEL.listItem)];
    if (!items.length) return false;
    const own = items.filter((li) => { const c = parseCoord(text(li.querySelector(SEL.listSub))); return c && ownKeys.has(c.key); }).length;
    return own >= Math.max(1, Math.ceil(items.length * 0.8));
  }
  function readCityList(sheet) {
    const rows = [];
    sheet.querySelectorAll(SEL.listItem).forEach((li) => {
      const sub = text(li.querySelector(SEL.listSub));
      const c = parseCoord(sub);
      if (!c) return;
      let score = parseNum((sub.match(LABELS.score) || [])[1]);
      let troops = parseNum((sub.match(LABELS.troops) || [])[1]);
      if (score == null && troops == null) {
        // other game language: the two numbers after the coordinates are score and troops
        const rest = numbersIn(sub.slice(sub.indexOf(`${c.x}:${c.y}`) + `${c.x}:${c.y}`.length));
        if (rest.length === 2) [score, troops] = rest;
      }
      rows.push({ ...c, name: text(li.querySelector(SEL.listTitle)), score, troops, group: text(li.querySelector(SEL.listChip)) });
    });
    return rows;
  }
  // Dungeon / boss panel (fallback: dungeons come from the map data). Recognised by its English title, or — any
  // language — because its coordinates are a dungeon/boss known from the map. Guardians, max loot and weakness
  // are not read here: the game computes them from its data tables, and so does the extension (panelInfo).
  function readDungeonPanel(sheet, known) {
    const { head, title } = sheetTitle(sheet);
    if (!head) return null;
    const lines = textLines(sheet);
    const c = parseCoord(text(head.querySelector(SEL.sheetSubtitle))) || parseCoord(lines.join(' '));
    if (!c) return null;
    const m = title.match(LABELS.level);
    const map = known && known.get ? known.get(c.key) : null;
    if (!m && !map) return null;
    if (m && !map && !LABELS.dungeonPanel.test(lines.join(' '))) return null; // some other "… · level N" panel
    const after = (re) => { const i = lines.findIndex((l) => re.test(l)); return i >= 0 ? lines[i + 1] : null; };
    const name = m ? m[1].trim() : null;
    const isDungeon = map ? map.kind !== 'boss' : LABELS.dungeonWord.test(name);
    const rec = {
      key: c.key, cont: c.cont, x: c.x, y: c.y,
      kind: isDungeon ? 'dungeon' : 'boss',
      type: map?.type || (isDungeon ? name.replace(/\s*dungeon\s*/i, '').trim() : name),
      level: m ? +m[2] : map.level,
      explored: parseNum((after(LABELS.explored) || '').replace('%', ''))
    };
    if (rec.explored == null && map?.explored != null) rec.explored = map.explored;
    return rec;
  }
  // building / node icons drawn by the game (English names)
  function readIcons(doc) {
    const names = new Set(ICON_NAMES), found = {};
    const ok = (n, s) => names.has(n) && s && s.startsWith('data:image/') && !found[n];
    doc.querySelectorAll(SEL.buildBarItem).forEach((b) => { const n = b.getAttribute('aria-label'), s = b.querySelector('img')?.getAttribute('src'); if (ok(n, s)) found[n] = s; });
    doc.querySelectorAll('img[alt]').forEach((im) => { const n = im.getAttribute('alt'), s = im.getAttribute('src'); if (ok(n, s)) found[n] = s; });
    doc.querySelectorAll(SEL.sheetHead).forEach((h) => {
      const n = text(h.querySelector(SEL.sheetTitle)).split('·')[0].trim(), s = h.querySelector('img')?.getAttribute('src');
      if (ok(n, s)) found[n] = s;
    });
    return found;
  }

  g.LOU_DOM = { SEL, LABELS, ICON_NAMES, ICON_BY_CODE, parseNum, numbersIn, parseDur, parseCoord, textLines, readActiveCity, readResources, readQueueCount, readBuildings, readQueuePanel, isCityList, readCityList, readDungeonPanel, readIcons, sheetTitle };
})(typeof globalThis !== 'undefined' ? globalThis : self);
