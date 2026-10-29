// LoU Revival Helper — background service worker: schedules alarms and shows desktop notifications.
import { getAll, fullAt, emptyAt, RES, RES_LABEL, uid, trainingTimes, unitName } from './lib/shared.js';
import { parseShareString, fromGame, isBuilding, N } from './lib/city.js';
import { initLang, t, locale } from './lib/i18n.js';
import { updateCalibration, applyFactor } from './lib/speedcal.js';
import { snapshotCities, trackLoot, logIncoming } from './lib/history.js';
import { mergeSettings } from './lib/shared.js';

// A share string copied in the game becomes (or refreshes) that city's "from game" layout.
// Live sync: the active city's real layout (with levels and build queue) from the game's city view.
let syncChain = Promise.resolve();
function saveLiveLayout(msg) {
  syncChain = syncChain.catch(() => {}).then(async () => {
    await initLang();
    const p = fromGame(msg.cells, msg.levels || [], msg.city?.water);
    const { layouts = [] } = await chrome.storage.local.get('layouts');
    const key = msg.city?.key || null;
    const now = Date.now();
    const queue = (msg.queue || []).map((q) => ({ slot: q.slot, type: q.type, kind: q.kind, toLevel: q.toLevel, endAt: q.endAt, durationMs: q.durationMs }));
    let l = layouts.find((x) => x.source === 'game' && x.cityKey === key && x.v === 2);
    const created = !l;
    if (l) {
      Object.assign(l, { cells: p.cells, levels: p.levels, water: p.water, queue, live: true, capturedAt: now, updatedAt: now, cityName: msg.city?.name || l.cityName });
      // keep the auto-generated name in the current UI language
      if (l.cityName && l.name.startsWith(l.cityName + ' — ')) l.name = `${l.cityName} — ${t('kondisi di game')}`;
    }
    else {
      l = { ...p, id: uid(), name: `${msg.city?.name || t('Kota')} — ${t('kondisi di game')}`, source: 'game', live: true, queue, cityKey: key, cityName: msg.city?.name || null, capturedAt: now, updatedAt: now };
      layouts.push(l);
    }
    await chrome.storage.local.set({ layouts });
    return { ok: true, created };
  });
  return syncChain;
}

async function saveCapturedLayout(text, city) {
  await initLang();
  const p = parseShareString(text);
  if (!p) return { ok: false };
  const { layouts = [] } = await chrome.storage.local.get('layouts');
  const now = Date.now();
  const key = city?.key || null;
  let l = layouts.find((x) => x.source === 'game' && x.cityKey === key && x.v === 2);
  if (l) {
    // keep levels the user already set where the same building still stands
    const levels = p.levels.map((v, i) => (isBuilding(p.cells[i]) && l.cells[i] === p.cells[i] && l.levels?.[i] ? l.levels[i] : v));
    Object.assign(l, { cells: p.cells, water: p.water, levels, capturedAt: now, updatedAt: now, cityName: city?.name || l.cityName });
  } else {
    l = { ...p, id: uid(), name: `${city?.name || t('Kota')} — ${t('kondisi di game')}`, source: 'game', cityKey: key, cityName: city?.name || null, capturedAt: now, updatedAt: now };
    layouts.push(l);
  }
  await chrome.storage.local.set({ layouts, layoutFocus: l.id });
  return { ok: true, id: l.id, cells: N * N };
}

const GAME_URL = 'https://lordofultima.me/';
const MIN_AHEAD = 30 * 1000;

async function reschedule() {
  const { cities, settings } = await getAll();
  const a = settings.alerts;
  const existing = await chrome.alarms.getAll();
  const want = new Map();
  const now = Date.now();

  for (const c of Object.values(cities)) {
    if (!c.res || !c.seenAt) continue;
    if (a.full) {
      for (const r of RES) {
        const t = fullAt(c.res[r], c.seenAt, a.fullThreshold);
        if (t && t > now + MIN_AHEAD) want.set(`full|${c.key}|${r}`, t);
      }
    }
    if (a.foodEmpty) {
      const t = emptyAt(c.res.food, c.seenAt);
      if (t && t > now + MIN_AHEAD) want.set(`empty|${c.key}|food`, t);
    }
    if (a.queue && c.queue?.endsAt && c.queue.endsAt > now + MIN_AHEAD) {
      want.set(`queue|${c.key}`, c.queue.endsAt);
    }
  }

  // armies / trades / recruitment
  const { movements: mv } = await chrome.storage.local.get('movements');
  if (mv) {
    const off = mv.serverOffset || 0; // server time = local time + offset
    if (a.training) for (const c of mv.training || []) {
      const items = trainingTimes(c.queue, now + off);
      const last = items[items.length - 1];
      if (last && last.end - off > now + MIN_AHEAD) want.set(`train|${c.id}`, last.end - off);
    }
    if (a.trade) for (const t of mv.armies || []) {
      if (t.trade && t.order !== 'return' && t.arriveAt && t.arriveAt - off > now + MIN_AHEAD) want.set(`trade|${t.id}`, t.arriveAt - off);
    }
  }

  if (!existing.some((al) => al.name === 'history')) {
    chrome.alarms.create('history', { delayInMinutes: 1, periodInMinutes: 60 });
  }
  for (const al of existing) {
    if (al.name === 'history') continue;
    const t = want.get(al.name);
    if (t == null) await chrome.alarms.clear(al.name);
    else if (Math.abs(al.scheduledTime - t) < 60000) want.delete(al.name); // already scheduled ~same time
  }
  for (const [name, when] of want) chrome.alarms.create(name, { when });
}

let timer = null;
function debounceReschedule() {
  clearTimeout(timer);
  timer = setTimeout(() => reschedule().catch(console.warn), 1500);
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area === 'local' && (ch.cities || ch.settings || ch.movements)) debounceReschedule();
  if (area === 'local' && ch.movements?.newValue) { calibrate(ch.movements.newValue).catch(console.warn); trackMovements(ch.movements.newValue).catch(console.warn); }
});

// Loot per day / per city, explored % gained per dungeon, incoming attack history
let trackChain = Promise.resolve();
function trackMovements(mv) {
  trackChain = trackChain.catch(() => {}).then(async () => {
    const d = await chrome.storage.local.get(['lootLog', 'dungeonGains', 'dungeons', 'attackLog']);
    const patch = {};
    const r = trackLoot(d.lootLog, d.dungeonGains, d.dungeons, mv);
    if (r) { patch.lootLog = r.log; patch.dungeonGains = r.gains; }
    const al = logIncoming(d.attackLog, mv);
    if (al) patch.attackLog = al;
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  });
  return trackChain;
}
async function snapshotHistory() {
  const d = await chrome.storage.local.get(['cities', 'history']);
  const h = snapshotCities(d.history, d.cities);
  await chrome.storage.local.set({ history: h });
}

// Auto speed calibration: real minutes/field from the armies currently on the move.
let calChain = Promise.resolve();
function calibrate(mv) {
  calChain = calChain.catch(() => {}).then(async () => {
    const d = await chrome.storage.local.get(['speedCal', 'settings']);
    const cal = updateCalibration(d.speedCal, mv.armies);
    if (!cal) return;
    const patch = { speedCal: cal };
    const s = mergeSettings(d.settings);
    if (s.autoSpeed !== false && cal.factor) {
      const units = applyFactor(s.units, cal.factor);
      if (units) patch.settings = { ...(d.settings || {}), units, unitsRev: s.unitsRev };
    }
    await chrome.storage.local.set(patch);
  });
  return calChain;
}
chrome.runtime.onInstalled.addListener(async () => {
  debounceReschedule();
  // After an update the old content script in open game tabs stops working; inject the new one
  // so the city overview keeps updating without the user having to refresh the game.
  const tabs = await chrome.tabs.query({ url: GAME_URL + '*' });
  for (const t of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['page-hook.js'], world: 'MAIN' });
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['lib/i18n/content-dict.js', 'content.js'] });
    } catch (e) { console.warn('[LoU Helper] inject failed', e); }
  }
});
chrome.runtime.onStartup.addListener(debounceReschedule);

function notify(id, title, message, priority = 1) {
  chrome.notifications.create(id + '|' + Date.now(), { type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority });
}
const fmtTime = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

// Incoming attack: notify once per army
async function onIncoming(list) {
  const { settings } = await getAll();
  if (!settings.alerts.incoming) return;
  await initLang();
  const { incomingSeen = {} } = await chrome.storage.local.get('incomingSeen');
  const now = Date.now();
  for (const k of Object.keys(incomingSeen)) if (incomingSeen[k] < now - 864e5) delete incomingSeen[k];
  for (const a of list) {
    if (incomingSeen[a.id]) continue;
    incomingSeen[a.id] = a.arriveAt || now;
    const target = a.target?.name ? `${a.target.name} (${a.toX}:${a.toY})` : `${a.toX}:${a.toY}`;
    notify('incoming', '⚠️ ' + t('Serangan masuk ke {x}', { x: target }), t('{o} ({m}) dari {f} · tiba {at}', { o: a.owner || t('Pemain lain'), m: a.order || 'attack', f: `${a.fromX}:${a.fromY}`, at: a.arriveAt ? fmtTime(a.arriveAt) : '?' }), 2);
  }
  await chrome.storage.local.set({ incomingSeen });
}

chrome.alarms.onAlarm.addListener(async (al) => {
  if (al.name === 'history') { await snapshotHistory().catch(console.warn); return; }
  const [kind, key, res] = al.name.split('|');
  await initLang();
  if (kind === 'train' || kind === 'trade') {
    const { movements: mv } = await chrome.storage.local.get('movements');
    if (kind === 'train') {
      const c = (mv?.training || []).find((x) => x.id === key);
      const units = (c?.queue || []).map((q) => `${q.count}× ${unitName(q.unit)}`).join(', ');
      notify(al.name, t('Pelatihan pasukan selesai — {c}', { c: c?.name || t('kota') }), units ? t('{u} siap. Antrian rekrutmen kosong.', { u: units }) : t('Antrian rekrutmen kosong.'));
    } else {
      const tv = (mv?.armies || []).find((x) => x.id === key);
      notify(al.name, t('Kiriman dagang tiba — {x}', { x: tv?.target?.name || (tv ? `${tv.toX}:${tv.toY}` : '') }), tv ? t('{n} resource dari {f}', { n: tv.tradeLoad || '', f: tv.home?.name || `${tv.fromX}:${tv.fromY}` }) : t('Konvoi dagang sudah tiba.'));
    }
    return;
  }
  const { cities, settings } = await getAll();
  const c = cities[key];
  if (!c) return;
  const name = `${c.name} (${key})`;
  let title, message;
  if (kind === 'full') {
    title = t('Gudang hampir penuh — {c}', { c: name });
    message = t('{r} sudah mencapai ~{p}% kapasitas. Belanjakan atau kirim sebelum produksi terbuang.', { r: RES_LABEL[res], p: settings.alerts.fullThreshold });
  } else if (kind === 'empty') {
    title = t('Makanan habis — {c}', { c: name });
    message = t('Produksi makanan negatif dan stok diperkirakan habis sekarang. Pasukan bisa kelaparan.');
  } else if (kind === 'queue') {
    title = t('Antrian bangunan selesai — {c}', { c: name });
    message = t('Semua order konstruksi diperkirakan sudah selesai. Saatnya isi antrian lagi.');
  } else return;
  chrome.notifications.create(al.name + '|' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 1
  });
});

chrome.notifications.onClicked.addListener(async (id) => {
  chrome.notifications.clear(id);
  const tabs = await chrome.tabs.query({ url: GAME_URL + '*' });
  if (tabs[0]) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: GAME_URL });
  }
});

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg?.type === 'test-notification') {
    initLang().then(() => {
      chrome.notifications.create('test|' + Date.now(), {
        type: 'basic', iconUrl: 'icons/icon128.png',
        title: 'LoU Helper — ' + t('tes notifikasi'), message: t('Notifikasi desktop berfungsi.') + ' 👍'
      });
      reply({ ok: true });
    });
  }
  if (msg?.type === 'reschedule') reschedule().then(() => reply({ ok: true }));
  if (msg?.type === 'incoming') onIncoming(msg.list || []).then(() => reply({ ok: true }), () => reply({ ok: false }));
  if (msg?.type === 'city-layout') saveLiveLayout(msg).then(reply, (e) => reply({ ok: false, error: String(e) }));
  if (msg?.type === 'share-captured') saveCapturedLayout(msg.text, msg.city).then(reply, (e) => reply({ ok: false, error: String(e) }));
  return true;
});
