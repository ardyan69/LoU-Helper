// Shared helpers for background, popup and dashboard (ES module).

import { t, locale } from './i18n.js';

export const RES = ['wood', 'stone', 'iron', 'food'];
const RES_SRC = { wood: 'Kayu', stone: 'Batu', iron: 'Besi', food: 'Makanan', gold: 'Emas' };
// translated on access, so it follows the current language
export const RES_LABEL = new Proxy(RES_SRC, { get: (o, k) => (o[k] ? t(o[k]) : o[k]) });
export const RES_ICON = { wood: '🪵', stone: '🪨', iron: '⛏️', food: '🌾', gold: '🪙' };

// Unit power relative to 1 Berserker comes from the classic LoU wiki
// (10 Bers = 15 Rangers = 6 Knights = 7 Mages = 50 Guardians = 9 Paladins
//  = 12 Crossbowmen = 20 Templars = 5 Warlocks).
// Carry and minutes/field are ESTIMATES — the user should correct them from the game.
export const DEFAULT_UNITS = [
  // Real Lord of Ultima: Revival values (game data): carry, base minutes per field, power = attack ÷ 50 (1 Berserker = 1)
  { id: 'berserker', name: 'Berserker', carry: 10, minPerField: 20, power: 1 },
  { id: 'ranger', name: 'Ranger', carry: 10, minPerField: 20, power: 0.6 },
  { id: 'guardian', name: 'Guardian', carry: 20, minPerField: 20, power: 0.2 },
  { id: 'templar', name: 'Templar', carry: 10, minPerField: 20, power: 0.5 },
  { id: 'crossbowman', name: 'Crossbowman', carry: 15, minPerField: 10, power: 0.8 },
  { id: 'knight', name: 'Knight', carry: 15, minPerField: 10, power: 1.8 },
  { id: 'paladin', name: 'Paladin', carry: 20, minPerField: 10, power: 1.2 },
  { id: 'mage', name: 'Mage', carry: 5, minPerField: 20, power: 1.4 },
  { id: 'warlock', name: 'Warlock', carry: 10, minPerField: 10, power: 2.4 },
  { id: 'sloop', name: 'Sloop', carry: 1500, minPerField: 5, power: 24 },
  { id: 'frigate', name: 'Frigate', carry: 1000, minPerField: 5, power: 60 },
  { id: 'war_galleon', name: 'War Galleon', carry: 3000, minPerField: 5, power: 240 }
];
export const UNITS_REV = 2; // bump when DEFAULT_UNITS changes so saved settings are upgraded

// Upgrade units saved by older versions: game values for carry/power/name, keep a calibrated speed.
export function upgradeUnits(saved) {
  const byId = Object.fromEntries((saved || []).map((u) => [u.id === 'xbow' ? 'crossbowman' : u.id, u]));
  const known = new Set(DEFAULT_UNITS.map((u) => u.id));
  return [
    ...DEFAULT_UNITS.map((d) => {
      const o = byId[d.id];
      const calibrated = o && o.minPerField > 0 && ![0, 20, 10, 5].includes(+o.minPerField);
      return { ...d, minPerField: calibrated ? o.minPerField : d.minPerField };
    }),
    ...(saved || []).filter((u) => !known.has(u.id === 'xbow' ? 'crossbowman' : u.id))
  ];
}

// Adjacency bonus rules for the layout planner (estimates, editable in Settings).
// target: building code that receives the bonus; source: neighbour code; pct per neighbour; max: neighbours counted (0 = unlimited)
export const DEFAULT_RULES = [
  { target: 'W', source: 'F', pct: 25, max: 0 },
  { target: 'Q', source: 'R', pct: 25, max: 0 },
  { target: 'I', source: 'O', pct: 25, max: 0 },
  { target: 'A', source: 'L', pct: 25, max: 0 },
  { target: 'W', source: 'C', pct: 30, max: 0 },
  { target: 'Q', source: 'C', pct: 30, max: 0 },
  { target: 'I', source: 'C', pct: 30, max: 0 },
  { target: 'A', source: 'C', pct: 30, max: 0 },
  { target: 'W', source: 'S', pct: 75, max: 1 },
  { target: 'Q', source: 'M', pct: 75, max: 1 },
  { target: 'I', source: 'D', pct: 75, max: 1 },
  { target: 'A', source: 'G', pct: 75, max: 1 },
  { target: 'H', source: 'S', pct: 50, max: 0 },
  { target: 'H', source: 'M', pct: 50, max: 0 },
  { target: 'H', source: 'D', pct: 50, max: 0 },
  { target: 'H', source: 'G', pct: 50, max: 0 },
  { target: 'T', source: 'K', pct: 25, max: 0 },
  { target: 'T', source: 'P', pct: 25, max: 0 },
  { target: 'X', source: 'F', pct: 25, max: 0 }
];

export const DEFAULT_SETTINGS = {
  lang: 'id',
  alerts: { full: true, fullThreshold: 95, queue: true, foodEmpty: true, incoming: true, training: true, trade: false },
  capture: { cities: true, dungeons: true },
  units: DEFAULT_UNITS,
  rules: DEFAULT_RULES,
  layout: { size: 21, buildingLimit: 100 },
  raidOverheadMin: 0, // Revival: raids go straight there and back (classic LoU had ~2h)
  autoSpeed: true // calibrate minutes/field automatically from troop movements
};

export async function getAll() {
  const d = await chrome.storage.local.get(['cities', 'dungeons', 'raids', 'layouts', 'settings', 'layoutFocus', 'movements', 'speedCal', 'history', 'lootLog', 'dungeonGains', 'attackLog', 'players', 'playerNotes']);
  return {
    cities: d.cities || {},
    dungeons: d.dungeons || {},
    raids: d.raids || [],
    layouts: d.layouts || [],
    layoutFocus: d.layoutFocus || null,
    movements: d.movements || null,
    speedCal: d.speedCal || null,
    history: d.history || {},
    lootLog: d.lootLog || { days: {}, byCity: {} },
    dungeonGains: d.dungeonGains || {},
    attackLog: d.attackLog || [],
    players: d.players || {},
    playerNotes: d.playerNotes || {},
    settings: mergeSettings(d.settings)
  };
}

export function mergeSettings(s) {
  s = s || {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    alerts: { ...DEFAULT_SETTINGS.alerts, ...(s.alerts || {}) },
    capture: { ...DEFAULT_SETTINGS.capture, ...(s.capture || {}) },
    layout: { ...DEFAULT_SETTINGS.layout, ...(s.layout || {}) },
    units: !Array.isArray(s.units) || !s.units.length ? DEFAULT_UNITS : (s.unitsRev || 0) < UNITS_REV ? upgradeUnits(s.units) : s.units,
    unitsRev: UNITS_REV,
    // Revival raids have no prepare/unload time: drop the old classic default once
    raidOverheadMin: s.overheadRev ? s.raidOverheadMin ?? 0 : s.raidOverheadMin == null || s.raidOverheadMin === 120 ? 0 : s.raidOverheadMin,
    overheadRev: 1,
    rules: Array.isArray(s.rules) ? s.rules : DEFAULT_RULES
  };
}

export const set = (obj) => chrome.storage.local.set(obj);

// ---------- resource projections ----------

// Current estimated value (resources keep ticking after the snapshot)
export function projected(r, seenAt, now = Date.now()) {
  if (!r) return 0;
  const h = (now - seenAt) / 3.6e6;
  let v = r.v + (r.rate || 0) * h;
  if (r.cap) v = Math.min(r.cap, v);
  return Math.max(0, v);
}

// When does this resource reach `pct`% of capacity (rate>0) or 0 (rate<0)? Returns ms timestamp or null.
export function fullAt(r, seenAt, pct = 100) {
  if (!r || !r.cap || !r.rate) return null;
  if (r.rate > 0) {
    const target = (r.cap * pct) / 100;
    if (r.v >= target) return seenAt;
    return seenAt + ((target - r.v) / r.rate) * 3.6e6;
  }
  return null;
}
export function emptyAt(r, seenAt) {
  if (!r || !(r.rate < 0)) return null;
  return seenAt + (r.v / -r.rate) * 3.6e6;
}

// ---------- formatting ----------
export function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'm';
  if (a >= 1e4) return (n / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k';
  return Math.round(n).toLocaleString(locale());
}
export function fmtDur(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return t('sekarang');
  const m = Math.round(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return t('{d} hari {h}j', { d, h });
  if (h) return t('{h}j {m}m', { h, m: mm });
  return `${mm}m`;
}
export function fmtClock(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const same = new Date().toDateString() === d.toDateString();
  const tm = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return same ? tm : d.toLocaleDateString(locale(), { weekday: 'short' }) + ' ' + tm;
}
export function fmtAgo(ts) {
  if (!ts) return '—';
  const ms = Date.now() - ts;
  if (ms < 60000) return t('baru saja');
  return t('{x} lalu', { x: fmtDur(ms) });
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Recruitment queue -> start/end time of each batch (batches run one after another)
export function trainingTimes(queue, now = Date.now()) {
  let t = now;
  return (queue || []).map((q, i) => {
    const total = (q.perUnitMs || 0) * (q.count || 0);
    const start = q.startAt || (i === 0 ? now : t);
    const end = q.startAt ? q.startAt + total : t + (q.perUnitMs || 0) * Math.max(0, (q.count || 0) - (q.done || 0));
    const nextUnit = q.startAt ? q.startAt + (q.perUnitMs || 0) * ((q.done || 0) + 1) : null;
    t = Math.max(t, end);
    return { ...q, start, end, nextUnit, active: !!q.startAt };
  });
}
export const unitName = (u) => String(u || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
