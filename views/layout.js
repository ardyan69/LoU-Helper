import { esc, uid, fmtNum, fmtAgo } from '../lib/shared.js';
import { openOptimizer } from './optimize-dialog.js';
import { openBuildSteps } from './buildsteps.js';
import { openTemplates, openCompare } from './layout-tools.js';
import { t, locale } from '../lib/i18n.js';
import { ico, hasIcon, iconCount, ICON_TOTAL, missingIcons } from '../lib/icons.js';
import {
  N, TOWNHALL, B, zone, isBuilding, isNode, neighbours, blank, migrate, parseShareString, toShareString,
  cityStats, producerOutput, warehouseOutput, townhouseOutput, hideoutOutput, warnings
} from '../lib/city.js';

const PALETTE = [
  ['Node alam', ['.', ':', ',', ';']],
  ['Produksi', ['2', '3', '4', '1']],
  ['Pengolahan', ['L', 'A', 'D', 'M']],
  ['Ekonomi', ['C', 'S', 'H', 'U', 'P', 'R']],
  ['Militer', ['X', 'B', 'K', 'G', 'E', 'J', 'Z', 'Y', 'V']]
];
const RES = ['wood', 'stone', 'iron', 'food'];
const RES_N = new Proxy({ wood: 'Kayu', stone: 'Batu', iron: 'Besi', food: 'Makanan' }, { get: (o, k) => (o[k] ? t(o[k]) : o[k]) });
const RES_I = { wood: '🪵', stone: '🪨', iron: '⛏️', food: '🌾' };
const ZONE_N = { wall: 'Tembok', tower: 'Slot menara', road: 'Jalan', water: 'Air', outside: 'Di luar kota', interior: 'Petak', shore: 'pantai', townhall: 'Town Hall' };

let root, ctx, cur = null;
let brush = '2', tool = 'paint', newLevel = 10;
let painting = false, paintVal = null, saveT = null, hoverIdx = -1, pinnedIdx = -1;
let showLevels = true, showProd = false, heat = false, compareId = '';
let undo = [], redo = [];
let shareDraft = '';

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow">
        <h2>${t('Perencana Layout Kota')}</h2>
        <p>${t('Peta 21×21 yang sama dengan game (tembok, jalan, Town Hall, kota air). Angka produksi memakai rumus game.')}</p>
      </div>
      <details class="howto card">
        <summary>🔄 ${t('Layout kota tersinkron otomatis')}</summary>
        <ol>
          <li>${t('Buka game. Kota yang sedang aktif otomatis masuk ke sini sebagai "<i>🏰 nama kota — kondisi di game</i>", lengkap dengan <b>level asli</b> &amp; antrian bangunan.')}</li>
          <li>${t('Ganti kota di game (panah ‹ ›) untuk menyinkronkan kota lain.')}</li>
          <li>${t('Klik <b>Duplikat</b> untuk membuat rencana yang bisa diedit, lalu pakai <b>Bandingkan dengan</b> untuk melihat apa yang perlu dibangun.')}</li>
        </ol>
        <p class="small muted">${t('Sebaliknya: rancang di sini → <b>Salin share string</b> → di game klik <b>Paste</b> lalu <b>Import</b> → <b>Send to Build Minister</b>.')}</p>
      </details>
    </div>
    <div class="planner2">
      <div class="card palette">
        <label class="field">${t('Rencana')}
          <select id="l-select"></select>
        </label>
        <div class="row">
          <button class="btn sm" id="l-new" title="${t('Rencana baru (kota darat)')}">+ ${t('Darat')}</button>
          <button class="btn sm" id="l-new-w" title="${t('Rencana baru (kota air / pantai)')}">+ ${t('Air')}</button>
          <button class="btn sm" id="l-dup">${t('Duplikat')}</button>
          <button class="btn sm" id="l-ren">${t('Nama')}</button>
          <button class="btn sm danger" id="l-del">${t('Hapus')}</button>
        </div>
        <div class="small muted" id="l-meta"></div>
        <h3>${t('Alat')}</h3>
        <div class="tools">
          <button class="tool" data-tool="paint" title="${t('Taruh bangunan/node yang dipilih')}">🖌️ ${t('Taruh')}</button>
          <button class="tool" data-tool="erase" title="${t('Kosongkan petak (klik kanan juga bisa)')}">🧽 ${t('Hapus')}</button>
          <button class="tool" data-tool="level" title="${t('Klik bangunan untuk memberi level di bawah')}">🔢 ${t('Level')}</button>
          <button class="tool" data-tool="inspect" title="${t('Klik untuk mengunci info petak')}">🔍 ${t('Info')}</button>
        </div>
        <div class="row lvl-row">
          <span class="small muted">${t('Level bangunan baru')}</span>
          <span class="grow"></span>
          <button class="btn sm" id="lv-down">−</button><b class="num" id="lv-val">10</b><button class="btn sm" id="lv-up">+</button>
        </div>
        <div id="l-swatches"></div>
        <div class="row" style="margin-top:6px">
          <button class="btn sm" id="l-all10" title="${t('Set semua bangunan ke level 10')}">${t('Semua lvl 10')}</button>
          <button class="btn sm" id="l-clear">${t('Kosongkan bangunan')}</button>
        </div>
      </div>

      <div class="card mapcard">
        <div class="maptools">
          <button class="btn sm" id="u-undo" title="Undo (Ctrl+Z)">↶</button>
          <button class="btn sm" id="u-redo" title="Redo (Ctrl+Shift+Z)">↷</button>
          <button class="btn sm primary" id="o-open" title="${t('Hitung penempatan terbaik untuk bangunan produksi, pengolahan & Cottage')}">🧠 ${t('Rekomendasi')}</button>
          <button class="btn sm" id="t-tpl" title="${t('Template kota ekonomi, militer, atau hub di atas kota ini')}">🧩 ${t('Template')}</button>
          <button class="btn sm" id="t-side" title="${t('Bandingkan dua rencana berdampingan')}">⚖️ ${t('Bandingkan')}</button>
          <label class="check small"><input type="checkbox" id="t-lv" checked> ${t('Level')}</label>
          <label class="check small"><input type="checkbox" id="t-prod"> ${t('Produksi/jam')}</label>
          <label class="check small" title="${t('Tampilkan petak terbaik untuk bangunan yang sedang dipilih')}"><input type="checkbox" id="t-heat"> 🔥 ${t('Petak terbaik')}</label>
          <span class="grow"></span>
          <label class="small muted">${t('Bandingkan dengan')}
            <select id="t-cmp"></select>
          </label>
        </div>
        <div class="map-wrap"><div class="citymap" id="l-grid"></div></div>
        <div class="small muted maphint">${t('Klik/geser = taruh · klik kanan = hapus · scroll di atas bangunan = ubah level')}</div>
      </div>

      <div class="side" id="l-side"></div>
    </div>`;

  drawPalette();

  root.querySelector('#l-swatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-brush]');
    if (!b) return;
    brush = b.dataset.brush;
    tool = 'paint';
    syncTools();
    if (heat) drawGrid();
  });
  root.querySelector('.tools').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    tool = b.dataset.tool;
    if (tool !== 'inspect') pinnedIdx = -1;
    syncTools();
    drawSide();
  });
  const setLv = (v) => { newLevel = Math.max(1, Math.min(10, v)); root.querySelector('#lv-val').textContent = newLevel; };
  root.querySelector('#lv-down').onclick = () => setLv(newLevel - 1);
  root.querySelector('#lv-up').onclick = () => setLv(newLevel + 1);

  root.querySelector('#l-select').addEventListener('change', (e) => select(e.target.value));
  root.querySelector('#l-new').onclick = () => newPlan(false);
  root.querySelector('#l-new-w').onclick = () => newPlan(true);
  root.querySelector('#l-dup').onclick = () => {
    if (!cur) return;
    const copy = { ...structuredClone(cur), id: uid(), name: cur.name.replace(/ — (kondisi di game|.+)$/, (m) => (m === ' — ' + t('kondisi di game') || m === ' — kondisi di game' ? '' : m)) + ' (' + t('rencana') + ')', source: 'manual', updatedAt: Date.now() };
    delete copy.capturedAt; delete copy.live; delete copy.queue;
    ctx.state.layouts.push(copy);
    if (cur.source === 'game') compareId = cur.id; // compare the new plan with the real city right away
    select(copy.id);
    persist();
  };
  root.querySelector('#l-ren').onclick = () => {
    if (!cur) return;
    const name = prompt(t('Nama baru:'), cur.name);
    if (name) { cur.name = name; persist(); drawAll(); }
  };
  root.querySelector('#l-del').onclick = () => {
    if (!cur || !confirm(t('Hapus rencana "{n}"?', { n: cur.name }))) return;
    ctx.state.layouts = ctx.state.layouts.filter((l) => l.id !== cur.id);
    if (compareId === cur.id) compareId = '';
    cur = ctx.state.layouts[0] || null;
    undo = []; redo = [];
    persist(true);
    drawAll();
  };
  root.querySelector('#l-all10').onclick = () => {
    if (!cur || locked()) return;
    snapshot();
    cur.levels = cur.levels.map((v, i) => (isBuilding(cur.cells[i]) ? 10 : 0));
    changed();
  };
  root.querySelector('#l-clear').onclick = () => {
    if (!cur || locked() || !confirm(t('Hapus semua bangunan (node alam tetap)?'))) return;
    snapshot();
    cur.cells = [...cur.cells].map((c) => (isBuilding(c) ? '-' : c)).join('');
    cur.levels = cur.levels.map(() => 0);
    changed();
  };

  // map toggles
  root.querySelector('#t-lv').onchange = (e) => { showLevels = e.target.checked; drawGrid(); };
  root.querySelector('#t-prod').onchange = (e) => { showProd = e.target.checked; drawGrid(); };
  root.querySelector('#t-heat').onchange = (e) => { heat = e.target.checked; drawGrid(); drawSide(); };
  root.querySelector('#t-cmp').onchange = (e) => { compareId = e.target.value; drawGrid(); drawSide(); };
  root.querySelector('#u-undo').onclick = doUndo;
  root.querySelector('#u-redo').onclick = doRedo;
  root.querySelector('#t-tpl').onclick = () => openTpl();
  root.querySelector('#t-side').onclick = () => { if (ctx.state.layouts.length) openCompare(ctx.state.layouts, cur?.id, compareId || undefined); };
  root.querySelector('#o-open').onclick = () => {
    if (!cur) return;
    const city = linkedCity();
    const limit = city?.buildings?.max || cur.limit || 100;
    openOptimizer(cur, limit, (next, label) => {
      const base = cur.name.replace(/ — .+$/, '').replace(/^🧠 .*? — /, '');
      const l = { ...structuredClone(next), id: uid(), name: `🧠 ${label} — ${base}`, source: 'manual', updatedAt: Date.now() };
      delete l.capturedAt; delete l.live; delete l.queue;
      ctx.state.layouts.push(l);
      compareId = cur.id; // show what changes versus the plan it was computed from
      select(l.id);
      persist();
      ctx.toast(t('Rekomendasi disimpan sebagai rencana baru — hijau = bangun, merah = bongkar'));
    });
  };
  document.addEventListener('keydown', (e) => {
    if (!root.classList.contains('on') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
  });

  // map interaction
  const grid = root.querySelector('#l-grid');
  grid.addEventListener('contextmenu', (e) => e.preventDefault());
  grid.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !cur) return;
    e.preventDefault();
    const i = +cell.dataset.i;
    if (tool === 'inspect' && e.button !== 2) { pinnedIdx = pinnedIdx === i ? -1 : i; drawSide(); markHover(); return; }
    if (locked()) { pinnedIdx = i; drawSide(); markHover(); return; }
    snapshot();
    painting = true;
    paintVal = e.button === 2 || tool === 'erase' ? '-' : tool === 'level' ? '#level' : brush;
    apply(i);
  });
  grid.addEventListener('pointerover', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    const i = +cell.dataset.i;
    if (painting) apply(i);
    if (hoverIdx !== i) { hoverIdx = i; markHover(); drawSide(); }
  });
  grid.addEventListener('pointerleave', () => { hoverIdx = -1; markHover(); drawSide(); });
  grid.addEventListener('wheel', (e) => {
    const cell = e.target.closest('.cell');
    if (!cell || !cur) return;
    const i = +cell.dataset.i;
    if (!isBuilding(cur.cells[i])) return;
    e.preventDefault();
    if (cur.source === 'game') return;
    snapshot();
    cur.levels[i] = Math.max(1, Math.min(10, (cur.levels[i] || 10) + (e.deltaY < 0 ? 1 : -1)));
    changed();
  }, { passive: false });
  window.addEventListener('pointerup', () => {
    if (!painting) return;
    painting = false;
    // drop the undo snapshot if the stroke changed nothing
    const last = undo[undo.length - 1];
    if (last && last.cells === cur.cells && last.levels.join() === cur.levels.join()) undo.pop();
    persist();
  });

  root.querySelector('#l-side').addEventListener('input', (e) => { if (e.target.id === 'l-share') shareDraft = e.target.value; });
  root.querySelector('#l-side').addEventListener('click', async (e) => {
    const id = e.target.id;
    if (id === 'l-steps' && cmpPlan()) {
      // always go from the real city (game layout) to the plan
      const o = cmpPlan(), swap = cur.source === 'game' && o.source !== 'game';
      openBuildSteps(swap ? o : cur, swap ? cur : o, ctx.state);
      return;
    }
    if (id === 'l-copy') {
      const text = toShareString(cur);
      try { await navigator.clipboard.writeText(text); }
      catch {
        const ta = root.querySelector('#l-share');
        shareDraft = ta.value = text;
        ta.select();
        document.execCommand('copy');
      }
      ctx.toast(t('Share string disalin — tempel di City planner game (Paste → Import)'));
    }
    if (id === 'l-import') {
      const p = parseShareString(root.querySelector('#l-share').value);
      if (!p) return ctx.toast(t('Bukan share string LoU yang valid'));
      const name = prompt(t('Nama rencana hasil impor:'), t('Impor') + ' ' + new Date().toLocaleDateString(locale()));
      if (!name) return;
      const l = { ...p, id: uid(), name, source: 'import', updatedAt: Date.now() };
      ctx.state.layouts.push(l);
      select(l.id);
      persist();
      shareDraft = '';
      drawSide();
      ctx.toast(t('Layout diimpor'));
    }
    if (id === 'l-paste') {
      try { shareDraft = root.querySelector('#l-share').value = await navigator.clipboard.readText(); } catch { ctx.toast(t('Izin clipboard ditolak — tempel manual dengan Ctrl+V')); }
    }
    const jump = e.target.closest('[data-cell]');
    if (jump) { pinnedIdx = +jump.dataset.cell; tool = 'inspect'; syncTools(); markHover(); drawSide(); }
  });
}

function drawPalette() {
  const n = iconCount();
  root.querySelector('#l-swatches').innerHTML = PALETTE.map(([title, codes]) => `
    <h3>${t(title)}</h3>
    <div class="swatches">${codes.map((c) => `
      <button class="swatch" data-brush="${esc(c)}" title="${esc(B[c].n)} · share string code: ${esc(c)}">
        <span class="chip${hasIcon(c) ? ' gi-chip' : ''}" style="${hasIcon(c) ? '' : `background:${B[c].bg}`}">${ico(c)}</span><span>${esc(B[c].n)}</span>
      </button>`).join('')}</div>`).join('') +
    (n < ICON_TOTAL ? `<div class="small muted icon-hint">${t('Ikon game: {n}/{t}. Belum ada: {m}.', { n, t: ICON_TOTAL, m: esc(missingIcons().join(', ')) })}<br>${t('Di game buka <b>Build bar</b>, <b>Guide → Your city &amp; the grid</b> (node alam), dan klik <b>Town Hall</b> di kota.')}</div>` : '');
  syncTools();
}
export function refreshIcons() { if (root) { drawPalette(); drawGrid(); drawSide(); } }

// 🧩 templates on the selected layout (usually the real city)
function savePlan(next, label, icon) {
  const base = cur.name.replace(/ — .+$/, '').replace(/^\S+ .*? — /, '');
  const l = { ...structuredClone(next), id: uid(), name: `${icon} ${label} — ${base}`, source: 'manual', updatedAt: Date.now() };
  delete l.capturedAt; delete l.live; delete l.queue;
  ctx.state.layouts.push(l);
  compareId = cur.id;
  select(l.id);
  persist();
  ctx.toast(t('Template disimpan sebagai rencana baru — hijau = bangun, merah = bongkar'));
}
function openTpl(preset) {
  if (preset?.layoutId && ctx.state.layouts.some((l) => l.id === preset.layoutId)) select(preset.layoutId);
  if (!cur) { ctx.toast(t('Belum ada rencana.')); return; }
  const limit = linkedCity()?.buildings?.max || cur.limit || 100;
  openTemplates(cur, limit, (next, label) => savePlan(next, label, '🧩'), () => root.querySelector('#o-open').click(), preset);
}

// ---------- state helpers ----------
function locked() {
  if (cur?.source !== 'game') return false;
  ctx.toast(t('Layout ini tersinkron dari game (hanya-baca). Klik "Duplikat" untuk membuat rencana yang bisa diedit.'));
  return true;
}
function newPlan(water) {
  const name = prompt(water ? t('Nama rencana baru (kota air):') : t('Nama rencana baru (kota darat):'), t('Rencana') + ' ' + (ctx.state.layouts.length + 1));
  if (!name) return;
  const l = { ...blank(water), id: uid(), name, source: 'manual', updatedAt: Date.now() };
  ctx.state.layouts.push(l);
  select(l.id);
  persist();
}
function select(id) {
  cur = ctx.state.layouts.find((l) => l.id === id) || ctx.state.layouts[0] || null;
  undo = []; redo = []; pinnedIdx = -1;
  if (compareId === cur?.id) compareId = '';
  drawAll();
}
function snapshot() {
  if (!cur) return;
  undo.push({ cells: cur.cells, levels: [...cur.levels] });
  if (undo.length > 100) undo.shift();
  redo = [];
}
function doUndo() {
  if (cur?.source === 'game') return;
  const s = undo.pop();
  if (!s || !cur) return;
  redo.push({ cells: cur.cells, levels: [...cur.levels] });
  cur.cells = s.cells; cur.levels = s.levels;
  changed();
}
function doRedo() {
  if (cur?.source === 'game') return;
  const s = redo.pop();
  if (!s || !cur) return;
  undo.push({ cells: cur.cells, levels: [...cur.levels] });
  cur.cells = s.cells; cur.levels = s.levels;
  changed();
}
function changed() {
  cur.updatedAt = Date.now();
  drawGrid();
  drawSide();
  persist();
}

function canPlace(i, c) {
  if (i === TOWNHALL) return false;
  const z = zone(i, cur.water);
  if (c === '-') return z === 'interior' || z === 'shore';
  if (z === 'shore') return !!B[c]?.shore;
  if (z !== 'interior') return false;
  if (B[c]?.shore) return false; // harbor / shipyard only on shore plots
  return true;
}

function apply(i) {
  if (!cur) return;
  if (paintVal === '#level') {
    if (isBuilding(cur.cells[i]) && cur.levels[i] !== newLevel) { cur.levels[i] = newLevel; cur.updatedAt = Date.now(); drawGrid(); drawSide(); }
    return;
  }
  if (!canPlace(i, paintVal)) return;
  if (paintVal !== '-' && B[paintVal].id === 'castle' && cur.cells.includes('X') && cur.cells[i] !== 'X') { ctx.toast(t('Hanya boleh 1 Castle per kota')); return; }
  const lvl = isBuilding(paintVal) ? newLevel : 0;
  if (cur.cells[i] === paintVal && cur.levels[i] === lvl) return;
  cur.cells = cur.cells.slice(0, i) + paintVal + cur.cells.slice(i + 1);
  cur.levels[i] = lvl;
  cur.updatedAt = Date.now();
  drawGrid();
  drawSide();
}

function persist(now) {
  clearTimeout(saveT);
  const run = () => {
    const arr = ctx.state.layouts;
    if (cur) {
      const i = arr.findIndex((l) => l.id === cur.id);
      if (i >= 0) arr[i] = cur; else arr.push(cur);
    }
    ctx.save({ layouts: arr });
  };
  if (now) run(); else saveT = setTimeout(run, 300);
}

// ---------- lifecycle ----------
export function render(state) {
  if (window.__louTemplate) { const pre = window.__louTemplate; window.__louTemplate = null; setTimeout(() => openTpl(pre), 50); }
  let migrated = false;
  state.layouts = state.layouts.map((l) => { if (l.v === 2) return l; migrated = true; return migrate(l); });
  if (!state.layouts.length) { state.layouts.push({ ...blank(false), id: uid(), name: t('Rencana') + ' 1', source: 'manual', updatedAt: Date.now() }); migrated = true; }
  if (migrated) ctx.save({ layouts: state.layouts });
  const focus = state.layoutFocus && state.layouts.find((l) => l.id === state.layoutFocus);
  if (focus) { cur = focus; ctx.save({ layoutFocus: null }); }
  else cur = state.layouts.find((l) => l.id === cur?.id) || state.layouts[0];
  syncTools();
  drawAll();
}

export function onData(state, keys) {
  if (painting || !root.classList.contains('on')) return;
  if (keys.includes('layouts') || keys.includes('layoutFocus')) {
    // a layout captured from the game arrived (or another tab edited) -> refresh
    const focus = state.layoutFocus && state.layouts.find((l) => l.id === state.layoutFocus);
    if (focus) { cur = focus; undo = []; redo = []; ctx.save({ layoutFocus: null }); ctx.toast(t('Layout "{n}" diterima dari game', { n: focus.name })); }
    else {
      const same = state.layouts.find((l) => l.id === cur?.id);
      if (same && same.updatedAt > (cur?.updatedAt || 0)) cur = same;
      else if (same) { const i = state.layouts.indexOf(same); state.layouts[i] = cur; }
      else cur = state.layouts[0] || null;
    }
    drawAll();
  } else if (keys.includes('cities')) drawSide();
}

function syncTools() {
  root.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', tool === 'paint' && s.dataset.brush === brush));
  root.querySelectorAll('.tool').forEach((t) => t.classList.toggle('on', t.dataset.tool === tool));
}

// ---------- drawing ----------
function drawAll() {
  const sel = root.querySelector('#l-select');
  const L = ctx.state.layouts;
  const label = (l) => `${l.source === 'game' ? '🏰 ' : ''}${esc(l.name)}${l.water ? ' 🌊' : ''}`;
  sel.innerHTML = L.map((l) => `<option value="${l.id}" ${l.id === cur?.id ? 'selected' : ''}>${label(l)}</option>`).join('');
  const cmp = root.querySelector('#t-cmp');
  if (compareId && !L.some((l) => l.id === compareId)) compareId = '';
  cmp.innerHTML = `<option value="">— ${t('tidak')} —</option>` + L.filter((l) => l.id !== cur?.id).map((l) => `<option value="${l.id}" ${l.id === compareId ? 'selected' : ''}>${label(l)}</option>`).join('');
  const meta = root.querySelector('#l-meta');
  if (cur) {
    meta.innerHTML = cur.source === 'game' && cur.live
      ? `<span style="color:var(--good)">🔄 ${t('Sinkron otomatis')}</span> ${t('dari game')} · ${fmtAgo(cur.capturedAt)}${cur.cityKey ? ` · ${esc(cur.cityName || '')} (${cur.cityKey})` : ''}. ${t('Level asli. Hanya-baca — klik <b>Duplikat</b> untuk merencanakan.')}`
      : cur.source === 'game'
      ? `${t('Diambil dari share string {x}', { x: fmtAgo(cur.capturedAt) })}${cur.cityKey ? ` · ${esc(cur.cityName || '')} (${cur.cityKey})` : ''}. ${t('Level dianggap 10. Hanya-baca — klik <b>Duplikat</b> untuk merencanakan.')}`
      : cur.water ? t('Kota air: Harbor &amp; Shipyard hanya di petak pantai.') : t('Kota darat.');
  }
  syncTools();
  drawGrid();
  drawSide();
}

function cmpPlan() { return compareId ? ctx.state.layouts.find((l) => l.id === compareId) : null; }

// value a brush adds to the city if placed at i (for the "best spot" heatmap)
function heatMetric(code) {
  const d = B[code];
  if (!d?.g) return null;
  if (d.g === 'prod' || d.g === 'proc') return (s) => s.prod[d.res];
  if (code === 'C') return (s) => RES.reduce((a, r) => a + s.prod[r], 0);
  if (code === 'S') return (s) => RES.reduce((a, r) => a + s.store[r], 0);
  if (code === 'U' || code === 'P' || code === 'R') return (s) => s.gold;
  if (code === 'H') return (s) => s.hide;
  return null;
}
function heatValues() {
  const metric = heatMetric(brush);
  if (!metric || !cur) return null;
  const base = metric(cityStats(cur));
  const vals = new Map();
  let max = 0;
  for (let i = 0; i < N * N; i++) {
    if (cur.cells[i] !== '-' || !canPlace(i, brush)) continue;
    const tp = { ...cur, cells: cur.cells.slice(0, i) + brush + cur.cells.slice(i + 1), levels: cur.levels.slice() };
    tp.levels[i] = newLevel;
    const v = metric(cityStats(tp)) - base;
    vals.set(i, v);
    if (v > max) max = v;
  }
  return { vals, max };
}

function drawGrid() {
  const grid = root.querySelector('#l-grid');
  if (!cur) { grid.innerHTML = ''; return; }
  const st = cityStats(cur);
  const other = cmpPlan();
  const hv = heat ? heatValues() : null;
  const queued = new Map((cur.queue || []).map((q) => [q.slot, q]));
  const top = hv ? new Set([...hv.vals].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)) : null;
  let html = '';
  for (let i = 0; i < N * N; i++) {
    const z = zone(i, cur.water);
    const c = cur.cells[i];
    let cls = 'cell z-' + z;
    let inner = '';
    if (i === TOWNHALL) inner = ico('T', 'ico');
    else if ((z === 'interior' || z === 'shore') && c !== '-' && B[c]) {
      const d = B[c];
      cls += isNode(c) ? ' node' : ' bld';
      inner = ico(c, 'ico');
      if (isBuilding(c)) {
        if (showProd && st.per[i]?.total != null) inner += `<span class="pv">${fmtNum(st.per[i].total)}</span>`;
        else if (showLevels) inner += `<span class="lv">${cur.levels[i] || 10}</span>`;
      }
      cls += hasIcon(c) ? ' has-gi' : ` t-${d.g || 'node'}`;
    }
    if (other && (z === 'interior' || z === 'shore') && i !== TOWNHALL) {
      const o = other.cells[i] || '-';
      if (o !== c) {
        if (isBuilding(c)) cls += ' d-add';
        else if (o !== '-') cls += ' d-del';
        if (c === '-' && o !== '-') inner = `<span class="ghost">${ico(o, 'ico')}</span>`;
      }
    }
    if (queued.has(i)) { const q = queued.get(i); cls += ' queued'; inner += `<span class="qb" title="${t('Antrian')}: ${esc(q.kind || '')} → lvl ${q.toLevel ?? '?'}">${q.endAt ? '🔨' : '⏳'}</span>`; }
    let style = '';
    if (hv && hv.vals.has(i)) {
      const v = hv.vals.get(i);
      const a = hv.max > 0 ? Math.max(0, v / hv.max) : 0;
      style = ` style="--heat:${a.toFixed(2)}"`;
      cls += ' heat' + (top.has(i) ? ' top' : '');
      if (v > 0) inner = `<span class="hv">${fmtNum(v)}</span>`;
    }
    const tip = i === TOWNHALL ? 'Town Hall' : B[c]?.n && (z === 'interior' || z === 'shore') ? B[c].n : t(ZONE_N[z] || z);
    html += `<div class="${cls}" data-i="${i}"${style} title="${esc(tip)}">${inner}</div>`;
  }
  grid.innerHTML = html;
  markHover();
}

function markHover() {
  const grid = root.querySelector('#l-grid');
  grid.querySelectorAll('.hl,.nb,.pin').forEach((c) => c.classList.remove('hl', 'nb', 'pin'));
  if (pinnedIdx >= 0) grid.children[pinnedIdx]?.classList.add('pin');
  const i = pinnedIdx >= 0 ? pinnedIdx : hoverIdx;
  if (i < 0) return;
  grid.children[i]?.classList.add('hl');
  for (const j of neighbours(i)) grid.children[j]?.classList.add('nb');
}

const coord = (i) => `${(i % N) + 1}:${Math.floor(i / N) + 1}`;

function cellInfo(i) {
  const z = zone(i, cur.water);
  const c = cur.cells[i];
  if (i === TOWNHALL) return `<b>Town Hall</b><div class="small muted">${t('Tidak bisa dipindah.')}</div>`;
  if (z !== 'interior' && z !== 'shore') return `<b>${t(ZONE_N[z] || z)}</b><div class="small muted">${t('Tidak bisa dibangun.')}</div>`;
  const d = B[c];
  let h = `<b>${c !== '-' ? ico(c) : ''} ${esc(d.n)}</b>${isBuilding(c) ? ` <span class="pill">Lv ${cur.levels[i] || 10}</span>` : ''} <span class="muted small">${t('petak')} ${coord(i)}${z === 'shore' ? ' · ' + t('pantai') : ''}</span>`;
  const qs = (cur.queue || []).filter((q) => q.slot === i);
  if (qs.length) h += `<div class="small" style="margin-top:4px">${qs.map((q) => `🔨 ${t('Antrian')}: ${esc(q.kind === 'upgrade' ? t('naik ke') : q.kind || '')} lvl ${q.toLevel ?? '?'}${q.endAt ? ` · ${t('selesai')} ${new Date(q.endAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}` : ' · ' + t('menunggu')}`).join('<br>')}</div>`;
  if (d.g === 'prod') {
    const o = producerOutput(cur, i);
    h += `<table class="kvt">
      <tr><td>${t('Dasar')} (lvl ${cur.levels[i] || 10})</td><td>${fmtNum(o.base)}${t('/j')}</td></tr>
      <tr><td>${c === '1' ? t('Lahan kosong') : 'Node'} ×${o.nodes}</td><td>+${o.nodePct}%</td></tr>
      ${c === '1' ? `<tr><td>Lake ×${o.lakes}</td><td>+${o.lakePct}%</td></tr>` : ''}
      <tr><td>Cottage</td><td>+${o.cottagePct}%</td></tr>
      <tr><td>${B[{ 2: 'L', 3: 'A', 4: 'D', 1: 'M' }[c]].n} (${t('terbaik')})</td><td>+${o.procPct}%</td></tr>
      <tr class="tot"><td>${t('Total')} ${RES_N[o.res]}</td><td>${fmtNum(o.total)}${t('/j')}</td></tr></table>`;
  } else if (c === 'S') {
    const o = warehouseOutput(cur, i);
    h += `<table class="kvt"><tr><td>${t('Dasar')}</td><td>${fmtNum(o.base)}</td></tr>${RES.map((r) => `<tr><td>${RES_I[r]} ${RES_N[r]} (+${o.pct[r]}%)</td><td>${fmtNum(o.out[r])}</td></tr>`).join('')}</table>`;
  } else if (c === 'U') {
    const o = townhouseOutput(cur, i);
    h += `<table class="kvt"><tr><td>${t('Dasar')}</td><td>${o.base}${t('/j')}</td></tr><tr><td>Market/Harbor</td><td>+${o.pct}%</td></tr><tr class="tot"><td>${t('Emas')}</td><td>${fmtNum(o.total)}${t('/j')}</td></tr></table>`;
  } else if (c === 'H') {
    const o = hideoutOutput(cur, i);
    h += `<table class="kvt"><tr><td>${t('Dasar')}</td><td>${fmtNum(o.base)}</td></tr><tr><td>Forest ×${o.forests}</td><td>+${o.forests * 10}%</td></tr><tr class="tot"><td>${t('Disembunyikan')}</td><td>${fmtNum(o.total)}</td></tr></table>`;
  } else if (c === '-' && tool === 'paint' && heatMetric(brush) && canPlace(i, brush)) {
    const metric = heatMetric(brush);
    const tp = { ...cur, cells: cur.cells.slice(0, i) + brush + cur.cells.slice(i + 1), levels: cur.levels.slice() };
    tp.levels[i] = newLevel;
    const gain = metric(cityStats(tp)) - metric(cityStats(cur));
    h += `<div class="small">${t('Jika {b} lvl {l} ditaruh di sini: {g}', { b: esc(B[brush].n), l: newLevel, g: `<b style="color:var(--good)">+${fmtNum(gain)}</b>` })}${B[brush].g === 'eco' && brush === 'S' ? ' ' + t('kapasitas') : t('/j')}</div>`;
  }
  return h;
}

const pctTxt = (f) => `${f >= 1 ? '+' : ''}${Math.round((f - 1) * 100)}%`;
// city bonus (research etc.) = real production in the game ÷ production of the synced game layout
function bonusFactors(city) {
  if (!city?.res || !cur?.cityKey) return null;
  const live = ctx.state.layouts.find((l) => l.source === 'game' && l.live && l.cityKey === cur.cityKey);
  if (!live) return null;
  const base = cityStats(live);
  const f = {};
  for (const r of RES) { const real = city.res[r]?.rate, b = base.prod[r]; if (real > 0 && b > 0) f[r] = real / b; }
  // gold/h is account-wide (all cities together): compare with the townhouses of all synced cities
  const allGold = ctx.state.layouts.filter((l) => l.source === 'game' && l.live).reduce((a, l) => a + cityStats(l).gold, 0);
  if (city.res.gold?.rate > 0 && allGold > 0) f.gold = city.res.gold.rate / allGold;
  return Object.keys(f).length ? f : null;
}

function linkedCity() {
  return cur?.cityKey ? ctx.state.cities[cur.cityKey] : null;
}

function drawSide() {
  const side = root.querySelector('#l-side');
  if (!cur) { side.innerHTML = `<div class="card">${t('Belum ada rencana.')}</div>`; return; }
  const st = cityStats(cur);
  const city = linkedCity();
  const fac = bonusFactors(city);
  const limit = city?.buildings?.max || cur.limit || 100;
  const i = pinnedIdx >= 0 ? pinnedIdx : hoverIdx;
  const ws = warnings(cur);
  const other = cmpPlan();

  let diff = '';
  if (other) {
    const add = {}, del = {};
    for (let k = 0; k < N * N; k++) {
      const z = zone(k, cur.water);
      if (k === TOWNHALL || (z !== 'interior' && z !== 'shore')) continue;
      const a = cur.cells[k], b = other.cells[k] || '-';
      if (a === b) continue;
      if (isBuilding(a)) add[a] = (add[a] || 0) + 1;
      if (b !== '-') del[b] = (del[b] || 0) + 1;
    }
    const list = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([c, n]) => `<span class="pill">${ico(c)} ${n}× ${esc(B[c].n)}</span>`).join(' ') || '<span class="muted small">—</span>';
    diff = `<div class="card">
      <h3>${t('Perbandingan')}</h3>
      <div class="small muted" style="margin-bottom:6px">${t('Rencana ini vs {n}', { n: `<b>${esc(other.name)}</b>` })}</div>
      <div class="small" style="margin-bottom:4px"><span class="dot add"></span> ${t('Perlu dibangun')}</div><div class="row">${list(add)}</div>
      <div class="small" style="margin:8px 0 4px"><span class="dot del"></span> ${t('Perlu dibongkar / dibersihkan')}</div><div class="row">${list(del)}</div>
      <button class="btn sm primary" id="l-steps" style="margin-top:10px">📋 ${t('Langkah pembangunan')}</button>
    </div>`;
  }

  const heatNote = heat ? `<div class="card small">${heatMetric(brush)
    ? '🔥 ' + t('Petak terbaik untuk {b} lvl {l}: makin terang makin besar tambahannya.', { b: `<b>${esc(B[brush].n)}</b>`, l: newLevel })
    : t('Pilih bangunan produksi, pengolahan, Cottage, Warehouse, Hideout, Townhouse atau Marketplace untuk melihat petak terbaik.')}</div>` : '';

  side.innerHTML = `
    <div class="card info">${i >= 0 ? cellInfo(i) : `<span class="muted small">${t('Arahkan mouse ke petak untuk melihat detail &amp; rincian bonus.')}</span>`}</div>
    ${heatNote}
    <div class="card">
      <h3>${t('Hasil rencana')}</h3>
      <div class="kv"><span>${t('Bangunan')}</span><b class="num" style="color:${st.buildings > limit ? 'var(--bad)' : 'inherit'}">${st.buildings} / ${limit}</b></div>
      ${fac ? `<div class="kv small muted"><span></span><span>${t('dasar')} · <span style="color:var(--gold-2)">≈ ${t('dgn bonus kota')}</span></span></div>` : ''}
      ${RES.map((r) => `<div class="kv"><span>${RES_I[r]} ${RES_N[r]} ${t('/jam')}</span><span class="num"><b>${fmtNum(st.prod[r])}</b>${fac?.[r] ? ` · <span style="color:var(--gold-2)" title="${t('Bonus riset/lainnya kota ini ≈ {p}', { p: pctTxt(fac[r]) })}">${fmtNum(st.prod[r] * fac[r])}</span>` : ''}</span></div>`).join('')}
      <div class="kv"><span>🪙 ${t('Emas')} ${t('/jam')}</span><span class="num"><b>${fmtNum(st.gold)}</b>${fac?.gold ? ` · <span style="color:var(--gold-2)">${fmtNum(st.gold * fac.gold)}</span>` : ''}</span></div>
      <div class="kv"><span>📦 ${t('Kapasitas warehouse')}</span><span class="num small">${RES.map((r) => `${RES_I[r]}${fmtNum(st.store[r])}`).join(' ')}</span></div>
      <div class="kv"><span>🕳️ Hideout</span><span class="num">${fmtNum(st.hide)}</span></div>
      <div class="kv"><span>🏡 ${t('Kecepatan bangun')}</span><span class="num">+${st.speed}%</span></div>
      <div class="small muted" style="margin-top:6px">${fac
        ? `${t('Angka kuning = perkiraan dengan bonus kota {c} (riset dll.), dihitung dari produksi nyata vs layout game-nya:', { c: esc(city.name) })} ${RES.map((r) => fac[r] ? `${RES_I[r]}${pctTxt(fac[r])}` : '').join(' ')}`
        : t('Angka dasar, belum termasuk bonus riset &amp; artefak. Buka kota terkait di game supaya bonusnya bisa dihitung.')}</div>
      ${city?.res ? `<div class="small muted">${t('Produksi nyata {c} sekarang:', { c: esc(city.name) })} ${RES.map((r) => `${RES_I[r]}${fmtNum(city.res[r]?.rate)}`).join(' ')}</div>` : ''}
    </div>
    ${diff}
    <div class="card">
      <h3>${t('Peringatan')} ${ws.length ? `<span class="pill warn">${ws.length}</span>` : ''}</h3>
      ${ws.length ? `<ul class="warnlist">${ws.slice(0, 10).map((w) => `<li><a href="#" data-cell="${w.i}">${coord(w.i)}</a> ${esc(w.msg)}</li>`).join('')}${ws.length > 10 ? `<li>…${t('dan {n} lainnya', { n: ws.length - 10 })}</li>` : ''}</ul>` : `<div class="small" style="color:var(--good)">${t('Tidak ada peringatan.')}</div>`}
    </div>
    <div class="card">
      <h3>${t('Share string (format game)')}</h3>
      <button class="btn primary sm" id="l-copy">📋 ${t('Salin share string')}</button>
      <div class="small muted" style="margin:6px 0">${t('Tempel di game: City planner → Plans &amp; share → Paste → Import.')}</div>
      <textarea class="share" id="l-share" spellcheck="false" placeholder="[ShareString.1.3]:…">${esc(shareDraft)}</textarea>
      <div class="row"><button class="btn sm" id="l-paste">${t('Tempel dari clipboard')}</button><button class="btn sm" id="l-import">${t('Impor sebagai rencana baru')}</button></div>
    </div>`;
  side.querySelectorAll('a[data-cell]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
}
