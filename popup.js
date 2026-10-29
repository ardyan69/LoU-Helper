import './lib/compat.js'; // must stay the first import (Firefox/Safari: chrome → browser)
import { getAll, RES, RES_ICON, fullAt, emptyAt, fmtDur, fmtAgo, esc, trainingTimes } from './lib/shared.js';
import { initLang, t } from './lib/i18n.js';

const GAME = 'https://lordofultima.me/';
document.getElementById('p-ver').textContent = 'v' + chrome.runtime.getManifest().version;

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-open]');
  if (!b) return;
  const v = b.dataset.open;
  if (v === 'game') {
    const [t] = await chrome.tabs.query({ url: GAME + '*' });
    if (t) { await chrome.tabs.update(t.id, { active: true }); await chrome.windows.update(t.windowId, { focused: true }); }
    else await chrome.tabs.create({ url: GAME });
  } else {
    await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') + '#' + v });
  }
  window.close();
});

// Firefox (and Safari) treat host permissions as optional: without access to the game the content
// scripts never run, so offer the grant here. permissions.request() must run directly in the click.
const ORIGINS = { origins: ['https://lordofultima.me/*'] };
document.addEventListener('click', (e) => {
  if (!e.target.closest('#p-grant')) return;
  chrome.permissions.request(ORIGINS).then((ok) => { if (ok) document.getElementById('p-perm').innerHTML = `<div class="mc">✅ ${t('Akses diizinkan. Refresh tab game.')}</div>`; });
});
async function checkAccess() {
  let ok = true;
  try { ok = await chrome.permissions.contains(ORIGINS); } catch { /* API missing: assume granted */ }
  if (!ok) document.getElementById('p-perm').innerHTML = `<div class="alert">🔓 ${t('Extension belum diizinkan membaca lordofultima.me, jadi data game tidak terbaca.')} <button class="btn primary" id="p-grant" style="margin-top:6px;width:100%">${t('Izinkan akses ke lordofultima.me')}</button></div>`;
}

(async () => {
  await initLang();
  checkAccess();
  const BTN = { kota: '🏰 ' + t('Kota'), layout: '📐 ' + t('Layout'), gerak: '🚩 ' + t('Gerak'), dungeon: '⚔️ Dungeon', game: t('Buka game') };
  document.querySelectorAll('.btns [data-open], .btn.primary[data-open]').forEach((b) => { if (BTN[b.dataset.open]) b.textContent = BTN[b.dataset.open]; });
  const { cities, settings, movements: mv } = await getAll();
  if (mv) {
    const off = mv.serverOffset || 0, sNow = Date.now() + off;
    const inc = (mv.incoming || []).sort((a, b) => (a.arriveAt || 0) - (b.arriveAt || 0));
    if (inc.length) {
      document.getElementById('p-alert').innerHTML = `<div class="alert">⚠️ <b>${t('{n} serangan masuk!', { n: inc.length })}</b> ${t('Terdekat: {o} → {c} dalam {d}', { o: esc(inc[0].owner || '?'), c: esc(inc[0].target?.name || `${inc[0].toX}:${inc[0].toY}`), d: `<b>${fmtDur(inc[0].arriveAt - sNow)}</b>` })}</div>`;
    }
    const troops = (mv.armies || []).filter((a) => !a.trade).length, trades = (mv.armies || []).filter((a) => a.trade).length;
    const training = (mv.training || []).filter((c) => c.queue?.length).length;
    document.getElementById('p-mv').textContent = `⚔️ ${t('{n} pasukan bergerak', { n: troops })} · 🛒 ${t('{n} konvoi dagang', { n: trades })} · 🎖️ ${t('{n} kota melatih', { n: training })}`;
  }
  const pct = settings.alerts.fullThreshold;
  const now = Date.now();
  const list = Object.values(cities).map((c) => {
    let first = null;
    if (c.res) for (const r of RES) {
      const ft = fullAt(c.res[r], c.seenAt, pct);
      if (ft && (!first || ft < first.t)) first = { r, t: ft };
    }
    const empty = c.res ? emptyAt(c.res.food, c.seenAt) : null;
    return { c, first, empty };
  }).sort((a, b) => (a.first?.t ?? Infinity) - (b.first?.t ?? Infinity));

  const latest = Math.max(0, ...Object.values(cities).map((c) => Math.max(c.syncedAt || 0, c.seenAt || 0)));
  document.getElementById('p-live').textContent = latest ? t('update {x}', { x: fmtAgo(latest) }) : '';

  const el = document.getElementById('p-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty small">${t('Belum ada data. Buka game dan login — kota akan terbaca otomatis.')}</div>`;
    return;
  }
  el.innerHTML = list.map(({ c, first, empty }) => {
    const q = c.queue;
    let qs = `<span class="muted">${t('antrian ?')}</span>`;
    if (q?.count === 0) qs = `<span style="color:var(--warn)">${t('antrian kosong')}</span>`;
    else if (q?.endsAt) qs = q.endsAt > now ? `🔨 ${fmtDur(q.endsAt - now)}` : `<span style="color:var(--warn)">🔨 ${t('selesai?')}</span>`;
    else if (q?.count) qs = `🔨 ${t('{n} order', { n: q.count })}`;
    let fs = '<span class="muted">—</span>';
    if (first) fs = first.t <= now ? `<span style="color:var(--bad)">${RES_ICON[first.r]} ${t('penuh')}</span>` : `${RES_ICON[first.r]} ${t('{p}% dlm {d}', { p: pct, d: `<b style="color:${first.t - now < 2 * 3.6e6 ? 'var(--warn)' : 'inherit'}">${fmtDur(first.t - now)}</b>` })}`;
    if (empty && empty - now < 6 * 3.6e6) fs += ` · <span style="color:var(--bad)">🌾 ${t('habis {x}', { x: fmtDur(empty - now) })}</span>`;
    return `<div class="mc"><div class="row"><b>${esc(c.name)}</b><span class="muted">${c.key}</span></div><div class="row"><span>${fs}</span><span>${qs}</span></div></div>`;
  }).join('');
})();
