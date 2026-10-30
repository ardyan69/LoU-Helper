// Layout Planner extras: 🧩 templates (economy / military / hub) and ⚖️ side-by-side comparison.
import { esc, fmtNum, RES_ICON, RES_LABEL } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { N, TOWNHALL, B, zone, isBuilding, cityStats, warnings } from '../lib/city.js';
import { militaryTemplate, hubTemplate, militaryStats, hubStorage, GROUP_CODES, MAX_SLOTS } from '../lib/templates.js';
import { RECRUIT_GROUPS, RECRUIT_CODES, unitById, recruitTime } from '../lib/cheatsheet.js';
import { fmtT } from './cs-buildings.js';

const RES = ['wood', 'stone', 'iron', 'food'];
const num = (n) => Math.round(n).toLocaleString(locale());
const fsec = (s) => (s < 60 ? `${s.toFixed(s < 10 ? 2 : 1)} s` : fmtT(s));
const sfmt = (s) => (s < 0 ? '−' : '') + fsec(Math.abs(s));
const GROUP_UNITS = Object.fromEntries(RECRUIT_CODES.map((c, i) => [c, RECRUIT_GROUPS[i].units]));
const ts = { kind: 'mil', group: 'G', group2: '', share2: 30, ts: 200000, keep: true, castle: true, markets: 10, harbors: 0, slots: MAX_SLOTS, clear: false, cottages: 0, warehouses: 0 };
try { Object.assign(ts, JSON.parse(localStorage.getItem('lou-tpl') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-tpl', JSON.stringify(ts)); } catch {} };

// ---------- 🧩 templates ----------
let tdlg = null, tctx = null, last = null, worker = null;
export function openTemplates(base, limit, onSave, onEconomy, preset) {
  if (preset) Object.assign(ts, preset);
  tctx = { base, limit, onSave, onEconomy };
  last = null;
  if (!tdlg) {
    tdlg = document.createElement('dialog');
    tdlg.className = 'optdlg tpldlg';
    document.body.appendChild(tdlg);
    tdlg.addEventListener('click', onTplClick);
    tdlg.addEventListener('close', stopWorker);
    tdlg.addEventListener('change', (e) => {
      const el = e.target;
      if (!el.dataset.tp) return;
      ts[el.dataset.tp] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(0, +el.value || 0) : el.value;
      if (el.dataset.tp === 'slots') ts.slots = Math.min(MAX_SLOTS, Math.max(1, ts.slots || MAX_SLOTS));
      if (el.dataset.tp === 'share2') ts.share2 = Math.min(90, Math.max(10, ts.share2 || 30));
      stopWorker(); persist(); last = null; drawTpl();
    });
  }
  drawTpl();
  tdlg.showModal();
}
function stopWorker() { if (worker) { worker.terminate(); worker = null; } }
function runOpts() {
  const limit = ts.slots || MAX_SLOTS;
  if (ts.kind === 'hub') return { markets: ts.markets, harbors: ts.harbors, keep: ts.keep, limit, clearNodes: ts.clear, extras: { C: ts.cottages } };
  return { group: ts.group, group2: ts.group2, share2: ts.share2 / 100, ts: ts.ts, keep: ts.keep, castle: ts.castle, limit, clearNodes: ts.clear, extras: { C: ts.cottages, S: ts.warehouses } };
}
function runTemplate() {
  const out = tdlg.querySelector('#tp-out');
  const run = tdlg.querySelector('[data-tact=run]');
  out.innerHTML = `<div class="row" style="gap:10px"><div class="bar grow" id="tp-prog"><i style="width:0%;background:var(--gold)"></i></div><span class="small muted" id="tp-pct">0%</span><button class="btn sm" data-tact="cancel">${t('Batal')}</button></div>`;
  if (run) run.disabled = true;
  const kind = ts.kind, opts = runOpts(), base = structuredClone(tctx.base);
  const finish = (res) => { stopWorker(); if (run) run.disabled = false; last = res; drawResult(); };
  const progress = (f) => {
    const bar = tdlg.querySelector('#tp-prog i'), pct = tdlg.querySelector('#tp-pct');
    if (bar) bar.style.width = (f * 100).toFixed(0) + '%';
    if (pct) pct.textContent = (f * 100).toFixed(0) + '%';
  };
  stopWorker();
  try {
    worker = new Worker(new URL('../lib/template-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      if (e.data.progress != null) progress(e.data.progress);
      else if (e.data.done) finish(e.data.done);
      else if (e.data.error) { finish(null); out.innerHTML = `<div class="banner">⚠️ ${esc(e.data.error)}</div>`; }
    };
    worker.onerror = () => { stopWorker(); runInline(kind, opts, finish); };
    worker.postMessage({ kind, base, opts });
  } catch {
    runInline(kind, opts, finish);
  }
}
// fallback when module workers are unavailable: same code on the page thread
function runInline(kind, opts, finish) {
  setTimeout(() => finish(kind === 'hub' ? hubTemplate(tctx.base, opts) : militaryTemplate(tctx.base, opts)), 30);
}
function onTplClick(e) {
  const a = e.target.closest('[data-tact]')?.dataset.tact;
  if (!a) return;
  if (a === 'close') tdlg.close();
  if (a === 'kind') { stopWorker(); ts.kind = e.target.closest('[data-kind]').dataset.kind; persist(); last = null; drawTpl(); }
  if (a === 'eco') { tdlg.close(); tctx.onEconomy(); }
  if (a === 'run') runTemplate();
  if (a === 'cancel') { stopWorker(); last = null; drawTpl(); }
  if (a === 'save' && last) {
    const g2 = ts.kind === 'mil' && last.stats.group2 ? ` + ${GROUP_CODES[last.stats.group2]}` : '';
    const label = ts.kind === 'hub' ? t('Hub') : `${t('Militer')} ${GROUP_CODES[ts.group]}${g2}`;
    tctx.onSave(last.plan, label);
    tdlg.close();
  }
}
const groupOpts = (sel, none) => (none ? `<option value="" ${!sel ? 'selected' : ''}>— ${t('tidak ada')} —</option>` : '')
  + RECRUIT_CODES.filter((c) => c !== 'K').map((c) => `<option value="${c}" ${sel === c ? 'selected' : ''}>${esc(GROUP_CODES[c])} — ${GROUP_UNITS[c].map((u) => unitById(u).name).join(', ')}</option>`).join('');
function drawTpl() {
  const k = ts.kind;
  tdlg.innerHTML = `
    <div class="row"><h3 class="grow">🧩 ${t('Template layout')}</h3><button class="btn sm" data-tact="close">✕</button></div>
    <p class="small muted">${t('Template disusun di atas {b}: node alam tetap, bangunan lain diatur ulang. Hasilnya disimpan sebagai rencana baru (level 10) — pakai "Langkah pembangunan" untuk urutan bangunnya.', { b: `<b>${esc(tctx.base.name)}</b>` })}</p>
    <div class="seg" style="margin:6px 0 12px">
      <button data-tact="kind" data-kind="eco" class="${k === 'eco' ? 'on' : ''}">🌾 ${t('Ekonomi')}</button>
      <button data-tact="kind" data-kind="mil" class="${k === 'mil' ? 'on' : ''}">⚔️ ${t('Militer')}</button>
      <button data-tact="kind" data-kind="hub" class="${k === 'hub' ? 'on' : ''}">📦 ${t('Hub')}</button>
    </div>
    ${k === 'eco' ? `<div class="card cs-note small">${t('Kota ekonomi: produksi resource sebesar mungkin dengan bangunan produksi, pengolahan & Cottage di sekitar node alam.')}</div>
      <button class="btn primary" data-tact="eco">🧠 ${t('Buka Rekomendasi')}</button>`
    : k === 'mil' ? `<div class="card cs-note small">${t('Kota militer: recruit speed % sebesar mungkin untuk satu kelompok unit (atau dua, dengan porsi yang kamu tentukan), dengan troop space (TS) minimal sesuai target. Bangunan rekrut L10 = +150%, dan tiap Barracks L10 yang menempel menambah +25% — Barracks yang dikelilingi 8 bangunan rekrut bernilai +200%, jadi Barracks juga dipakai melebihi target TS bila itu menaikkan recruit %. TS = (100 + Barracks × 1.000) × (1 + Castle 300%).')}</div>
      <div class="ogrid">
        <label class="field">${t('Kelompok unit')}<select data-tp="group">${groupOpts(ts.group)}</select></label>
        <label class="field">${t('Target troop space (TS)')}<input type="number" min="0" step="10000" data-tp="ts" value="${ts.ts}"><span class="small muted">${t('0 = tanpa target TS (Barracks tetap dipakai bila menaikkan recruit %)')}</span></label>
        <label class="field">${t('Kelompok unit kedua (opsional)')}<select data-tp="group2">${groupOpts(ts.group2 === ts.group ? '' : ts.group2, true)}</select></label>
        ${ts.group2 && ts.group2 !== ts.group ? `<label class="field">${t('Porsi kelompok kedua (%)')}<input type="number" min="10" max="90" step="5" data-tp="share2" value="${ts.share2}"><span class="small muted">${t('Bagian recruit % total untuk kelompok kedua.')}</span></label>` : '<span></span>'}
        ${slotsField()}
        ${extrasField(true)}
        <label class="check small" style="grid-column:1/-1"><input type="checkbox" data-tp="keep" ${ts.keep ? 'checked' : ''}> ${t('Pertahankan Warehouse, Marketplace, Hideout, Castle & Harbor yang ada')}</label>
        <label class="check small" style="grid-column:1/-1"><input type="checkbox" data-tp="castle" ${ts.castle ? 'checked' : ''}> ${t('Tambah Castle bila belum ada (bonus TS +300%)')}</label>
        ${clearField()}
      </div>
      <button class="btn primary" data-tact="run" style="margin-top:10px">${t('Hitung template')}</button>`
    : `<div class="card cs-note small">${t('Kota hub/gudang: barisan Warehouse berselang-seling dengan Sawmill/Stonemason/Foundry/Mill (+200% kapasitas untuk tiap Warehouse yang ditempel, L10) untuk kapasitas seimbang terbesar, plus Marketplace untuk gerobak.')}</div>
      <div class="ogrid">
        <label class="field">${t('Jumlah Marketplace')}<input type="number" min="0" max="40" data-tp="markets" value="${ts.markets}"><span class="small muted">${t('200 gerobak per Marketplace L10')}</span></label>
        ${tctx.base.water ? `<label class="field">${t('Jumlah Harbor (tepi air)')}<input type="number" min="0" max="12" data-tp="harbors" value="${ts.harbors}"><span class="small muted">${t('30 kapal per Harbor L10 (10.000 resource per kapal)')}</span></label>` : ''}
        ${slotsField()}
        ${extrasField(false)}
        <label class="check small" style="grid-column:1/-1"><input type="checkbox" data-tp="keep" ${ts.keep ? 'checked' : ''}> ${t('Pertahankan Castle, Harbor & Shipyard yang ada')}</label>
        ${clearField()}
      </div>
      <button class="btn primary" data-tact="run" style="margin-top:10px">${t('Hitung template')}</button>`}
    <div id="tp-out" style="margin-top:12px"></div>`;
}
function slotsField() {
  const cur = tctx.limit && tctx.limit !== MAX_SLOTS ? ' ' + t('Kota ini sekarang: {n}.', { n: num(tctx.limit) }) : '';
  return `<label class="field">${t('Slot bangunan')}<input type="number" min="1" max="${MAX_SLOTS}" data-tp="slots" value="${ts.slots}"><span class="small muted">${t('Town Hall L10 = 100 slot.')}${cur}</span></label>`;
}
// hybrid: a few economy buildings kept in the template (placed where the cluster doesn't need the plot)
function extrasField(mil) {
  return `<label class="field">${t('Slot ekonomi (hybrid)')}<span class="row" style="gap:6px;flex-wrap:nowrap">
      <span class="small">🏡</span><input type="number" min="0" max="30" data-tp="cottages" value="${ts.cottages}" title="Cottage" style="width:70px">
      ${mil ? `<span class="small">📦</span><input type="number" min="0" max="30" data-tp="warehouses" value="${ts.warehouses}" title="Warehouse" style="width:70px">` : ''}
    </span><span class="small muted">${mil ? t('Cottage (kecepatan bangun) & Warehouse (stok untuk rekrut).') : t('Cottage untuk kecepatan bangun.')}</span></label>`;
}
function clearField() {
  return `<label class="check small" style="grid-column:1/-1"><input type="checkbox" data-tp="clear" ${ts.clear ? 'checked' : ''}> ${t('Boleh hapus node alam (hutan, batu, bijih besi) bila membuat susunan lebih rapat — danau tetap')}</label>`;
}
function resultFoot(s) {
  const notes = [t('{u}/{s} slot terpakai', { u: num(s.used), s: num(s.slots) })];
  if (s.extras?.C) notes.push(`${s.extras.C}× Cottage`);
  if (s.extras?.S) notes.push(`${s.extras.S}× Warehouse`);
  if (s.cleared) notes.push(t('{n} node alam dihapus', { n: num(s.cleared) }));
  let changed = 0;
  for (let i = 0; i < N * N; i++) { const z = zone(i, last.plan.water); if (i !== TOWNHALL && (z === 'interior' || z === 'shore') && (tctx.base.cells[i] || '-') !== last.plan.cells[i]) changed++; }
  return `${miniMap(last.plan, tctx.base)}<div class="small muted" style="margin-top:4px">${t('Petak bergaris = berubah dari {b} ({n} petak).', { b: esc(tctx.base.name), n: num(changed) })}</div>
    <div class="row" style="margin-top:10px"><span class="small muted grow">${notes.join(' · ')}</span><button class="btn primary" data-tact="save">💾 ${t('Simpan sebagai rencana baru')}</button></div>`;
}
const unitCards = (code, pct, tsv) => GROUP_UNITS[code].map(unitById).map((u) => `<div><span class="muted">${esc(u.name)}</span><b>${fsec(recruitTime(u.sec, pct))}</b><span class="small muted">${t('per unit')} · ${t('isi TS {h}', { h: fmtT((tsv / Math.max(1, u.space)) * recruitTime(u.sec, pct)) })}</span></div>`).join('');
function drawResult() {
  const out = tdlg.querySelector('#tp-out');
  if (!last) { out.innerHTML = ''; return; }
  const s = last.stats;
  if (ts.kind === 'hub') {
    out.innerHTML = `<div class="cs-res">
      ${RES.map((r) => `<div><span class="muted">${RES_ICON[r]} ${RES_LABEL[r]}</span><b>${fmtNum(s.storage[r])}</b></div>`).join('')}
      <div><span class="muted">🛒 ${t('Gerobak')}</span><b>${num(s.carts)}</b><span class="small muted">${t('{n} resource per kirim', { n: fmtNum(s.carts * 1000) })}</span></div>
      ${s.ships ? `<div><span class="muted">⚓ ${t('Kapal')}</span><b>${num(s.ships)}</b><span class="small muted">${t('{n} resource per kirim', { n: fmtNum(s.ships * 10000) })}</span></div>` : ''}
    </div>${resultFoot(s)}`;
    return;
  }
  const extra = s.nBar - s.minBar;
  if (!s.nRec && !s.nRec2) { out.innerHTML = `<div class="banner">⚠️ ${t('Tidak ada petak yang bisa dipakai untuk {b} (Shipyard hanya di tepi air).', { b: esc(GROUP_CODES[ts.group]) })}</div>`; return; }
  const g2 = s.group2;
  const warn2 = g2 && !s.nRec2 ? `<div class="banner" style="margin-bottom:8px">⚠️ ${t('Tidak ada petak yang bisa dipakai untuk {b} (Shipyard hanya di tepi air).', { b: esc(GROUP_CODES[g2]) })}</div>` : '';
  out.innerHTML = `${warn2}${s.tsShort ? `<div class="banner" style="margin-bottom:8px">⚠️ ${t('Target TS tidak tercapai: slot tidak cukup untuk Barracks sebanyak itu.')}</div>` : ''}<div class="cs-res">
      <div><span class="muted">${t('Recruit speed %')}${g2 ? ` · ${esc(GROUP_CODES[ts.group])}` : ''}</span><b>${num(s.pct)}%</b><span class="small muted">${s.nRec}× ${esc(GROUP_CODES[ts.group])} · ${s.nBar}× Barracks</span></div>
      ${g2 ? `<div><span class="muted">${t('Recruit speed %')} · ${esc(GROUP_CODES[g2])}</span><b>${num(s.pct2)}%</b><span class="small muted">${s.nRec2}× ${esc(GROUP_CODES[g2])} · ${t('porsi {p}%', { p: num(100 * s.pct2 / Math.max(1, s.pct + s.pct2)) })}</span></div>` : ''}
      <div><span class="muted">${t('Troop space')}</span><b>${num(s.ts)}</b>${extra > 0 ? `<span class="small muted">${t('+{n} Barracks di atas target — menaikkan recruit %', { n: extra })}</span>` : ''}</div>
      ${unitCards(ts.group, s.pct, s.ts)}${g2 ? unitCards(g2, s.pct2, s.ts) : ''}
    </div>${resultFoot(s)}`;
}

// ---------- mini map ----------
export function miniMap(p, other) {
  let h = '';
  for (let i = 0; i < N * N; i++) {
    const z = zone(i, p.water);
    const c = i === TOWNHALL ? 'T' : p.cells[i];
    const d = B[c];
    const diff = other && i !== TOWNHALL && (z === 'interior' || z === 'shore') && (other.cells[i] || '-') !== c;
    const bg = z === 'wall' || z === 'tower' ? '#4a3f33' : z === 'road' ? '#6b5a42' : z === 'water' ? '#2f6fa8' : z === 'outside' ? 'transparent' : d?.bg || '#2a3a22';
    h += `<i style="background:${bg}" class="${diff ? 'df' : ''}" title="${esc(d?.n || '')}">${d?.ico && isBuilding(c) ? d.ico : ''}</i>`;
  }
  return `<div class="minimap">${h}</div>`;
}

// ---------- ⚖️ side-by-side ----------
let cdlg = null, cstate = null, ca = '', cb = '';
export function openCompare(layouts, aId, bId) {
  cstate = layouts; ca = aId || layouts[0]?.id || ''; cb = bId || layouts.find((l) => l.id !== ca)?.id || ca;
  if (!cdlg) {
    cdlg = document.createElement('dialog');
    cdlg.className = 'optdlg cmpdlg';
    document.body.appendChild(cdlg);
    cdlg.addEventListener('click', (e) => { if (e.target.dataset.cact === 'close') cdlg.close(); });
    cdlg.addEventListener('change', (e) => { if (e.target.id === 'cm-a') ca = e.target.value; if (e.target.id === 'cm-b') cb = e.target.value; drawCompare(); });
  }
  drawCompare();
  cdlg.showModal();
}
function statsOf(p) {
  const s = cityStats(p), m = militaryStats(p);
  return { s, m, st: hubStorage(p), w: warnings(p).length };
}
function drawCompare() {
  const A = cstate.find((l) => l.id === ca), Bp = cstate.find((l) => l.id === cb);
  const sel = (id, v) => `<select id="${id}">${cstate.map((l) => `<option value="${l.id}" ${l.id === v ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>`;
  if (!A || !Bp) { cdlg.innerHTML = '—'; return; }
  const a = statsOf(A), b = statsOf(Bp);
  const row = (label, x, y, fmt = fmtNum, better = 1) => {
    const d = y - x;
    const cls = !d ? '' : d * better > 0 ? 'good-t' : 'bad-t';
    return `<tr><td>${label}</td><td class="num">${fmt(x)}</td><td class="num">${fmt(y)}</td><td class="num ${cls}">${d ? (d > 0 ? '+' : '') + fmt(d) : '='}</td></tr>`;
  };
  const rec = RECRUIT_CODES.map((c, i) => ({ c, i })).filter(({ i }) => a.m.recruit[i].pct || b.m.recruit[i].pct);
  cdlg.innerHTML = `
    <div class="row"><h3 class="grow">⚖️ ${t('Bandingkan berdampingan')}</h3><button class="btn sm" data-cact="close">✕</button></div>
    <div class="cmp-grid">
      <div><label class="field">A ${sel('cm-a', ca)}</label>${miniMap(A, Bp)}</div>
      <div><label class="field">B ${sel('cm-b', cb)}</label>${miniMap(Bp, A)}</div>
    </div>
    <p class="small muted">${t('Petak bergaris = berbeda antara A dan B. Kolom Selisih = B − A (hijau = B lebih baik).')}</p>
    <div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th></th><th class="num">A</th><th class="num">B</th><th class="num">${t('Selisih')}</th></tr></thead><tbody>
      ${row(t('Bangunan'), a.s.buildings, b.s.buildings, num, 0)}
      ${RES.map((r) => row(`${RES_ICON[r]} ${RES_LABEL[r]} ${t('/jam')}`, a.s.prod[r], b.s.prod[r])).join('')}
      ${row(`🪙 ${t('Emas')} ${t('/jam')}`, a.s.gold, b.s.gold)}
      ${RES.map((r) => row(`📦 ${RES_LABEL[r]} (${t('kapasitas')})`, a.s.store[r], b.s.store[r])).join('')}
      ${row('🕳️ Hideout', a.s.hide, b.s.hide)}
      ${row(`🏡 ${t('Kecepatan bangun')} %`, a.s.speed, b.s.speed, num)}
      ${row(`🛒 ${t('Gerobak')}`, a.m.carts, b.m.carts, num)}
      ${row(`⛺ ${t('Troop space')}`, a.m.ts, b.m.ts)}
      ${rec.map(({ c, i }) => row(`⏱️ ${esc(GROUP_CODES[c])} %`, a.m.recruit[i].pct, b.m.recruit[i].pct, num)
        + RECRUIT_GROUPS[i].units.map(unitById).filter((u) => [a.m.recruit[i], b.m.recruit[i]].some((g) => g.n && g.maxLvl >= u.lvl)).map((u) => {
          const ta = a.m.recruit[i].n && a.m.recruit[i].maxLvl >= u.lvl ? recruitTime(u.sec, a.m.recruit[i].pct) : null;
          const tb = b.m.recruit[i].n && b.m.recruit[i].maxLvl >= u.lvl ? recruitTime(u.sec, b.m.recruit[i].pct) : null;
          if (ta == null || tb == null) return `<tr><td class="sub">↳ ${esc(u.name)}</td><td class="num">${ta == null ? '—' : fsec(ta)}</td><td class="num">${tb == null ? '—' : fsec(tb)}</td><td class="num">—</td></tr>`;
          return row(`<span class="sub">↳ ${esc(u.name)}</span>`, ta, tb, sfmt, -1);
        }).join('')).join('')}
      ${row(`⚠️ ${t('Peringatan')}`, a.w, b.w, num, -1)}
    </tbody></table></div>`;
}
