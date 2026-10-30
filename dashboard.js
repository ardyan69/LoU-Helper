import './lib/compat.js'; // must stay the first import (Firefox/Safari: chrome → browser)
import { getAll, set, fmtAgo, applyChanges } from './lib/shared.js';
import * as cities from './views/cities.js';
import * as layout from './views/layout.js';
import * as dungeon from './views/dungeon.js';
import * as settings from './views/settings.js';
import * as movements from './views/movements.js';
import * as about from './views/about.js';
import * as cheat from './views/cheatsheet.js';
import * as stats from './views/stats.js';
import * as players from './views/players.js';
import * as ops from './views/ops.js';
import * as ministers from './views/ministers.js';
import * as palette from './views/palette.js';
import * as todo from './views/todo.js';
import * as timeline from './views/timeline.js';
import { loadIcons } from './lib/icons.js';
import { initLang, t, locale } from './lib/i18n.js';
import { applyTheme } from './lib/theme.js';

const NAV = { kota: ['🏰', 'Ringkasan Kota'], todo: ['✅', 'To-do'], timeline: ['🗓️', 'Timeline'], layout: ['📐', 'Perencana Layout'], gerak: ['🚩', 'Pergerakan'], operasi: ['🎯', 'Operasi'], menteri: ['🎩', 'Set Ministers'], dungeon: ['⚔️', 'Dungeon & Boss'], statistik: ['📈', 'Statistik'], pemain: ['👥', 'Pemain'], pengaturan: ['⚙️', 'Pengaturan'], cheat: ['📜', 'Cheat Sheet'], tentang: ['ℹ️', 'Tentang'] };
// the menu in groups (Alt+1…9 / Alt+0 open the tabs in this order)
const mark = (x) => x; // texts translated later through t(variable): marked for the translation check
const GROUPS = [[null, ['kota', 'todo']], [mark('Militer'), ['gerak', 'timeline', 'operasi', 'dungeon']], [mark('Intel'), ['pemain', 'statistik']], [mark('Alat'), ['layout', 'menteri', 'cheat']], [null, ['pengaturan', 'tentang']]];
const ORDER = GROUPS.flatMap(([, v]) => v);
function translateChrome() {
  const nav = document.querySelector('nav.tabs');
  nav.innerHTML = GROUPS.map(([g, list]) => `<span class="nav-grp"${g ? ` data-grp="${t(g)}"` : ''}>${list.map((v) => {
    const [ico, label] = NAV[v];
    const n = ORDER.indexOf(v) + 1;
    return `<a href="#${v}" data-view="${v}" title="${t(label)}${n <= 10 ? ` · Alt+${n % 10}` : ''}">${ico} ${t(label)}${v === 'gerak' ? ' <span class="nav-badge hide" id="nav-inc"></span>' : v === 'todo' ? ' <span class="nav-badge hide" id="nav-todo"></span>' : ''}</a>`;
  }).join('')}</span>`).join('');
  const search = document.getElementById('nav-search');
  if (search) { search.innerHTML = `🔎 <span class="hide-sm">${t('Cari')}</span> <kbd>Ctrl K</kbd>`; search.title = t('Cari kota, pemain, dungeon, koordinat, layout, menu…'); }
  const foot = document.querySelector('.app-foot');
  if (foot) foot.innerHTML = `LoU Revival Helper · ${t('dibuat oleh')} <a href="#tentang">ardhie</a> · <a href="mailto:ardhie.andro@gmail.com">ardhie.andro@gmail.com</a>`;
}

const views = { kota: cities, todo, timeline, layout, gerak: movements, operasi: ops, menteri: ministers, dungeon, statistik: stats, pemain: players, pengaturan: settings, cheat, tentang: about };
document.getElementById('ver').textContent = 'v' + chrome.runtime.getManifest().version;
const mounted = {};
const ctx = {
  state: null,
  async save(patch) {
    Object.assign(ctx.state, patch);
    await set(patch);
  },
  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('on'), 2200);
  },
  go(view) { location.hash = view; }
};

// "#view", "#view/arg" (search, popup: the view's focus(arg)), legacy "#tentang:diag"
function route() {
  const h = location.hash.slice(1);
  const i = h.search(/[/:]/);
  const v = i < 0 ? h : h.slice(0, i);
  let arg = i < 0 ? '' : h.slice(i + 1);
  try { arg = decodeURIComponent(arg); } catch { /* keep as is */ }
  return { view: views[v] ? v : 'kota', arg };
}
function current() { return route().view; }

function show() {
  const { view: name, arg } = route();
  document.querySelectorAll('nav.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.view === name));
  document.querySelectorAll('section.view').forEach((s) => s.classList.toggle('on', s.id === 'view-' + name));
  document.body.dataset.view = name; // lets a view use a wider page (CSS)
  const el = document.getElementById('view-' + name);
  if (!mounted[name]) {
    views[name].mount(el, ctx);
    mounted[name] = true;
  }
  views[name].render?.(ctx.state);
  if (arg && views[name].focus) setTimeout(() => views[name].focus(arg), 30);
}

// 🕐 server clock (the game's time: local clock + the server offset read from the game) — for timing attacks
function tickClock() {
  const el = document.getElementById('srv-clock');
  if (!el || !ctx.state) return;
  const off = ctx.state.movements?.serverOffset || 0;
  el.textContent = `🕐 ${new Date(Date.now() + off).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  el.title = t('Jam server game (jam lokal {o})', { o: `${off >= 0 ? '+' : ''}${(off / 1000).toFixed(1)} s` });
}
setInterval(tickClock, 1000);
document.addEventListener('keydown', (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey || !/^Digit\d$/.test(e.code)) return;
  const n = +e.code.slice(5), v = ORDER[(n || 10) - 1];
  if (v) { e.preventDefault(); location.hash = v; }
});

function updateIncoming() {
  const n = ctx.state.movements?.incoming?.length || 0;
  const b = document.getElementById('nav-inc');
  if (b) { b.textContent = n ? `⚠️ ${n}` : ''; b.classList.toggle('hide', !n); }
  // urgent to-do items (critical + high)
  const u = todo.urgentCount(ctx.state), tb = document.getElementById('nav-todo');
  if (tb) { tb.textContent = u ? String(u) : ''; tb.classList.toggle('hide', !u); }
}

function updateLive() {
  updateIncoming();
  const latest = Math.max(0, ...Object.values(ctx.state.cities).map((c) => Math.max(c.syncedAt || 0, c.seenAt || 0)));
  const live = Date.now() - latest < 2 * 60 * 1000;
  const el = document.getElementById('live');
  el.querySelector('.status-dot').classList.toggle('live', live);
  el.querySelector('span:last-child').textContent = latest
    ? (live ? t('Game terbuka — data live') : t('Data terakhir {x}', { x: fmtAgo(latest) }))
    : t('Belum ada data dari game');
}

// Storage changes are applied from the change event itself (no re-read of all stored data): while the game is
// open, movements are written every few seconds and re-reading history/players/layouts each time was the
// dashboard's main cost.
async function reload(changes) {
  const names = Object.keys(changes);
  if (names.includes('gameIcons')) {
    if (await loadIcons()) { if (mounted.layout) layout.refreshIcons(); }
  }
  if (!ctx.state) return; // still starting: the first full read picks the change up
  const changedKeys = applyChanges(ctx.state, changes);
  if (!changedKeys.length) return; // only keys no view shows (icons, alert bookkeeping…)
  if (changedKeys.includes('settings')) applyTheme(ctx.state.settings.theme || 'dark');
  updateLive();
  for (const [name, mod] of Object.entries(views)) {
    if (!mounted[name]) continue;
    if (mod.onData) mod.onData(ctx.state, changedKeys);
    else if (name === current()) mod.render?.(ctx.state);
  }
}

let pending = null;
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  clearTimeout(reload._t);
  pending = { ...(pending || {}), ...ch }; // the newest value of each key wins
  reload._t = setTimeout(() => { const c = pending; pending = null; reload(c); }, 250);
});
window.addEventListener('hashchange', show);
setInterval(() => { updateLive(); if (current() === 'kota') cities.render(ctx.state); }, 30000);

(async () => {
  applyTheme();
  await initLang();
  translateChrome();
  palette.init(ctx, ORDER.map((v) => [v, ...NAV[v]]));
  document.getElementById('nav-search')?.addEventListener('click', () => palette.open());
  try { await loadIcons(); } catch (e) { console.warn('icons', e); }
  ctx.state = await getAll();
  applyTheme(ctx.state.settings.theme || 'dark');
  updateLive();
  tickClock();
  show();
})();
