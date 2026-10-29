import { getAll, set, fmtAgo } from './lib/shared.js';
import * as cities from './views/cities.js';
import * as layout from './views/layout.js';
import * as dungeon from './views/dungeon.js';
import * as settings from './views/settings.js';
import * as movements from './views/movements.js';
import * as about from './views/about.js';
import * as cheat from './views/cheatsheet.js';
import { loadIcons } from './lib/icons.js';
import { initLang, t } from './lib/i18n.js';

const NAV = { kota: ['🏰', 'Ringkasan Kota'], layout: ['📐', 'Perencana Layout'], gerak: ['🚩', 'Pergerakan'], dungeon: ['⚔️', 'Dungeon & Boss'], pengaturan: ['⚙️', 'Pengaturan'], cheat: ['📜', 'Cheat Sheet'], tentang: ['ℹ️', 'Tentang'] };
function translateChrome() {
  document.querySelectorAll('nav.tabs a').forEach((a) => {
    const [ico, label] = NAV[a.dataset.view] || [];
    if (!label) return;
    const badge = a.querySelector('.nav-badge');
    a.textContent = `${ico} ${t(label)} `;
    if (badge) a.appendChild(badge);
  });
  const foot = document.querySelector('.app-foot');
  if (foot) foot.innerHTML = `LoU Revival Helper · ${t('dibuat oleh')} <a href="#tentang">ardhie</a> · <a href="mailto:ardhie.andro@gmail.com">ardhie.andro@gmail.com</a>`;
}

const views = { kota: cities, layout, gerak: movements, dungeon, pengaturan: settings, cheat, tentang: about };
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

function current() {
  const v = location.hash.replace('#', '');
  return views[v] ? v : 'kota';
}

function show() {
  const name = current();
  document.querySelectorAll('nav.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.view === name));
  document.querySelectorAll('section.view').forEach((s) => s.classList.toggle('on', s.id === 'view-' + name));
  const el = document.getElementById('view-' + name);
  if (!mounted[name]) {
    views[name].mount(el, ctx);
    mounted[name] = true;
  }
  views[name].render?.(ctx.state);
}

function updateIncoming() {
  const n = ctx.state.movements?.incoming?.length || 0;
  const b = document.getElementById('nav-inc');
  b.textContent = n ? `⚠️ ${n}` : '';
  b.classList.toggle('hide', !n);
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

async function reload(changedKeys) {
  if (changedKeys.includes('gameIcons')) {
    if (await loadIcons()) { if (mounted.layout) layout.refreshIcons(); }
    if (changedKeys.length === 1) return;
  }
  ctx.state = await getAll();
  updateLive();
  for (const [name, mod] of Object.entries(views)) {
    if (!mounted[name]) continue;
    if (mod.onData) mod.onData(ctx.state, changedKeys);
    else if (name === current()) mod.render?.(ctx.state);
  }
}

chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  clearTimeout(reload._t);
  reload._keys = new Set([...(reload._keys || []), ...Object.keys(ch)]);
  reload._t = setTimeout(() => { const k = [...reload._keys]; reload._keys = null; reload(k); }, 250);
});
window.addEventListener('hashchange', show);
setInterval(() => { updateLive(); if (current() === 'kota') cities.render(ctx.state); }, 30000);

(async () => {
  await initLang();
  translateChrome();
  try { await loadIcons(); } catch (e) { console.warn('icons', e); }
  ctx.state = await getAll();
  updateLive();
  show();
})();
