// Cheat Sheet → ⚔️ Battle: attack / defense simulator with the Revival combat rules (expected values).
import { esc } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { REV_UNITS, unitById } from '../lib/cheatsheet.js';
import { WALL, BUILDINGS, TOWERS, TRAPS, ORDERS, researchPct } from '../lib/gamedata.js';

const TYPES = ['infantry', 'cavalry', 'magic', 'artillery'];
const st = { order: 'assault', att: {}, def: {}, atkBonus: 0, defBonus: 0, wall: 0, morale: 0, tw: {}, tr: {}, extra: 'ranger' };
try { Object.assign(st, JSON.parse(localStorage.getItem('lou-cs-battle') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-cs-battle', JSON.stringify(st)); } catch {} };
const num = (n) => Math.round(n).toLocaleString(locale());
const lvlEff = (id, lvl) => (lvl > 0 ? BUILDINGS[id].eff[Math.min(10, lvl) - 1] : 0);

// Game rules (attack phase): see README → Battle simulator.
export function battle(o) {
  const scout = o.order === 'scout';
  const ord = ORDERS[o.order] || ORDERS.assault;
  const pick = (m) => Object.entries(m || {}).filter(([id, n]) => n > 0 && unitById(id) && (scout ? id === 'scout' : true));
  const A = pick(o.att).filter(([id]) => unitById(id).spd > 0 || id === 'cityguard');
  const D = pick(o.def);
  const u = 1 + (o.atkBonus || 0) / 100, dB = 1 + (o.defBonus || 0) / 100, m = 1 + Math.max(0, o.morale || 0) / 100;
  const wallB = 1 + (o.wall > 0 ? WALL.eff[Math.min(10, o.wall) - 1] : 0) / 100;
  const p = {};
  for (const [id, n] of A) p[unitById(id).type] = (p[unitById(id).type] || 0) + n;
  const g = {};
  for (const k of Object.keys(p)) g[k] = p[k] > 0 ? Math.min(o.traps?.[k] || 0, p[k] * 0.5) / p[k] : 0;
  const y = new Map(D);
  let cg = o.def?.cityguard || 0;
  for (const [tw, T] of Object.entries(o.towers || {})) {
    if (!T) continue;
    const { unit: E, per } = TOWERS[tw];
    if (scout && E !== 'scout') continue;
    const F = o.def?.[E] || 0, R = Math.min(F, T);
    if (R > 0 && y.has(E)) y.set(E, y.get(E) + R);
    if (!scout && cg > 0 && T > R && y.has('cityguard')) { const j = Math.min(cg, (T - R) * per); cg -= j; y.set('cityguard', y.get('cityguard') + j); }
  }
  const groups = A.map(([id, n]) => { const U = unitById(id); return { id, n, type: U.type, a: n * (1 - (g[U.type] || 0)) * U.atk * u, d: 0 }; });
  const x = groups.reduce((s, q) => s + q.a, 0);
  let w = 0;
  const perUnitDef = {}; // defense one extra unit of each type would add
  for (const q of groups) {
    const share = x > 0 ? q.a / x : 1 / Math.max(1, groups.length);
    let E = 0;
    for (const [id, F] of y) { const U = unitById(id); E += F * share * U.def[TYPES.indexOf(q.type)] * (U.naval ? 1 : wallB) * dB * m; }
    for (const U of REV_UNITS) perUnitDef[U.id] = (perUnitDef[U.id] || 0) + share * U.def[TYPES.indexOf(q.type)] * (U.naval ? 1 : wallB) * dB * m;
    q.d = E; w += E;
  }
  const win = D.length === 0 ? A.length > 0 : x > w;
  const attLoss = {}, defLoss = {};
  let defFrac = 0;
  if (D.length && x + w > 0) {
    const P = w > 0 ? x / w : Infinity;
    defFrac = Math.min(1, ord.defender * (win ? Math.sqrt(P) : P));
    for (const [id, n] of D) defLoss[id] = n * defFrac;
    for (const q of groups) { const O = q.a > 0 ? q.d / q.a : Infinity; attLoss[q.id] = q.n * Math.min(1, ord.attacker * (win ? O : Math.sqrt(O))); }
  }
  return { win, x, w, groups, attLoss, defLoss, defFrac, trapped: g, perUnitDef, A, D };
}

const ATT_IDS = REV_UNITS.filter((u) => u.spd > 0 || u.id === 'cityguard').map((u) => u.id);
const DEF_IDS = REV_UNITS.map((u) => u.id);
function towersOf(state, cityKey) {
  const c = state.cities[cityKey];
  return c?.towers || null;
}

export function html(state) {
  const cities = Object.values(state.cities).filter((c) => c.x != null).sort((a, b) => String(a.name).localeCompare(String(b.name), 'id', { numeric: true }));
  const inc = (state.movements?.incoming || []).filter((a) => a.units && Object.keys(a.units).length);
  const unitRow = (side, ids) => ids.map((id) => `<label class="field">${esc(unitById(id).name)}<input type="number" min="0" data-bt="${side}.${id}" value="${st[side][id] || ''}" placeholder="0"></label>`).join('');
  return `
    <div class="card cs-note small">${t('Simulasi pertempuran dengan aturan Revival (nilai rata-rata, tanpa acak): serangan tiap tipe dibagi ke pertahanan per tipe unit bertahan; tembok menambah pertahanan, tower menggandakan unitnya (slot kosong diisi City Guard), trap menetralkan maks. 50% penyerang satu tipe. Menang jika total serangan > total pertahanan.')}</div>
    <div class="toolbar card">
      <label class="field">${t('Misi')}<select data-bt="order">${Object.keys(ORDERS).map((k) => `<option value="${k}" ${st.order === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="field">${t('Riset militer penyerang %')}<input type="number" min="0" data-bt="atkBonus" value="${st.atkBonus}"></label>
      <label class="field">${t('Riset militer bertahan %')}<input type="number" min="0" data-bt="defBonus" value="${st.defBonus}"></label>
      <label class="field">${t('Moral %')}<input type="number" min="0" data-bt="morale" value="${st.morale}"></label>
      <button class="btn sm" data-btact="myres">🔬 ${t('Pakai riset militerku ({p}%)', { p: researchPct(state.movements?.research?.military || 0) })}</button>
    </div>
    <div class="two-col bt-cols">
      <div class="card cs-card"><div class="cs-card-head"><h3>🗡️ ${t('Penyerang')}</h3>
          <select data-btact="attfrom"><option value="">${t('Isi dari…')}</option>${cities.map((c) => `<option value="city:${c.key}">🏰 ${esc(c.name)}</option>`).join('')}${inc.map((a) => `<option value="inc:${a.id}">⚠️ ${esc(a.owner || '?')} → ${esc(a.target?.name || '')}</option>`).join('')}</select>
          <button class="btn sm" data-btact="clratt">${t('Kosongkan')}</button></div>
        <div class="bt-grid">${unitRow('att', ATT_IDS)}</div></div>
      <div class="card cs-card"><div class="cs-card-head"><h3>🛡️ ${t('Bertahan')}</h3>
          <select data-btact="deffrom"><option value="">${t('Isi dari…')}</option>${cities.map((c) => `<option value="${c.key}">🏰 ${esc(c.name)}</option>`).join('')}</select>
          <button class="btn sm" data-btact="clrdef">${t('Kosongkan')}</button></div>
        <div class="bt-grid">${unitRow('def', DEF_IDS)}</div>
        <div class="bt-grid bt-wall" style="margin-top:8px">
          <label class="field">${t('Level tembok')}<input type="number" min="0" max="10" data-bt="wall" value="${st.wall}"></label>
          ${Object.keys(TOWERS).map((k) => `<label class="field" title="${esc(t('jumlah × level'))}">${esc(BUILDINGS[k].name)}<span class="bt-nl"><input type="number" min="0" data-bt="tw.${k}.n" value="${st.tw[k]?.n || ''}" placeholder="0"> × L<input type="number" min="0" max="10" data-bt="tw.${k}.l" value="${st.tw[k]?.l || ''}" placeholder="-"></span></label>`).join('')}
          ${Object.keys(TRAPS).map((k) => `<label class="field" title="${esc(t('jumlah × level'))}">${esc(BUILDINGS[k].name)}<span class="bt-nl"><input type="number" min="0" data-bt="tr.${k}.n" value="${st.tr[k]?.n || ''}" placeholder="0"> × L<input type="number" min="0" max="10" data-bt="tr.${k}.l" value="${st.tr[k]?.l || ''}" placeholder="-"></span></label>`).join('')}
        </div></div>
    </div>
    <div id="bt-out"></div>`;
}

function input() {
  const towers = {}, traps = {};
  for (const [k, v] of Object.entries(st.tw)) if (v?.n && v?.l) towers[k] = v.n * lvlEff(k, v.l);
  for (const [k, v] of Object.entries(st.tr)) if (v?.n && v?.l) traps[TRAPS[k]] = (traps[TRAPS[k]] || 0) + v.n * lvlEff(k, v.l);
  return { order: st.order, att: st.att, def: st.def, atkBonus: st.atkBonus, defBonus: st.defBonus, wall: st.wall, morale: st.morale, towers, traps };
}

export function paint(root) {
  const out = root.querySelector('#bt-out');
  if (!out) return;
  const r = battle(input());
  if (!r.A.length) { out.innerHTML = `<div class="card small muted">${t('Isi pasukan penyerang untuk melihat hasil.')}</div>`; return; }
  const ratio = r.w > 0 ? r.x / r.w : Infinity;
  const exU = unitById(st.extra) || unitById('ranger');
  const extraNeed = !r.win ? 0 : Math.ceil((r.x - r.w) / (r.perUnitDef[exU.id] || 1)) + 1;
  const atkNeed = r.win ? 0 : r.x > 0 ? r.w / r.x : Infinity;
  const lossRows = (list, loss) => list.map(([id, n]) => `<tr><td>${esc(unitById(id).name)}</td><td class="num">${num(n)}</td><td class="num bad-t">${num(loss[id] || 0)}</td><td class="num">${num(n - (loss[id] || 0))}</td></tr>`).join('');
  out.innerHTML = `
    <div class="cs-res">
      <div><span class="muted">${t('Hasil')}</span><b class="${r.win ? 'bad' : 'good'}">${r.win ? '🗡️ ' + t('Penyerang menang') : '🛡️ ' + t('Pertahanan bertahan')}</b></div>
      <div><span class="muted">${t('Total serangan')}</span><b>${num(r.x)}</b><span class="small muted">${Object.entries(r.trapped).filter(([, v]) => v > 0).map(([k, v]) => `${k} −${Math.round(v * 100)}% trap`).join(' · ')}</span></div>
      <div><span class="muted">${t('Total pertahanan')}</span><b>${num(r.w)}</b><span class="small muted">${t('rasio')} ${ratio === Infinity ? '∞' : ratio.toFixed(2)}</span></div>
      <div><span class="muted">${r.win ? t('Untuk bertahan, tambah') : t('Penyerang butuh')}</span>
        ${r.win ? `<b>+${num(extraNeed)} <select data-bt="extra" class="sm">${REV_UNITS.map((u) => `<option value="${u.id}" ${u.id === exU.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></b>`
          : `<b>×${atkNeed === Infinity ? '∞' : (atkNeed * 1.001).toFixed(2)}</b><span class="small muted">${t('pasukan yang sama untuk menang')}</span>`}</div>
    </div>
    <div class="two-col" style="margin-top:12px">
      <div class="card cs-card"><h3>🗡️ ${t('Kerugian penyerang')}</h3><table class="cs-tbl"><thead><tr><th>${t('Unit')}</th><th class="num">${t('Kirim')}</th><th class="num">${t('Mati')}</th><th class="num">${t('Sisa')}</th></tr></thead><tbody>${lossRows(r.A, r.attLoss)}</tbody></table></div>
      <div class="card cs-card"><h3>🛡️ ${t('Kerugian bertahan')} <span class="small muted">(${Math.round(r.defFrac * 100)}%)</span></h3>${r.D.length ? `<table class="cs-tbl"><thead><tr><th>${t('Unit')}</th><th class="num">${t('Ada')}</th><th class="num">${t('Mati')}</th><th class="num">${t('Sisa')}</th></tr></thead><tbody>${lossRows(r.D, r.defLoss)}</tbody></table>` : `<p class="small muted">${t('Tidak ada pasukan bertahan.')}</p>`}</div>
    </div>
    <p class="small muted">${t('Kerugian = nilai rata-rata; di game ada pembulatan acak. Siege/plunder menghitung kerugian lebih kecil (faktor misi). Kerusakan bangunan & klaim kota tidak dihitung.')}</p>`;
}

export function onInput(e, root, state, rerender) {
  const el = e.target;
  if (el.dataset.btact === 'attfrom' && el.value) {
    const [kind, id] = el.value.split(':');
    if (kind === 'city') {
      const c = state.cities[id];
      const tr = (state.movements?.training || []).find((x) => x.x === c?.x && x.y === c?.y);
      st.att = { ...(tr?.units || {}) };
      st.atkBonus = researchPct(state.movements?.research?.military || 0);
    } else {
      const a = (state.movements?.incoming || []).find((x) => x.id === id);
      st.att = { ...(a?.units || {}) };
      if (a?.order && ORDERS[a.order]) st.order = a.order;
    }
    persist(); rerender(); return true;
  }
  if (el.dataset.btact === 'deffrom' && el.value) {
    const c = state.cities[el.value];
    const tr = (state.movements?.training || []).find((x) => x.x === c?.x && x.y === c?.y);
    st.def = { ...(tr?.units || {}) };
    st.wall = c?.wallLevel || 0;
    st.defBonus = researchPct(state.movements?.research?.military || 0);
    st.tw = {}; st.tr = {};
    for (const [k, levels] of Object.entries(c?.towers || {})) {
      // the game sums the effects; express as count × average level
      const tot = levels.reduce((s, l) => s + lvlEff(k, l), 0);
      const lv = Math.max(...levels);
      const n = Math.round(tot / lvlEff(k, lv)) || levels.length;
      if (TOWERS[k]) st.tw[k] = { n, l: lv }; else if (TRAPS[k]) st.tr[k] = { n, l: lv };
    }
    persist(); rerender(); return true;
  }
  if (!el.dataset.bt) return false;
  const path = el.dataset.bt.split('.');
  const v = el.type === 'number' ? Math.max(0, +el.value || 0) : el.value;
  if (path.length === 1) st[path[0]] = v;
  else if (path.length === 2) st[path[0]] = { ...st[path[0]], [path[1]]: v };
  else st[path[0]] = { ...st[path[0]], [path[1]]: { ...(st[path[0]][path[1]] || {}), [path[2]]: v } };
  persist();
  if (path[0] === 'order') rerender(); else paint(root);
  return true;
}

export function onClick(e, state, rerender) {
  const a = e.target.closest('[data-btact]')?.dataset.btact;
  if (a === 'myres') { st.atkBonus = researchPct(state.movements?.research?.military || 0); persist(); rerender(); return true; }
  if (a === 'clratt') { st.att = {}; persist(); rerender(); return true; }
  if (a === 'clrdef') { st.def = {}; st.wall = 0; st.tw = {}; st.tr = {}; persist(); rerender(); return true; }
  return false;
}
