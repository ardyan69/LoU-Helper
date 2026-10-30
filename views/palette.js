// 🔎 Global search (Ctrl+K / ⌘K / "/"): cities, players, dungeons & bosses, layout plans, coordinates, tabs and a
// few actions in one box. Enter opens the result ("#view/arg" → the view's focus(arg)).
import { esc, fmtNum } from '../lib/shared.js';
import { t } from '../lib/i18n.js';

let dlg = null, input = null, listEl = null, items = [], sel = 0, ctx = null, nav = [];

// nav: [[view, icon, label]…] in menu order
export function init(c, navItems) {
  ctx = c;
  nav = navItems;
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); open(); }
    else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); open(); }
  });
}

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'palette';
  dlg.innerHTML = `
    <input type="search" class="pal-q" placeholder="${esc(t('Cari kota, pemain, dungeon, koordinat, layout, menu…'))}" aria-label="${esc(t('Cari'))}" autocomplete="off">
    <div class="pal-list" role="listbox"></div>
    <div class="pal-foot small muted">↑↓ ${t('pilih')} · Enter ${t('buka')} · Esc ${t('tutup')} · Ctrl+K / ⌘K / "/"</div>`;
  document.body.appendChild(dlg);
  input = dlg.querySelector('.pal-q');
  listEl = dlg.querySelector('.pal-list');
  input.addEventListener('input', () => { sel = 0; search(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); dlg.close(); } // a search field would only clear its text
  });
  listEl.addEventListener('click', (e) => { const r = e.target.closest('[data-i]'); if (r) run(items[+r.dataset.i]); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // click on the backdrop
}

export function open() {
  if (!dlg) build();
  if (dlg.open) { input.select(); return; }
  input.value = '';
  sel = 0;
  search();
  dlg.showModal();
  input.focus();
}

// ---- matching: every word must appear; earlier / word-start matches rank higher ----
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function score(text, words) {
  const h = norm(text);
  let s = 0;
  for (const w of words) {
    const i = h.indexOf(w);
    if (i < 0) return -1;
    s += (i === 0 ? 30 : /[\s(·:/-]/.test(h[i - 1]) ? 15 : 0) - Math.min(i, 20) * 0.2;
  }
  return s;
}

function candidates() {
  const S = ctx.state || {};
  const out = [];
  for (const [view, icon, label] of nav) out.push({ kind: t('Menu'), icon, title: t(label), hay: `${t(label)} ${label} ${view}`, go: view, w: 6 });
  out.push({ kind: t('Aksi'), icon: '🔄', title: t('Refresh semua kota'), hay: `${t('Refresh semua kota')} refresh`, act: () => { location.hash = '#kota'; setTimeout(() => document.getElementById('c-refresh')?.click(), 150); }, w: 4 });
  out.push({ kind: t('Aksi'), icon: '🩺', title: t('Diagnostik'), hay: `${t('Diagnostik')} diagnostics`, go: 'tentang/diag', w: 4 });
  for (const c of Object.values(S.cities || {})) out.push({ kind: t('Kota'), icon: '🏰', title: c.name || c.key, sub: `C${c.cont ?? '?'} · ${c.key}${c.group ? ` · ${c.group}` : ''}`, hay: `${c.name} ${c.key} ${c.group || ''}`, go: `kota/${c.key}`, key: c.key, w: 10 });
  for (const l of S.layouts || []) out.push({ kind: t('Layout'), icon: '📐', title: l.name, hay: `${l.name} ${l.cityName || ''}`, go: `layout/${l.id}`, w: 3 });
  for (const p of Object.values(S.players || {})) {
    const cs = Object.values(p.cities || {});
    out.push({ kind: t('Pemain'), icon: '👤', title: p.name, sub: `${p.tag ? `[${p.tag}] · ` : ''}${t('{n} kota', { n: cs.length })}`, hay: `${p.name} ${p.tag || ''} ${(S.playerNotes?.[p.name]?.note) || ''}`, go: `pemain/${p.name}`, w: 5 });
    for (const c of cs) out.push({ kind: t('Kota pemain'), icon: '🏯', title: c.name || c.key, sub: `${p.name}${p.tag ? ` [${p.tag}]` : ''} · ${c.key}`, hay: `${c.name || ''} ${c.key}`, go: `pemain/${p.name}`, key: c.key, w: 1 });
  }
  for (const d of Object.values(S.dungeons || {})) out.push({ kind: d.kind === 'boss' ? 'Boss' : 'Dungeon', icon: d.kind === 'boss' ? '🐉' : '⚔️', title: `${d.type || ''} L${d.level ?? '?'}`, sub: `${d.key}${d.explored != null ? ` · ${fmtNum(d.explored)}%` : ''}`, hay: `${d.type || ''} ${d.kind} ${d.key} l${d.level}`, go: `dungeon/${d.key}`, key: d.key, w: 2 });
  return out;
}

function search() {
  const q = input.value.trim();
  const words = norm(q).split(/\s+/).filter(Boolean);
  const all = candidates();
  if (!words.length) {
    items = all.filter((x) => x.go && !x.go.includes('/') || x.kind === t('Aksi')); // the menu
  } else {
    const coord = q.match(/^(\d{1,4})\s*[:.,\s]\s*(\d{1,4})$/);
    items = all.map((x) => ({ x, s: coord ? (x.key === `${+coord[1]}:${+coord[2]}` ? 100 + x.w : -1) : score(x.hay, words) })).filter((r) => r.s >= 0)
      .sort((a, b) => b.s + b.x.w - (a.s + a.x.w)).slice(0, 40).map((r) => r.x);
    if (coord) items.push({ kind: t('Aksi'), icon: '📋', title: t('Salin koordinat {c}', { c: `${+coord[1]}:${+coord[2]}` }), act: () => { navigator.clipboard?.writeText(`${+coord[1]}:${+coord[2]}`); ctx.toast(t('Disalin')); } });
  }
  draw();
}

function draw() {
  if (!items.length) { listEl.innerHTML = `<div class="pal-empty small muted">${t('Tidak ada hasil.')}</div>`; return; }
  listEl.innerHTML = items.map((x, i) => `<div class="pal-row${i === sel ? ' on' : ''}" data-i="${i}" role="option" aria-selected="${i === sel}">
      <span class="pal-ico">${x.icon}</span><span class="grow"><b>${esc(x.title)}</b>${x.sub ? ` <span class="small muted">${esc(x.sub)}</span>` : ''}</span><span class="pill">${esc(x.kind)}</span></div>`).join('');
  listEl.querySelector('.pal-row.on')?.scrollIntoView({ block: 'nearest' });
}

function run(x) {
  if (!x) return;
  dlg.close();
  if (x.act) x.act();
  else if (x.go) {
    const h = '#' + x.go.split('/').map((p, i) => (i ? encodeURIComponent(p) : p)).join('/');
    if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h;
  }
}
