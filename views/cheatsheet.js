// "📜 Cheat Sheet" — Dungeons | Bosses | Recruit % | Troops Stats.
import { esc, RES_ICON } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import * as bld from './cs-buildings.js';
import * as bt from './cs-battle.js';
import {
  REV_UNITS, unitById, EFF, REV_DUNGEONS, DUNGEON_KINDS, DUNGEON_UNITS, dungeonLevel, dungeonNeed, raid, unitEff, progressMult,
  REV_BOSSES, BOSS_KINDS, BOSS_UNITS, BOSS_HP, BOSS_LOOT, BOSS_GOLD, bossNeed, bossFight,
  RECRUIT_GROUPS, RECRUIT_BLD_PCT, recruitTime, pctFor, COMMUNITY, RECRUIT_BLOCKS, RECRUIT_CAP, SHEET_NAMES, LAYOUTS, LAYOUT_URL, cityRecruitPct
} from '../lib/cheatsheet.js';

const LV = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const KIND_ICO = { mountain: '⛰️', forest: '🌲', hill: '🪨', sea: '🌊', dragon: '🐉', hydra: '🐍', moloch: '👹', octopus: '🐙' };
const TYPE_ICO = { infantry: '🗡️', cavalry: '🐎', magic: '✨', artillery: '🎯', naval: '⛵', none: '—' };

const st = { part: 'dungeons', src: 'rev', prog: 0, kind: 'all', boss: 'all', lay: 'land', pct: {}, calc: { kind: 'mountain', level: 5, unit: 'berserker', count: 3200, prog: 0 }, bcalc: { kind: 'dragon', level: 3, unit: 'knight', count: 800 } };
try { Object.assign(st, JSON.parse(localStorage.getItem('lou-cheat') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-cheat', JSON.stringify(st)); } catch {} };

let root, ctx;
const num = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString(locale()));
const rate = (v) => (v < 10 ? v.toFixed(1).replace(/\.0$/, '') : num(Math.floor(v)));
const pct = (f, d = 0) => (f * 100).toFixed(d).replace(/\.0+$/, '') + '%';
const typeLabel = (k) => `${TYPE_ICO[k] || ''} ${k[0].toUpperCase() + k.slice(1)}`;
const fmtSec = (s) => {
  if (s < 60) return (s < 10 ? s.toFixed(1).replace(/\.0$/, '') : Math.round(s)) + ' s';
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${m}m ${String(Math.round(s % 60)).padStart(2, '0')}s`;
};
const splitPills = (s) => ['wood', 'stone', 'iron', 'food'].map((r) => `<span class="pill">${RES_ICON[r]} ${s[r]}%</span>`).join(' ');
const lvHead = (first = t('Unit')) => `<tr><th>${first}</th>${LV.map((l) => `<th class="num">L${l}</th>`).join('')}</tr>`;

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow"><h2>📜 Cheat Sheet</h2><p>${t('Jumlah pasukan minimum/rekomendasi untuk Dungeon & Boss tiap level dan tipe, kecepatan rekrut, dan statistik pasukan.')}</p></div>
      <div class="seg" id="cs-seg">
        <button data-part="dungeons">⛰️ Dungeons</button>
        <button data-part="bosses">🐉 Bosses</button>
        <button data-part="recruit">⏱️ Recruit %</button>
        <button data-part="troops">🛡️ Troops Stats</button>
        <button data-part="layouts">🏗️ Layouts</button>
        <button data-part="buildings">🧱 Buildings</button>
        <button data-part="battle">⚔️ Battle</button>
      </div>
    </div>
    <div class="toolbar" id="cs-src-bar">
      <div class="seg" id="cs-src">
        <button data-src="rev" title="${esc(t('Dihitung dari rumus & data unit di game Lord of Ultima: Revival'))}">⚙️ ${t('Rumus game (Revival)')}</button>
        <button data-src="com" title="${esc(t('Tabel cheat sheet komunitas (angka LoU klasik)'))}">📋 ${t('Tabel komunitas')}</button>
      </div>
    </div>
    <div id="cs-body" class="cheat"></div>`;
  root.querySelector('#cs-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-part]');
    if (b) { st.part = b.dataset.part; persist(); render(); }
  });
  root.querySelector('#cs-src').addEventListener('click', (e) => {
    const b = e.target.closest('[data-src]');
    if (b) { st.src = b.dataset.src; persist(); render(); }
  });
  const body = root.querySelector('#cs-body');
  body.addEventListener('click', (e) => {
    if (st.part === 'battle' && bt.onClick(e, ctx.state, render)) return;
    const b = e.target.closest('[data-kind],[data-boss],[data-lay]');
    if (!b) return;
    if (b.dataset.kind) st.kind = b.dataset.kind; else if (b.dataset.lay) st.lay = b.dataset.lay; else st.boss = b.dataset.boss;
    persist(); render();
  });
  body.addEventListener('input', onInput);
  body.addEventListener('change', onInput);
}

function onInput(e) {
  const el = e.target;
  if (st.part === 'buildings' && bld.onInput(e, root, render)) return;
  if (st.part === 'battle' && (e.type === 'change' || el.type === 'number') && bt.onInput(e, root, ctx.state, render)) return;
  if (el.id === 'cs-prog') { st.prog = clamp(+el.value, 0, 100); persist(); renderTables(); return; }
  if (el.dataset.calc) { st.calc[el.dataset.calc] = el.type === 'number' ? +el.value : el.value; persist(); if (el.dataset.calc === 'kind') { fixUnit(st.calc, DUNGEON_UNITS); render(); } else paintCalc(); return; }
  if (el.dataset.bcalc) { st.bcalc[el.dataset.bcalc] = el.type === 'number' ? +el.value : el.value; persist(); if (el.dataset.bcalc === 'kind') { fixUnit(st.bcalc, BOSS_UNITS, true); render(); } else paintBossCalc(); return; }
  if (el.dataset.grp != null) { st.pct[el.dataset.grp] = Math.max(0, +el.value || 0); st.recCity = ''; persist(); paintRecCity(); renderRecruitTables(); }
  if (el.id === 'cs-rec-city') { st.recCity = el.value; fillFromCity(); persist(); render(); }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, isNaN(v) ? a : v));
function fixUnit(c, pool, boss) {
  const water = boss ? REV_BOSSES[c.kind].water : c.kind === 'sea';
  const list = water ? pool.sea : pool.land;
  if (!list.includes(c.unit)) c.unit = list[0];
}

export function render() {
  if (!root) return;
  root.querySelectorAll('#cs-seg [data-part]').forEach((b) => b.classList.toggle('on', b.dataset.part === st.part));
  root.querySelectorAll('#cs-src [data-src]').forEach((b) => b.classList.toggle('on', b.dataset.src === st.src));
  root.querySelector('#cs-src-bar').classList.toggle('hide', ['troops', 'layouts', 'buildings', 'battle'].includes(st.part));
  const body = root.querySelector('#cs-body');
  const com = st.src === 'com' && ['dungeons', 'bosses', 'recruit'].includes(st.part);
  body.innerHTML = st.part === 'bosses' ? (com ? comBosses() : revBosses())
    : st.part === 'recruit' ? (com ? comRecruit() : revRecruit())
    : st.part === 'troops' ? troops()
    : st.part === 'layouts' ? layouts()
    : st.part === 'buildings' ? bld.html(ctx.state)
    : st.part === 'battle' ? bt.html(ctx.state)
    : (com ? comDungeons() : revDungeons());
  if (!com && st.part === 'dungeons') { renderTables(); paintCalc(); }
  if (!com && st.part === 'bosses') paintBossCalc();
  if (!com && st.part === 'recruit') { paintRecCity(); renderRecruitTables(); }
  if (st.part === 'buildings') bld.paint(root);
  if (st.part === 'battle') bt.paint(root);
}

// ================= Dungeons (Revival) =================
function kindSeg(attr, cur, kinds, names) {
  return `<div class="seg">${['all', ...kinds].map((k) => `<button data-${attr}="${k}" class="${cur === k ? 'on' : ''}">${k === 'all' ? t('Semua') : `${KIND_ICO[k]} ${names[k]}`}</button>`).join('')}</div>`;
}
function revDungeons() {
  const names = Object.fromEntries(DUNGEON_KINDS.map((k) => [k, REV_DUNGEONS[k].name.replace(' Dungeon', '')]));
  return `
    <div class="toolbar">
      ${kindSeg('kind', st.kind, DUNGEON_KINDS, names)}
      <label class="field">${t('Explored %')}<input type="number" id="cs-prog" min="0" max="100" step="5" value="${st.prog}"></label>
      <span class="small muted" id="cs-mult"></span>
    </div>
    <div class="card cs-note small">
      ${t('<b>Rekomendasi</b> = jumlah minimum satu jenis unit agar <b>seluruh max loot terangkut</b> dan <b>kekuatan serangan ≥ kekuatan dungeon</b> (kerugian ≤ 10%). Arahkan kursor ke angka untuk detail.')}
      ${t('Kekuatan & loot dungeon naik seiring Explored % (×1 di 0%, ×1.5 di 50%, ×2 di 75%, ×3 di 100%), ±5% acak. Tiap raid yang membawa pulang max loot menambah Explored +2.5%.')}
      ${t('Baris yang disorot = tipe unit paling efektif (efisiensi 100%); tipe lain 67%, artileri 50%. Dungeon laut hanya bisa diraid kapal.')}
    </div>
    ${calcCard()}
    <div id="cs-tables"></div>`;
}
function renderTables() {
  const box = root.querySelector('#cs-tables');
  if (!box) return;
  root.querySelector('#cs-mult').textContent = t('Pengali kekuatan & loot: ×{m}', { m: progressMult(st.prog).toFixed(2).replace(/\.?0+$/, '') });
  const kinds = st.kind === 'all' ? DUNGEON_KINDS : [st.kind];
  box.innerHTML = kinds.map((k) => dungeonCard(k)).join('');
}
function dungeonCard(kind) {
  const d = REV_DUNGEONS[kind];
  const units = (kind === 'sea' ? DUNGEON_UNITS.sea : DUNGEON_UNITS.land).map(unitById);
  const L = LV.map((l) => dungeonLevel(kind, l, st.prog));
  const rows = units.map((u) => {
    const eff = unitEff(u, kind);
    const cells = LV.map((l) => {
      const r = dungeonNeed(kind, l, st.prog, u);
      if (!r) return '<td class="num muted">—</td>';
      const tip = t('Serang ≥ {a} unit · angkut ≥ {c} unit · rugi ±{p}', { a: num(r.byAtk), c: num(r.byCarry), p: pct(r.lossFrac, 1) });
      return `<td class="num" title="${esc(tip)}">${num(r.n)}</td>`;
    }).join('');
    return `<tr class="${eff >= 1 ? 'best' : ''}"><td><b>${esc(u.name)}</b> <span class="small muted">${pct(eff)} · ${t('bawa')} ${u.carry}</span></td>${cells}</tr>`;
  }).join('');
  const stat = (label, f) => `<tr class="stat"><td>${label}</td>${L.map((x) => `<td class="num">${f(x)}</td>`).join('')}</tr>`;
  return `<div class="card cs-card">
    <div class="cs-card-head">
      <h3>${KIND_ICO[kind]} ${esc(d.name)}</h3>
      <span class="pill good">${t('Lemah terhadap')}: ${typeLabel(d.weak)}</span>
      ${splitPills(d.split)}
    </div>
    <p class="small muted">${t('Monster')}: ${d.monsters.map(([n, l]) => `${esc(n)} (${t('loot')} ${l})`).join(' · ')}</p>
    <div class="tbl-wrap"><table class="cs-tbl">
      <thead>${lvHead()}</thead>
      <tbody>${rows}
        ${stat(t('Kekuatan dungeon'), (x) => num(x.strength))}
        ${stat(t('Max loot'), (x) => num(x.loot))}
        ${stat(t('Gold / loot'), (x) => pct(x.goldPct))}
        ${stat(t('Max gold'), (x) => num(x.gold))}
      </tbody></table></div>
  </div>`;
}
function unitOptions(list, cur) {
  return list.map((id) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${esc(unitById(id).name)}</option>`).join('');
}
function calcCard() {
  const c = st.calc;
  fixUnit(c, DUNGEON_UNITS);
  const list = c.kind === 'sea' ? DUNGEON_UNITS.sea : DUNGEON_UNITS.land;
  return `<div class="card cs-calc">
    <h3>🧮 ${t('Kalkulator raid')}</h3>
    <div class="toolbar">
      <label class="field">${t('Tipe')}<select data-calc="kind">${DUNGEON_KINDS.map((k) => `<option value="${k}" ${k === c.kind ? 'selected' : ''}>${KIND_ICO[k]} ${esc(REV_DUNGEONS[k].name)}</option>`).join('')}</select></label>
      <label class="field">${t('Level')}<select data-calc="level">${LV.map((l) => `<option ${l === +c.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">${t('Explored %')}<input type="number" data-calc="prog" min="0" max="100" value="${c.prog}"></label>
      <label class="field">${t('Unit')}<select data-calc="unit">${unitOptions(list, c.unit)}</select></label>
      <label class="field">${t('Jumlah')}<input type="number" data-calc="count" min="1" value="${c.count}"></label>
    </div>
    <div class="cs-res" id="cs-calc-res"></div>
  </div>`;
}
function paintCalc() {
  const box = root.querySelector('#cs-calc-res');
  if (!box) return;
  const c = st.calc;
  const u = unitById(c.unit), lvl = +c.level, prog = clamp(+c.prog, 0, 100), n = Math.max(1, +c.count || 1);
  const r = raid(c.kind, lvl, prog, u, n);
  const need = dungeonNeed(c.kind, lvl, prog, u);
  const full = r.carried >= r.loot;
  box.innerHTML = `
    <div><span class="muted">${t('Kekuatan serangan')}</span><b>${num(r.atk)}</b><span class="small muted">${t('vs kekuatan dungeon')} ${num(r.strength)}</span></div>
    <div><span class="muted">${t('Perkiraan kerugian')}</span><b class="${r.lossFrac > 0.1 ? 'bad' : 'good'}">${num(r.lost)} (${pct(r.lossFrac, 1)})</b></div>
    <div><span class="muted">${t('Loot terbawa')}</span><b class="${full ? 'good' : 'warn'}">${num(r.carried)} / ${num(r.loot)}</b><span class="small muted">+ ${num(r.goldGot)} ${t('gold')}</span></div>
    <div><span class="muted">${t('Explored setelah raid')}</span><b>+${r.explore}%</b></div>
    <div><span class="muted">${t('Rekomendasi')}</span><b>${need ? num(need.n) : '—'}</b><span class="small muted">${esc(u.name)}</span></div>`;
}

// ================= Bosses (Revival) =================
function revBosses() {
  const names = Object.fromEntries(BOSS_KINDS.map((k) => [k, REV_BOSSES[k].name]));
  const kinds = st.boss === 'all' ? BOSS_KINDS : [st.boss];
  return `
    <div class="toolbar">${kindSeg('boss', st.boss, BOSS_KINDS, names)}</div>
    <div class="card cs-note small">
      ${t('<b>Kill pasti</b> bila total serangan ≥ 4 × HP boss. Unit yang cocok dengan kelemahan boss mendapat serangan ×1.5. Di bawah itu peluang menang = √(serangan ÷ 4HP), atau 2 × rasio bila < 25%.')}
      ${t('Angka di tabel = jumlah minimum satu jenis unit untuk kill pasti (HP penuh). Kapal hanya untuk Kraken; unit darat untuk boss darat.')}
    </div>
    ${bossCalcCard()}
    ${kinds.map(bossCard).join('')}`;
}
function bossCard(kind) {
  const b = REV_BOSSES[kind];
  const units = (b.water ? BOSS_UNITS.sea : BOSS_UNITS.land).map(unitById);
  const rows = units.map((u) => {
    const cells = LV.map((l) => {
      const r = bossNeed(kind, l, u);
      const tip = t('Rugi ±{p} · angkut max loot: {c} unit', { p: pct(r.lossFrac, 1), c: r.carryN == null ? '—' : num(r.carryN) });
      return `<td class="num" title="${esc(tip)}">${num(r.n)}</td>`;
    }).join('');
    return `<tr class="${b.weak === u.type ? 'best' : ''}"><td><b>${esc(u.name)}</b> <span class="small muted">${t('atk')} ${u.atk}${b.weak === u.type ? ' ×1.5' : ''}</span></td>${cells}</tr>`;
  }).join('');
  const stat = (label, f) => `<tr class="stat"><td>${label}</td>${LV.map((l) => `<td class="num">${f(l - 1)}</td>`).join('')}</tr>`;
  return `<div class="card cs-card">
    <div class="cs-card-head">
      <h3>${KIND_ICO[kind]} ${esc(b.name)}</h3>
      <span class="pill good">${t('Lemah terhadap')}: ${typeLabel(b.weak)}</span>
      ${splitPills(b.split)}
    </div>
    <div class="tbl-wrap"><table class="cs-tbl">
      <thead>${lvHead()}</thead>
      <tbody>${rows}
        ${stat('HP', (i) => num(BOSS_HP[i]))}
        ${stat(t('Serangan untuk kill pasti'), (i) => num(BOSS_HP[i] * 4))}
        ${stat(t('Max loot'), (i) => num(BOSS_LOOT[i]))}
        ${stat(t('Gold / loot'), (i) => pct(BOSS_GOLD[i]))}
        ${stat(t('Max gold'), (i) => num(Math.round(BOSS_LOOT[i] * BOSS_GOLD[i])))}
      </tbody></table></div>
  </div>`;
}
function bossCalcCard() {
  const c = st.bcalc;
  fixUnit(c, BOSS_UNITS, true);
  const list = REV_BOSSES[c.kind].water ? BOSS_UNITS.sea : BOSS_UNITS.land;
  return `<div class="card cs-calc">
    <h3>🧮 ${t('Kalkulator boss')}</h3>
    <div class="toolbar">
      <label class="field">${t('Boss')}<select data-bcalc="kind">${BOSS_KINDS.map((k) => `<option value="${k}" ${k === c.kind ? 'selected' : ''}>${KIND_ICO[k]} ${esc(REV_BOSSES[k].name)}</option>`).join('')}</select></label>
      <label class="field">${t('Level')}<select data-bcalc="level">${LV.map((l) => `<option ${l === +c.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">${t('Unit')}<select data-bcalc="unit">${unitOptions(list, c.unit)}</select></label>
      <label class="field">${t('Jumlah')}<input type="number" data-bcalc="count" min="1" value="${c.count}"></label>
    </div>
    <div class="cs-res" id="cs-bcalc-res"></div>
  </div>`;
}
function paintBossCalc() {
  const box = root.querySelector('#cs-bcalc-res');
  if (!box) return;
  const c = st.bcalc;
  const u = unitById(c.unit), lvl = +c.level, n = Math.max(1, +c.count || 1);
  const r = bossFight(c.kind, lvl, u, n), need = bossNeed(c.kind, lvl, u);
  box.innerHTML = `
    <div><span class="muted">${t('Kekuatan serangan')}</span><b>${num(r.power)}</b><span class="small muted">${t('butuh')} ${num(r.need)}</span></div>
    <div><span class="muted">${t('Peluang kill')}</span><b class="${r.chance >= 1 ? 'good' : r.chance >= 0.5 ? 'warn' : 'bad'}">${pct(r.chance, 1)}</b></div>
    <div><span class="muted">${t('Perkiraan kerugian')}</span><b>${num(n * r.lossFrac)} (${pct(r.lossFrac, 1)})</b></div>
    <div><span class="muted">${t('Loot bila kill')}</span><b>${num(r.loot)}</b><span class="small muted">+ ${num(r.gold)} ${t('gold')}</span></div>
    <div><span class="muted">${t('Minimum kill pasti')}</span><b>${need ? num(need.n) : '—'}</b><span class="small muted">${esc(u.name)}</span></div>`;
}

// ================= Recruit % (Revival) =================
function revRecruit() {
  return `
    <div class="card cs-note small">
      ${t('Waktu rekrut per unit = waktu dasar × 100 ÷ (100 + recruit speed %). Recruit speed % = jumlah efek semua bangunan rekrut sejenis di kota (+ Barracks yang menempel). Isi % kotamu untuk melihat waktu per unit.')}
    </div>
    <div class="card cs-card">
      <h3>⏱️ ${t('Recruit speed % kotamu')}</h3>
      <div class="toolbar">
        <label class="field">🏰 ${t('Isi otomatis dari kota')}<select id="cs-rec-city"><option value="">— ${t('manual')} —</option>${liveCities().map((l) => `<option value="${l.id}" ${st.recCity === l.id ? 'selected' : ''}>${esc(l.cityName || l.name)}${l.cityKey ? ` (${l.cityKey})` : ''}</option>`).join('')}</select></label>
        <span class="small muted grow" id="cs-rec-info"></span>
      </div>
      <div class="toolbar">${RECRUIT_GROUPS.map((g, i) => `<label class="field">${esc(g.bld)}<input type="number" min="0" step="5" data-grp="${i}" value="${st.pct[i] || 0}"></label>`).join('')}</div>
      <p class="small muted">${t('Efek per bangunan (level 1→10)')}: ${RECRUIT_BLD_PCT.map((p, i) => `L${i + 1} ${p}%`).join(' · ')}</p>
      <div class="tbl-wrap" id="cs-rec-now"></div>
    </div>
    <div class="card cs-card">
      <h3>🎯 ${t('Recruit speed % yang dibutuhkan')}</h3>
      <p class="small muted">${t('Kolom = target waktu per unit. Hijau = sudah tercapai dengan % kotamu.')} ${t('"—" = butuh lebih dari {c}% (≈ 100 bangunan rekrut level 10 × 150%), praktis tidak bisa dicapai.', { c: num(RECRUIT_CAP) })}</p>
    </div>
    <div id="cs-rec-need"></div>`;
}
// cities whose real layout is synced from the game
const liveCities = () => (ctx?.state?.layouts || []).filter((l) => l.source === 'game' && l.live).sort((a, b) => String(a.cityName).localeCompare(String(b.cityName), 'id', { numeric: true }));
function fillFromCity() {
  const l = liveCities().find((x) => x.id === st.recCity);
  if (!l) { st.recCity = ''; return null; }
  const r = cityRecruitPct(l);
  r.forEach((g, i) => { st.pct[i] = g.pct; });
  return { l, r };
}
function paintRecCity() {
  const info = root.querySelector('#cs-rec-info'), sel = root.querySelector('#cs-rec-city');
  if (!info) return;
  if (sel) sel.value = st.recCity || '';
  const f = st.recCity ? fillFromCity() : null;
  if (!f) { info.textContent = t('Pilih kota untuk mengisi recruit speed % dari layout kotanya (sinkron otomatis dari game).'); return; }
  const parts = f.r.map((g, i) => (g.n ? `${RECRUIT_GROUPS[i].bld} ×${g.n}${g.barracks ? ` + ${g.barracks} Barracks` : ''} = ${g.pct}%` : null)).filter(Boolean);
  info.innerHTML = `${t('Dari layout {c}', { c: `<b>${esc(f.l.cityName || f.l.name)}</b>` })}: ${parts.length ? esc(parts.join(' · ')) : t('belum ada bangunan rekrut')}`;
  root.querySelectorAll('[data-grp]').forEach((inp) => { inp.value = st.pct[inp.dataset.grp] || 0; });
}
function renderRecruitTables() {
  const now = root.querySelector('#cs-rec-now'), need = root.querySelector('#cs-rec-need');
  if (!now) return;
  const rows = [];
  RECRUIT_GROUPS.forEach((g, gi) => g.units.forEach((id) => rows.push({ u: unitById(id), p: st.pct[gi] || 0, g })));
  now.innerHTML = `<table class="cs-tbl"><thead><tr><th>${t('Unit')}</th><th>${t('Bangunan')}</th><th class="num">${t('Waktu dasar')}</th><th class="num">${t('Waktu kamu')}</th><th class="num">${t('Per jam')}</th><th class="num">${t('Per hari')}</th></tr></thead><tbody>
    ${rows.map(({ u, p }) => { const s = recruitTime(u.sec, p); return `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.bld)} ${u.lvl}</td><td class="num">${fmtSec(u.sec)}</td><td class="num"><b>${fmtSec(s)}</b></td><td class="num">${rate(3600 / s)}</td><td class="num">${rate(86400 / s)}</td></tr>`; }).join('')}
  </tbody></table>`;
  const grpPct = (id) => st.pct[RECRUIT_GROUPS.findIndex((g) => g.units.includes(id))] || 0;
  const colHead = (s, unit) => (unit === 60 ? `${s / 60}m` : `${s}s`);
  need.innerHTML = RECRUIT_BLOCKS.map((b) => `<div class="card cs-card"><div class="tbl-wrap"><table class="cs-tbl cs-rec"><thead><tr><th>${t('Unit')}</th>${b.times.map((s) => `<th class="num">${colHead(s, b.unit)}</th>`).join('')}</tr></thead><tbody>
    ${b.units.map((id) => { const u = unitById(id), p = grpPct(id); return `<tr><td><b>${esc(u.name)}</b> <span class="small muted">${fmtSec(u.sec)}</span></td>${b.times.map((s) => { const v = pctFor(u.sec, s); return v > RECRUIT_CAP ? '<td class="num muted">—</td>' : `<td class="num ${v <= p ? 'ok' : ''}">${num(v)}</td>`; }).join('')}</tr>`; }).join('')}
  </tbody></table></div></div>`).join('');
}

// ================= Troops Stats =================
function troops() {
  const costs = (c) => Object.entries(c).map(([k, v]) => `${RES_ICON[k] || k} ${num(v)}`).join(' ');
  const effs = (u) => ['mountain', 'forest', 'hill', 'sea'].map((k) => { const v = EFF[u.eff]?.[k] ?? 0; return `<td class="num ${v >= 1 ? 'ok' : v ? '' : 'muted'}">${v ? pct(v) : '—'}</td>`; }).join('');
  return `
    <div class="card cs-note small">${t('Statistik unit dari data game Lord of Ultima: Revival. Kecepatan = menit per field (lebih kecil = lebih cepat), sebelum bonus. Efisiensi dungeon = pengali serangan unit di tiap tipe dungeon.')}</div>
    <div class="card cs-card"><div class="tbl-wrap"><table class="cs-tbl cs-troops">
      <thead>
        <tr><th rowspan="2">${t('Unit')}</th><th rowspan="2">${t('Tipe')}</th><th rowspan="2" class="num">${t('Serang')}</th><th colspan="4" class="c">${t('Bertahan vs')}</th><th rowspan="2" class="num">${t('Kecepatan')}</th><th rowspan="2" class="num">${t('Angkut')}</th><th rowspan="2" class="num">${t('Ruang')}</th><th rowspan="2" class="num">${t('Serang/ruang')}</th><th rowspan="2">${t('Biaya')}</th><th rowspan="2" class="num">${t('Makan/hari')}</th><th rowspan="2" class="num">${t('Rekrut')}</th><th rowspan="2">${t('Bangunan')}</th><th colspan="4" class="c">${t('Efisiensi dungeon')}</th></tr>
        <tr><th class="num">🗡️</th><th class="num">🐎</th><th class="num">✨</th><th class="num">🎯</th><th class="num">⛰️</th><th class="num">🌲</th><th class="num">🪨</th><th class="num">🌊</th></tr>
      </thead>
      <tbody>${REV_UNITS.map((u) => `<tr>
        <td><b>${esc(u.name)}</b>${u.castle ? ' <span class="pill" title="' + esc(t('Butuh kastil')) + '">🏰</span>' : ''}${u.note ? `<div class="small muted">${esc(u.note)}</div>` : ''}</td>
        <td>${typeLabel(u.type)}</td><td class="num"><b>${num(u.atk)}</b></td>
        ${u.def.map((d) => `<td class="num">${num(d)}</td>`).join('')}
        <td class="num">${u.spd || '—'}</td><td class="num">${num(u.carry)}</td><td class="num">${u.space}</td>
        <td class="num">${u.space ? (u.atk / u.space).toFixed(1).replace(/\.0$/, '') : '—'}</td>
        <td class="nowrap">${costs(u.cost)}</td><td class="num">${num(u.food)}</td><td class="num">${fmtSec(u.sec)}</td>
        <td>${esc(u.bld)} ${u.lvl}</td>${effs(u)}</tr>`).join('')}</tbody>
    </table></div></div>`;
}

// ================= Community tables =================
const comNote = () => `<div class="card cs-note small">${t('Tabel cheat sheet komunitas (angka LoU klasik) — sebagai referensi. Angka bisa berbeda dari rumus Revival.')}</div>`;
const cell = (v) => `<td class="num">${v == null ? '<span class="muted">—</span>' : typeof v === 'number' ? num(v) : esc(v)}</td>`;
function comTable(rows, first = t('Unit')) {
  return `<div class="tbl-wrap"><table class="cs-tbl"><thead>${lvHead(first)}</thead><tbody>${rows.map(([n, vals]) => `<tr><td><b>${esc(n)}</b></td>${vals.map(cell).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function comDungeons() {
  const C = COMMUNITY.dungeons;
  const RES = ['wood', 'stone', 'iron', 'food'];
  return comNote() + `
    <div class="card cs-card"><h3>📦 ${t('Distribusi resource')}</h3><div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Tipe')}</th>${RES.map((r) => `<th class="num">${RES_ICON[r]}</th>`).join('')}<th>${t('Lemah terhadap')}</th></tr></thead><tbody>
      ${['forest', 'hill', 'mountain', 'sea'].map((k) => `<tr><td><b>${KIND_ICO[k]} ${k[0].toUpperCase() + k.slice(1)}</b></td>${C.split[k].map((v) => `<td class="num">${v}%</td>`).join('')}<td>${C.weak[k]}</td></tr>`).join('')}
    </tbody></table></div></div>
    ${['mountain', 'forest', 'hill', 'sea'].map((k) => `<div class="card cs-card"><div class="cs-card-head"><h3>${KIND_ICO[k]} ${k.toUpperCase()}</h3><span class="pill good">${t('Lemah terhadap')}: ${C.weak[k]}</span></div>${comTable(C.units[k])}</div>`).join('')}
    <div class="card cs-card"><h3>📊 ${t('Statistik per level')}</h3>${comTable(C.stats, '')}</div>`;
}
function comBosses() {
  const C = COMMUNITY.bosses;
  return comNote() + `
    <div class="card cs-card"><h3>💰 ${t('Loot boss')}</h3>${comTable(C.stats, '')}
      <p class="small muted">${t('Kelemahan')}: ${BOSS_KINDS.map((k) => `${KIND_ICO[k]} ${k === 'octopus' ? 'Octopus' : REV_BOSSES[k].name} = ${C.weak[k]}`).join(' · ')}</p></div>
    ${BOSS_KINDS.map((k) => `<div class="card cs-card"><div class="cs-card-head"><h3>${KIND_ICO[k]} ${k.toUpperCase()}</h3><span class="pill good">${t('Lemah terhadap')}: ${C.weak[k]}</span><span class="small muted">${t('Unit untuk kill pasti')}</span></div>${comTable(C.units[k])}</div>`).join('')}`;
}
function comRecruit() {
  return comNote() + `<p class="small muted">${t('Recruit speed % yang dibutuhkan untuk mencapai waktu rekrut per unit (detik). "—" = tidak mungkin.')}</p>` +
    COMMUNITY.recruit.map((blk) => {
      const n = Math.max(...blk.rows.map((r) => r[1].length));
      const secs = Array.from({ length: n }, (_, i) => blk.from + i);
      return `<div class="card cs-card"><div class="tbl-wrap"><table class="cs-tbl cs-rec"><thead><tr><th>${t('Unit')}</th>${secs.map((s) => `<th class="num">${s}s</th>`).join('')}</tr></thead><tbody>
        ${blk.rows.map(([nm, vals]) => `<tr><td title="${esc(t('Nama di cheat sheet: {n}', { n: nm }))}"><b>${esc(SHEET_NAMES[nm] || nm)}</b></td>${secs.map((_, i) => cell(vals[i])).join('')}</tr>`).join('')}
      </tbody></table></div></div>`;
    }).join('');
}

// ================= Layouts (community) =================
const LAY_COLOR = { infantry: '#6aa84f', cavalry: '#e8b83c', magic: '#e69138', trinsic: '#c27ba0', artillery: '#6fa8dc', naval: '#76d7ea' };
const layColor = (id) => (['templar', 'paladin'].includes(id) ? LAY_COLOR.trinsic : id === 'ram_catapult' ? LAY_COLOR.artillery : LAY_COLOR[unitById(id).naval ? 'naval' : unitById(id).type]);
const firstNum = (str) => parseFloat(String(str).split('(')[0].replace(/[^\d.]/g, '')) || 0;
const lnk = (code) => (code ? `<a href="${LAYOUT_URL(code)}" target="_blank" rel="noopener" title="${LAYOUT_URL(code)}">🔗 ${esc(code)}</a>` : '<span class="muted">—</span>');
const fmtHours = (sec) => (sec >= 86400 * 2 ? `${num(sec / 3600)} h / ${(sec / 86400).toFixed(1)} d` : `${num(sec / 3600)} h`);
function revCell(ids, counts, speed) {
  const per = ids.map((id) => recruitTime(unitById(id).sec, speed));
  const total = per.reduce((a, p, i) => a + p * counts[i], 0);
  const tip = t('Di Revival dengan speed % yang sama: {u} per unit, isi penuh TS {h}', { u: per.map((p) => fmtSec(p)).join(' / '), h: fmtHours(total) });
  return `<td class="num rev" title="${esc(tip)}">${per.map((p) => fmtSec(p)).join(' / ')} · ${fmtHours(total)}</td>`;
}
function layouts() {
  const water = st.lay === 'water';
  const blocks = LAYOUTS[water ? 'water' : 'land'];
  return `
    <div class="toolbar"><div class="seg">
      <button data-lay="land" class="${!water ? 'on' : ''}">🏔️ Land</button>
      <button data-lay="water" class="${water ? 'on' : ''}">🌊 Sea / Water</button>
    </div></div>
    <div class="card cs-note small">
      ${t('Layout kota militer dari cheat sheet komunitas (planner <b>cotgopt.com</b>, angka LoU klasik). Baris = target waktu rekrut per unit; <b>Speed (%)</b> = recruit speed % yang dicapai layout (dalam kurung: minimum yang dibutuhkan); <b>#</b> = jumlah bangunan rekrut; <b>Recruit time</b> = waktu mengisi seluruh TS (troop space).')}
      ${t('Kolom <b>⚙️ Revival</b> = perkiraan di Revival dengan speed % yang sama (waktu dasar unit Revival): waktu per unit · waktu isi penuh TS.')}
      ${t('Kode link ditranskrip dari gambar sheet; jika satu link tidak terbuka, cek huruf yang mirip (l / I / 1, O / 0).')}
    </div>
    <div class="lay-grid">${blocks.map((b) => layoutCard(b, water)).join('')}</div>`;
}
function layoutCard(b, water) {
  const ids = b.units || [b.unit];
  const title = b.mix ? 'Ram / Catapult' : unitById(b.unit).name;
  const space = (id) => unitById(id).space || 1;
  let head, body;
  if (water) {
    head = ['TS', 'Speed (%)', 'Layout', 'Recruit time'];
    body = b.rows.map(([lab, ts, sp, code, time]) => { const S = firstNum(sp), T = firstNum(ts) * 1000;
      return `<tr><td><b>${esc(lab)}</b></td><td class="num">${esc(ts)}</td><td class="num">${esc(sp)}</td><td>${lnk(code)}</td><td class="num">${esc(time)}</td>${revCell(ids, [T / space(b.unit)], S)}</tr>`; });
  } else if (b.mix) {
    head = ['TS', 'Speed (%)', '#', 'Layout', 'Catapults*', 'Rams*', 'Recruit time*', 'Backup'];
    body = b.rows.map(([lab, ts, sp, n, code, cats, rams, time, bk]) =>
      `<tr><td><b>${esc(lab)}</b></td><td class="num">${esc(ts)}</td><td class="num">${esc(sp)}</td><td class="num">${esc(n)}</td><td>${lnk(code)}</td><td class="num">${num(+cats)}</td><td class="num">${num(+rams)}</td><td class="num">${esc(time)}</td><td class="num">${esc(bk)}</td>${revCell(['catapult', 'ram'], [+cats, +rams], firstNum(sp))}</tr>`);
  } else {
    head = ['TS', 'Speed (%)', '#', 'Layout (MAX)', 'Layout (raid)', 'Backup', 'Recruit time'];
    body = b.rows.map(([lab, ts, sp, n, max, raid, bk, time]) => { const S = firstNum(sp), T = firstNum(ts) * 1000;
      return `<tr><td><b>${esc(lab)}</b></td><td class="num">${esc(ts)}</td><td class="num">${esc(sp)}</td><td class="num">${esc(n)}</td><td>${lnk(max)}</td><td>${lnk(raid)}</td><td class="num">${esc(bk)}</td><td class="num">${esc(time)}</td>${revCell(ids, [T / space(b.unit)], S)}</tr>`; });
  }
  return `<div class="card cs-card lay-card" style="--lay:${layColor(b.unit)}">
    <div class="tbl-wrap"><table class="cs-tbl cs-lay"><thead><tr><th class="lay-unit">${esc(title)}</th>${head.map((h) => `<th class="${/Layout/.test(h) ? '' : 'num'}">${h}</th>`).join('')}<th class="num" title="${esc(t('Perkiraan di Revival'))}">⚙️ Revival</th></tr></thead>
    <tbody>${body.join('')}</tbody></table></div>
    ${b.mix ? `<p class="small muted">* ${t('untuk rasio 4:1 (catapult:ram).')}</p>` : ''}
  </div>`;
}

// Static reference data: ignore game-data refreshes (keeps inputs focused while typing).
export function onData() {}
