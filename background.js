// LoU Revival Helper — background service worker: schedules alarms and shows desktop notifications.
import './lib/compat.js'; // must stay the first import (Firefox/Safari: chrome → browser)
import { RES_LABEL, uid, unitName, storageUsage } from './lib/shared.js';
import { parseShareString, fromGame, isBuilding, N } from './lib/city.js';
import { initLang, t, locale } from './lib/i18n.js';
import { updateCalibration, applyFactor } from './lib/speedcal.js';
import { snapshotCities, trackLoot, logIncoming, compactHistory, prunePlayers, pruneGains } from './lib/history.js';
import { recordScores } from './lib/intel.js';
import { guessUnits } from './lib/unitguess.js';
import { computeEvents, notFired, splitDue, groupDue, groupIncoming, summarizeWaves, MIN_AHEAD, MAX_SINGLE } from './lib/alerts.js';
import { mergeSettings } from './lib/shared.js';

// reads of our own JSON data (typed `any` for the type checker)
/** @param {string | string[] | null} keys @returns {Promise<Record<string, any>>} */
const getLocal = (keys) => chrome.storage.local.get(keys);

// A share string copied in the game becomes (or refreshes) that city's "from game" layout.
// Live sync: the active city's real layout (with levels and build queue) from the game's city view.
// Batched: when the game is opened, every city's layout arrives at once (one message per city); they are
// collected for 100 ms and saved with one read + write of `layouts` instead of one per city.
/** @type {Promise<any>} */
let syncChain = Promise.resolve();
let layoutBatch = [], layoutTimer = null;
function saveLiveLayout(msg) {
  return new Promise((resolve, reject) => {
    layoutBatch.push({ msg, resolve, reject });
    if (!layoutTimer) layoutTimer = setTimeout(flushLayouts, 100);
  });
}
function flushLayouts() {
  layoutTimer = null;
  const batch = layoutBatch;
  layoutBatch = [];
  syncChain = syncChain.catch(() => {}).then(async () => {
    await initLang();
    const { layouts = [] } = await getLocal('layouts');
    const now = Date.now();
    const results = batch.map(({ msg }) => {
      const p = fromGame(msg.cells, msg.levels || [], msg.city?.water);
      const key = msg.city?.key || null;
      const queue = (msg.queue || []).map((q) => ({ slot: q.slot, type: q.type, kind: q.kind, toLevel: q.toLevel, endAt: q.endAt, durationMs: q.durationMs }));
      let l = layouts.find((x) => x.source === 'game' && x.cityKey === key && x.v === 2);
      const created = !l;
      if (l) {
        Object.assign(l, { cells: p.cells, levels: p.levels, water: p.water, queue, live: true, capturedAt: now, updatedAt: now, cityName: msg.city?.name || l.cityName });
        // keep the auto-generated name in the current UI language
        if (l.cityName && l.name.startsWith(l.cityName + ' — ')) l.name = `${l.cityName} — ${t('kondisi di game')}`;
      } else {
        l = { ...p, id: uid(), name: `${msg.city?.name || t('Kota')} — ${t('kondisi di game')}`, source: 'game', live: true, queue, cityKey: key, cityName: msg.city?.name || null, capturedAt: now, updatedAt: now };
        layouts.push(l);
      }
      return { ok: true, created };
    });
    await chrome.storage.local.set({ layouts });
    batch.forEach((b, i) => b.resolve(results[i]));
  }).catch((e) => batch.forEach((b) => b.reject(e)));
  return syncChain;
}

// on the same chain as the live sync, so the two never overwrite each other's `layouts`
function saveCapturedLayout(text, city) {
  const run = syncChain.catch(() => {}).then(() => saveCapturedLayoutNow(text, city));
  syncChain = run;
  return run;
}
async function saveCapturedLayoutNow(text, city) {
  await initLang();
  const p = parseShareString(text);
  if (!p) return { ok: false };
  const { layouts = [] } = await getLocal('layouts');
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

// ---- alert schedule: ONE alarm ("next") at the earliest pending event (see lib/alerts.js) ----
// The plan lives in storage.session (cleared when the browser closes; not part of the user's data).
const planArea = () => chrome.storage.session || chrome.storage.local;
const KEEP_ALARMS = new Set(['history', 'next']);

let lastPlanSig = null; // the plan only changes when a city's numbers or a queue changed
async function reschedule() {
  const d = await getLocal(['cities', 'settings', 'movements']);
  const settings = mergeSettings(d.settings);
  const now = Date.now();
  const { alertFired: fired = {} } = await planArea().get('alertFired');
  const plan = notFired(computeEvents({ cities: d.cities || {}, settings, movements: d.movements }, now), fired);
  const planSig = JSON.stringify(plan);
  if (planSig !== lastPlanSig) { lastPlanSig = planSig; await planArea().set({ alertPlan: plan }); }

  const existing = await chrome.alarms.getAll();
  if (!existing.some((al) => al.name === 'history')) chrome.alarms.create('history', { delayInMinutes: 1, periodInMinutes: 60 });
  // alarms of older versions (one per city × resource) are no longer used
  for (const al of existing) if (!KEEP_ALARMS.has(al.name)) await chrome.alarms.clear(al.name);
  const cur = existing.find((al) => al.name === 'next');
  if (!plan.length) { if (cur) await chrome.alarms.clear('next'); return; }
  const when = Math.max(plan[0].when, now + MIN_AHEAD);
  if (!cur || Math.abs(cur.scheduledTime - when) > 15000) chrome.alarms.create('next', { when });
}

// the "next" alarm: show everything that is due now (grouped), then schedule the following event
let fireChain = Promise.resolve();
function fireDue() {
  fireChain = fireChain.catch(() => {}).then(async () => {
    const now = Date.now();
    const { alertPlan = [], alertFired = {} } = await planArea().get(['alertPlan', 'alertFired']);
    const { due, rest } = splitDue(alertPlan, now);
    const fired = {};
    for (const [k, v] of Object.entries(alertFired)) if (v > now - 864e5) fired[k] = v;
    for (const e of due) fired[e.name] = e.when;
    await planArea().set({ alertPlan: rest, alertFired: fired });
    lastPlanSig = null;
    if (due.length) await notifyDue(due);
    await reschedule();
  });
  return fireChain;
}

const listNames = (names) => (names.length > 6 ? `${names.slice(0, 6).join(', ')}…` : names.join(', '));

async function notifyDue(due) {
  await initLang();
  const g = groupDue(due);
  const d = await getLocal(['cities', 'settings', 'movements']);
  const cities = d.cities || {};
  const settings = mergeSettings(d.settings);
  const mv = d.movements || {};
  const cname = (key) => (cities[key] ? `${cities[key].name} (${key})` : key);
  const short = (key) => cities[key]?.name || key;

  // warehouse almost full: one notification per city with all its resources, or one summary
  const full = [...g.full.entries()].filter(([key]) => cities[key]);
  if (full.length > MAX_SINGLE) {
    notify('full-multi', t('Gudang hampir penuh di {n} kota', { n: full.length }),
      listNames(full.map(([key, rs]) => `${short(key)} (${rs.map((r) => RES_LABEL[r]).join(', ')})`)));
  } else for (const [key, rs] of full) {
    notify(`full|${key}`, t('Gudang hampir penuh — {c}', { c: cname(key) }),
      t('{r} sudah mencapai ~{p}% kapasitas. Belanjakan atau kirim sebelum produksi terbuang.', { r: rs.map((r) => RES_LABEL[r]).join(', '), p: settings.alerts.fullThreshold }));
  }

  const empty = g.empty.filter((k) => cities[k]);
  if (empty.length > MAX_SINGLE) notify('empty-multi', t('Makanan habis di {n} kota', { n: empty.length }), listNames(empty.map(short)), 2);
  else for (const key of empty) notify(`empty|${key}`, t('Makanan habis — {c}', { c: cname(key) }), t('Produksi makanan negatif dan stok diperkirakan habis sekarang. Pasukan bisa kelaparan.'), 2);

  const queue = g.queue.filter((k) => cities[k]);
  if (queue.length > MAX_SINGLE) notify('queue-multi', t('Antrian bangunan selesai di {n} kota', { n: queue.length }), listNames(queue.map(short)));
  else for (const key of queue) notify(`queue|${key}`, t('Antrian bangunan selesai — {c}', { c: cname(key) }), t('Semua order konstruksi diperkirakan sudah selesai. Saatnya isi antrian lagi.'));

  const train = g.train.map((id) => (mv.training || []).find((x) => String(x.id) === id) || { id, name: null, queue: [] });
  if (train.length > MAX_SINGLE) notify('train-multi', t('Pelatihan pasukan selesai di {n} kota', { n: train.length }), listNames(train.map((c) => c.name || t('kota'))));
  else for (const c of train) {
    const units = (c.queue || []).map((q) => `${q.count}× ${unitName(q.unit)}`).join(', ');
    notify(`train|${c.id}`, t('Pelatihan pasukan selesai — {c}', { c: c.name || t('kota') }), units ? t('{u} siap. Antrian rekrutmen kosong.', { u: units }) : t('Antrian rekrutmen kosong.'));
  }

  const trade = g.trade.map((id) => (mv.armies || []).find((x) => String(x.id) === id) || null);
  const tgt = (tv) => tv?.target?.name || (tv ? `${tv.toX}:${tv.toY}` : '');
  if (trade.length > MAX_SINGLE) notify('trade-multi', t('{n} kiriman dagang tiba', { n: trade.length }), listNames([...new Set(trade.map(tgt).filter(Boolean))]));
  else for (const tv of trade) {
    notify(`trade|${tv?.id}`, t('Kiriman dagang tiba — {x}', { x: tgt(tv) }), tv ? t('{n} resource dari {f}', { n: tv.tradeLoad || '', f: tv.home?.name || `${tv.fromX}:${tv.fromY}` }) : t('Konvoi dagang sudah tiba.'));
  }
}

let timer = null;
function debounceReschedule() {
  clearTimeout(timer);
  timer = setTimeout(() => reschedule().catch(console.warn), 1500);
}

// While the game is open, `movements` is rewritten every few seconds, mostly because a unit finished training
// (the done-count ticks). Only the parts each job needs are compared, so the jobs run when those changed:
//  - alert schedule: recruitment queues (without the done-count) and trade convoys
//  - speed calibration, loot & attack history: armies (id, mission, times) and incoming attack ids
const alertMvSig = (mv) => JSON.stringify([
  (mv.training || []).map((c) => [c.id, (c.queue || []).map((q) => [q.unit, q.count, q.startAt, q.perUnitMs])]),
  (mv.armies || []).filter((a) => a.trade).map((a) => [a.id, a.order, a.arriveAt]),
  Math.round((mv.serverOffset || 0) / 30000)
]);
const armySig = (mv) => JSON.stringify([(mv.armies || []).map((a) => [a.id, a.order, a.departAt, a.arriveAt]), (mv.incoming || []).map((a) => a.id)]);
let lastAlertMvSig = null, lastArmySig = null;
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  let resched = !!(ch.cities || ch.settings);
  if ('movements' in ch) {
    const mv = ch.movements.newValue || {};
    const a = alertMvSig(mv);
    if (a !== lastAlertMvSig) { lastAlertMvSig = a; resched = true; }
    const b = armySig(mv);
    if (ch.movements.newValue && b !== lastArmySig) {
      lastArmySig = b;
      calibrate(mv).catch(console.warn);
      trackMovements(mv).catch(console.warn);
    }
  }
  if (resched) debounceReschedule();
  if ('players' in ch) scheduleIntel();
});

// 📈 player activity: total score per player over time (debounced: the map sends many updates while scrolling)
let intelTimer = null;
function scheduleIntel() { clearTimeout(intelTimer); intelTimer = setTimeout(() => updateIntel().catch(console.warn), 8000); }
async function updateIntel() {
  const d = await getLocal(['players', 'playerHistory']);
  const h = recordScores(d.playerHistory, d.players);
  if (h) await chrome.storage.local.set({ playerHistory: h });
}

// Loot per day / per city, explored % gained per dungeon, incoming attack history
let trackChain = Promise.resolve();
function trackMovements(mv) {
  trackChain = trackChain.catch(() => {}).then(async () => {
    const d = await getLocal(['lootLog', 'dungeonGains', 'dungeons', 'attackLog']);
    const patch = {};
    const r = trackLoot(d.lootLog, d.dungeonGains, d.dungeons, mv);
    if (r) { patch.lootLog = r.log; patch.dungeonGains = r.gains; }
    const al = logIncoming(d.attackLog, mv);
    if (al) patch.attackLog = al;
    if (Object.keys(patch).length) await chrome.storage.local.set(patch);
  });
  return trackChain;
}
// hourly: a city snapshot for the statistics, then keep the stored data small
// (older history merged per day, map cities not seen for 90 days and stale dungeon gains dropped)
async function hourlyMaintenance() {
  const d = await getLocal(['cities', 'history']);
  await chrome.storage.local.set({ history: snapshotCities(d.history, d.cities) });
  await compactStorage();
  await updateIntel();
}
let compactChain = Promise.resolve();
function compactStorage() {
  compactChain = compactChain.catch(() => {}).then(async () => {
    const d = await getLocal(['history', 'players', 'dungeonGains']);
    const patch = { history: compactHistory(d.history) };
    const p = prunePlayers(d.players);
    if (p) patch.players = p;
    const g = pruneGains(d.dungeonGains);
    if (g) patch.dungeonGains = g;
    await chrome.storage.local.set(patch);
  });
  return compactChain;
}

// Auto speed calibration: real minutes/field from the armies currently on the move.
let calChain = Promise.resolve();
function calibrate(mv) {
  calChain = calChain.catch(() => {}).then(async () => {
    const d = await getLocal(['speedCal', 'settings']);
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
  compactStorage().catch(console.warn); // shrink data saved by older versions (hourly history for 60 days)
  // After an update the old content script in open game tabs stops working; inject the new one
  // so the city overview keeps updating without the user having to refresh the game.
  const tabs = await chrome.tabs.query({ url: GAME_URL + '*' });
  for (const t of tabs) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['page-hook.js'], world: 'MAIN' });
      await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['lib/compat.js', 'lib/i18n/content-dict.js', 'lib/game-dom.js', 'content.js'] });
    } catch (e) { console.warn('[LoU Helper] inject failed', e); }
  }
});
chrome.runtime.onStartup.addListener(debounceReschedule);

// desktop notifications: not available in Safari; Firefox does not accept `priority` / `requireInteraction`
function notifyRaw(id, opts) {
  if (!chrome.notifications?.create) return;
  const plain = () => { const { priority, requireInteraction, ...rest } = opts; void priority; void requireInteraction; try { const q = chrome.notifications.create(id, rest); q?.catch?.(() => {}); } catch (_) { /* no notifications */ } };
  try {
    const p = chrome.notifications.create(id, opts);
    if (p?.catch) p.catch(plain);
  } catch (_) { plain(); }
}
// `id` is stable per subject: a newer notification with the same id replaces the old one instead of piling up
function notify(id, title, message, priority = 1, extra = {}) {
  notifyRaw(id, { type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority, ...extra });
}
const fmtTime = (ts) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

// Incoming attacks: one notification per (target city, attacker); more waves update that same notification
let incChain = Promise.resolve();
const incSeenMem = new Set(); // army ids already handled by this worker: skip the storage reads for repeats
function onIncoming(list, off = 0) {
  if ((list || []).every((a) => !a?.id || incSeenMem.has(a.id))) return incChain;
  incChain = incChain.catch(() => {}).then(async () => {
    const d = await getLocal(['settings', 'incomingAlerts', 'incomingSeen']);
    if (!mergeSettings(d.settings).alerts.incoming) return;
    const prev = d.incomingAlerts || { seen: { ...(d.incomingSeen || {}) }, groups: {} }; // incomingSeen: before v1.20.1
    // arrival times in local time (the game sends server time)
    const { speedCal, movements } = await getLocal(['speedCal', 'movements']);
    const factor = speedCal?.factor || 1 / (movements?.worldSpeed || 1);
    const local = (list || []).map((a) => {
      const g = a.units && Object.keys(a.units).length ? null : guessUnits(a, factor);
      return { ...a, arriveAt: a.arriveAt ? a.arriveAt - off : null, guess: g?.best ? g.best.names.join('/') : null };
    });
    const { state, changed } = groupIncoming(prev, local);
    for (const a of local) if (a?.id) incSeenMem.add(a.id);
    if (!changed.length) return;
    await initLang();
    for (const gid of changed) {
      const gr = state.groups[gid];
      const target = gr.target ? `${gr.target} (${gr.toX}:${gr.toY})` : `${gr.toX}:${gr.toY}`;
      const s = summarizeWaves(gr.waves);
      const guess = gr.waves.map((w) => w.guess).find(Boolean);
      const at = s.first ? (s.last && s.last - s.first >= 60000 ? `${fmtTime(s.first)}–${fmtTime(s.last)}` : fmtTime(s.first)) : '?';
      const title = '⚠️ ' + (gr.waves.length > 1 ? t('{n} serangan masuk ke {x}', { n: gr.waves.length, x: target }) : t('Serangan masuk ke {x}', { x: target }));
      const msg = t('{o} ({m}) dari {f} · tiba {at}', { o: gr.owner || t('Pemain lain'), m: s.orders, f: s.from, at });
      notify(`incoming|${gid}`, title, guess ? `${msg}\n${t('Kemungkinan: {u}', { u: guess })}` : msg, 2, { requireInteraction: true });
    }
    const patch = { incomingAlerts: state };
    await chrome.storage.local.set(patch);
    if (d.incomingSeen) await chrome.storage.local.remove('incomingSeen');
  });
  return incChain;
}

chrome.alarms.onAlarm.addListener(async (al) => {
  if (al.name === 'history') { await hourlyMaintenance().catch(console.warn); return; }
  if (al.name === 'next') { await fireDue().catch(console.warn); return; }
  // an alarm left over from an older version (one alarm per event): the plan covers it now
  await chrome.alarms.clear(al.name);
  debounceReschedule();
});

chrome.notifications?.onClicked.addListener(async (id) => {
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
      notifyRaw('test|' + Date.now(), {
        type: 'basic', iconUrl: 'icons/icon128.png',
        title: 'LoU Helper — ' + t('tes notifikasi'), message: t('Notifikasi desktop berfungsi.') + ' 👍'
      });
      reply({ ok: true });
    });
  }
  if (msg?.type === 'reschedule') reschedule().then(() => reply({ ok: true }));
  if (msg?.type === 'incoming') onIncoming(msg.list || [], msg.off || 0).then(() => reply({ ok: true }), () => reply({ ok: false }));
  if (msg?.type === 'compact-storage') {
    storageUsage().then(async (before) => { await compactStorage(); const after = await storageUsage(); reply({ ok: true, before: before.total, after: after.total }); },
      (e) => reply({ ok: false, error: String(e) }));
  }
  if (msg?.type === 'city-layout') saveLiveLayout(msg).then(reply, (e) => reply({ ok: false, error: String(e) }));
  if (msg?.type === 'share-captured') saveCapturedLayout(msg.text, msg.city).then(reply, (e) => reply({ ok: false, error: String(e) }));
  return true;
});
