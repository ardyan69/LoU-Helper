// "🧠 Rekomendasi" dialog for the layout planner.
import { esc, fmtNum } from '../lib/shared.js';
import { B, isBuilding, cityStats } from '../lib/city.js';
import { goldPlan, tradeCap } from '../lib/templates.js';
import { optimize, ECON } from '../lib/optimizer.js';
import { ico } from '../lib/icons.js';
import { t } from '../lib/i18n.js';
import { miniMap } from './layout-tools.js';

const RES = ['wood', 'stone', 'iron', 'food'];
const RES_N = new Proxy({ wood: 'Kayu', stone: 'Batu', iron: 'Besi', food: 'Makanan' }, { get: (o, k) => (o[k] ? t(o[k]) : o[k]) });
const RES_I = { wood: '🪵', stone: '🪨', iron: '⛏️', food: '🌾' };
const GOALS = {
  auto: { label: '🌿 Otomatis dari node alam (rasio otomatis)', goal: { type: 'auto' } },
  wood: { label: '🪵 Kayu maksimal', goal: { type: 'weights', weights: { wood: 1 } } },
  stone: { label: '🪨 Batu maksimal', goal: { type: 'weights', weights: { stone: 1 } } },
  iron: { label: '⛏️ Besi maksimal', goal: { type: 'weights', weights: { iron: 1 } } },
  food: { label: '🌾 Makanan maksimal', goal: { type: 'weights', weights: { food: 1 } } },
  r3: { label: '⚖️ Seimbang kayu : batu : besi (1:1:1)', goal: { type: 'ratio', ratio: { wood: 1, stone: 1, iron: 1 } } },
  r4: { label: '⚖️ Seimbang semua resource (1:1:1:1)', goal: { type: 'ratio', ratio: { wood: 1, stone: 1, iron: 1, food: 1 } } },
  custom: { label: '✏️ Rasio kustom…', goal: null },
  gold: { label: '💰 Emas maksimal (Townhouse & Marketplace)', goal: { type: 'gold' } }
};
// with the gold goal, Townhouses & Marketplaces are part of the economy that may be rearranged
const GOLD_SET = [...ECON, 'U', 'P'];
const econSet = () => (state.goal === 'gold' ? GOLD_SET : ECON);
const QUALITY = { fast: [100000, 1], normal: [200000, 2], best: [600000, 3] };

let dlg;
const state = { goal: 'r3', mode: 'econ', level: 10, cottage: true, quality: 'normal', ratio: { wood: 40, stone: 30, iron: 20, food: 10 }, seed: 1,
  rmNodes: false, rmTypes: ['.', ':', ','], rmMin: 250, autoFood: true };
const NODE_OPTS = [['.', 'Forest'], [':', 'Rocks'], [',', 'Ore Deposit'], [';', 'Lake']];
let plan, limit, onSave, last = null, running = false;

export function openOptimizer(currentPlan, buildingLimit, saveCb) {
  plan = currentPlan;
  limit = buildingLimit;
  onSave = saveCb;
  last = null;
  if (!dlg) build();
  syncForm(true);
  dlg.querySelector('#o-result').innerHTML = '';
  dlg.showModal();
}

function counts(p) {
  let all = 0, econ = 0;
  const set = econSet();
  for (const c of p.cells) if (isBuilding(c)) { all++; if (set.includes(c)) econ++; }
  return { all, econ, other: all - econ };
}
function defaultBudget() {
  const c = counts(plan);
  if (state.mode === 'fill') return Math.max(0, limit - c.all);
  return Math.max(0, limit - c.other);
}

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'optdlg';
  dlg.innerHTML = `
    <div class="row"><h3 class="grow">🧠 ${t('Rekomendasi penempatan')}</h3><button class="btn sm" id="o-close">✕</button></div>
    <p class="small muted" style="margin:4px 0 12px">${t('Node alam (hutan, batu, bijih besi, danau) tetap di tempatnya, kecuali kamu izinkan dihapus di bawah. Extension menyusun <b>bangunan produksi</b>, <b>pengolahan</b>, dan <b>Cottage</b> untuk produksi terbesar, memakai rumus produksi game.')}</p>
    <div class="ogrid">
      <label class="field">${t('Tujuan')}
        <select id="o-goal">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}">${t(g.label)}</option>`).join('')}</select>
      </label>
      <div class="field cs-note small" id="o-auto-note" style="grid-column:1/-1">🌿 ${t('Rasio dipilih otomatis dari node alam kota ini: extension menghitung dulu produksi maksimal tiap resource bila kota hanya fokus ke resource itu (potensi), lalu memakai potensi itu sebagai rasio dan mencari susunan dengan total produksi terbesar untuk rasio tersebut. Resource yang node-nya banyak mendapat bagian lebih besar, tapi semua resource tetap diproduksi.')}
        <label class="check small" style="margin-top:6px"><input type="checkbox" id="o-auto-food"> ${t('Sertakan makanan (Farm)')}</label></div>
      <div class="field cs-note small" id="o-gold-note" style="grid-column:1/-1">💰 ${t('Emas/jam tiap Townhouse = dasar (400 di L10) × (1 + pajak tiap Marketplace yang menempel, +20% di L10; Harbor di kota air +50%). Extension menyusun Townhouse, Marketplace dan Harbor (di tepi air) supaya total emas sebesar mungkin. Pada mode "Susun ulang", bangunan produksi, pengolahan, Cottage, Townhouse dan Marketplace dipakai ulang, jadi produksi resource kota ini akan turun.')}</div>
      <div class="field" id="o-ratio-wrap">${t('Rasio (bagian)')}
        <div class="row">${RES.map((r) => `<label class="small">${RES_I[r]} <input type="number" min="0" max="100" data-ratio="${r}" style="width:60px"></label>`).join('')}</div>
      </div>
      <div class="field" style="grid-column:1/-1">${t('Petak yang boleh dipakai')}
        <label class="check small"><input type="radio" name="o-mode" value="econ"> ${t('Susun ulang bangunan ekonomi (produksi, pengolahan, Cottage). Bangunan lain (militer, Warehouse, Townhouse, dll.) tetap.')}</label>
        <label class="check small"><input type="radio" name="o-mode" value="fill"> ${t('Isi petak kosong saja. Semua bangunan yang sudah ada tetap.')}</label>
        <label class="check small"><input type="radio" name="o-mode" value="all"> ${t('Kosongkan semua bangunan lalu susun dari nol (hanya node alam yang tetap).')}</label>
      </div>
      <label class="field">${t('Jumlah bangunan ekonomi')}
        <input type="number" id="o-budget" min="0" max="300">
        <span class="small muted" id="o-budget-hint"></span>
      </label>
      <label class="field">${t('Level yang diasumsikan')}
        <input type="number" id="o-level" min="1" max="10">
        <span class="small muted">${t('Untuk rencana jangka panjang, pakai 10.')}</span>
      </label>
      <label class="field">${t('Ketelitian')}
        <select id="o-quality"><option value="fast">${t('Cepat (±0,5 dtk)')}</option><option value="normal">${t('Normal (±1 dtk)')}</option><option value="best">${t('Teliti (±3 dtk)')}</option></select>
      </label>
      <label class="check small" style="align-self:end" id="o-cottage-wrap"><input type="checkbox" id="o-cottage"> ${t('Gunakan Cottage')}</label>
      <div class="field rmbox" style="grid-column:1/-1">
        <label class="check small"><input type="checkbox" id="o-rm"> <span><b>🪓 ${t('Izinkan hapus node alam')}</b> — ${t('node boleh dibersihkan &amp; diganti bangunan bila menambah produksi secara signifikan')}</span></label>
        <div id="o-rm-opts" class="row" style="padding-left:24px">
          ${NODE_OPTS.map(([c, n]) => `<label class="check small"><input type="checkbox" data-rmtype="${c}"> ${ico(c)} ${n}</label>`).join('')}
          <label class="small muted">${t('hapus hanya jika tiap node menambah ≥')} <input type="number" id="o-rm-min" min="0" step="50" style="width:80px"> ${t('/jam')}</label>
        </div>
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn primary" id="o-run">${t('Hitung rekomendasi')}</button>
      <div class="bar grow hide" id="o-prog"><i style="width:0%;background:var(--gold)"></i></div>
    </div>
    <div id="o-result"></div>`;
  document.body.appendChild(dlg);

  dlg.querySelector('#o-close').onclick = () => !running && dlg.close();
  dlg.addEventListener('cancel', (e) => { if (running) e.preventDefault(); });
  dlg.querySelector('#o-goal').onchange = (e) => { const was = state.goal === 'gold'; state.goal = e.target.value; syncForm(was !== (state.goal === 'gold')); };
  dlg.querySelectorAll('input[name="o-mode"]').forEach((r) => (r.onchange = (e) => { state.mode = e.target.value; syncForm(true); }));
  dlg.querySelectorAll('[data-ratio]').forEach((i) => (i.oninput = (e) => { state.ratio[e.target.dataset.ratio] = Math.max(0, +e.target.value || 0); }));
  dlg.querySelector('#o-level').oninput = (e) => { state.level = Math.max(1, Math.min(10, +e.target.value || 10)); };
  dlg.querySelector('#o-cottage').onchange = (e) => { state.cottage = e.target.checked; };
  dlg.querySelector('#o-auto-food').onchange = (e) => { state.autoFood = e.target.checked; };
  dlg.querySelector('#o-rm').onchange = (e) => { state.rmNodes = e.target.checked; syncForm(); };
  dlg.querySelectorAll('[data-rmtype]').forEach((i) => (i.onchange = () => {
    state.rmTypes = [...dlg.querySelectorAll('[data-rmtype]:checked')].map((x) => x.dataset.rmtype);
  }));
  dlg.querySelector('#o-rm-min').oninput = (e) => { state.rmMin = Math.max(0, +e.target.value || 0); };
  dlg.querySelector('#o-quality').onchange = (e) => { state.quality = e.target.value; };
  dlg.querySelector('#o-run').onclick = () => run(false);
  dlg.addEventListener('click', (e) => {
    if (e.target.id === 'o-save' && last) { onSave(last.plan, last.label); dlg.close(); }
    if (e.target.id === 'o-again') run(true);
  });
}

function syncForm(resetBudget) {
  dlg.querySelector('#o-goal').value = state.goal;
  dlg.querySelector('#o-ratio-wrap').classList.toggle('hide', state.goal !== 'custom');
  dlg.querySelector('#o-gold-note').classList.toggle('hide', state.goal !== 'gold');
  dlg.querySelector('#o-auto-note').classList.toggle('hide', state.goal !== 'auto');
  dlg.querySelector('#o-auto-food').checked = state.autoFood;
  dlg.querySelector('#o-cottage-wrap').classList.toggle('hide', state.goal === 'gold');
  dlg.querySelectorAll('[data-ratio]').forEach((i) => (i.value = state.ratio[i.dataset.ratio]));
  dlg.querySelectorAll('input[name="o-mode"]').forEach((r) => (r.checked = r.value === state.mode));
  dlg.querySelector('#o-level').value = state.level;
  dlg.querySelector('#o-cottage').checked = state.cottage;
  dlg.querySelector('#o-quality').value = state.quality;
  dlg.querySelector('#o-rm').checked = state.rmNodes;
  dlg.querySelector('#o-rm-opts').classList.toggle('hide', !state.rmNodes);
  dlg.querySelectorAll('[data-rmtype]').forEach((i) => (i.checked = state.rmTypes.includes(i.dataset.rmtype)));
  dlg.querySelector('#o-rm-min').value = state.rmMin;
  const c = counts(plan);
  if (resetBudget) dlg.querySelector('#o-budget').value = defaultBudget();
  dlg.querySelector('#o-budget-hint').textContent = state.mode === 'fill'
    ? t('Batas kota {l} − {a} bangunan yang ada = {s} slot.', { l: limit, a: c.all, s: Math.max(0, limit - c.all) }) + (limit - c.all <= 0 ? ' ' + t('Kota sudah penuh — pilih "Susun ulang bangunan ekonomi".') : '')
    : t('Batas kota {l} − {a} bangunan non-ekonomi = {s}.', { l: limit, a: c.other, s: Math.max(0, limit - c.other) }) + (state.mode === 'all' ? ' ' + t('Sisakan slot untuk militer dll.') : '');
}

async function run(variation) {
  if (running) return;
  const g = GOALS[state.goal];
  let goal = g.goal || { type: 'ratio', ratio: { ...state.ratio } };
  if (goal.type === 'ratio' && !RES.some((r) => goal.ratio[r] > 0)) return alert(t('Isi rasio minimal satu resource.'));
  if (variation) state.seed++;
  const [iterations, restarts] = QUALITY[state.quality];
  const budget = Math.max(0, +dlg.querySelector('#o-budget').value || 0);
  running = true;
  const prog = dlg.querySelector('#o-prog');
  prog.classList.remove('hide');
  dlg.querySelector('#o-run').disabled = true;
  dlg.querySelector('#o-result').innerHTML = `<div class="small muted" style="margin-top:10px">${t('Menghitung…')}</div>`;
  try {
    if (goal.type === 'gold') return await runGold(budget, iterations, restarts, prog);
    let p0 = 0, auto = null;
    const bar = (from, span) => (f) => (prog.firstElementChild.style.width = ((p0 + (from + f * span) * (1 - p0)) * 100).toFixed(0) + '%');
    if (goal.type === 'auto') {
      // 1) potential of every resource: the most this city makes when it only builds for that resource
      const keys = RES.filter((x) => x !== 'food' || state.autoFood);
      const pot = {};
      for (const [k, x] of keys.entries()) {
        const o = await optimize(plan, { goal: { type: 'weights', weights: { [x]: 1 } }, mode: state.mode, budget, level: state.level, cottage: state.cottage, iterations: Math.round(iterations / 3), restarts: 1, seed: state.seed + 17 * (k + 1) },
          (f) => (prog.firstElementChild.style.width = (((k + f) / keys.length) * 30).toFixed(0) + '%'));
        pot[x] = cityStats({ ...plan, cells: o.cells, levels: o.levels }).prod[x];
      }
      if (!keys.some((x) => pot[x] > 0)) { dlg.querySelector('#o-result').innerHTML = `<div class="banner" style="margin-top:10px">${t('Tidak ada petak yang bisa dipakai untuk bangunan produksi.')}</div>`; return; }
      // 2) the largest total production with the potentials as ratio
      const sumPot = keys.reduce((a, x) => a + pot[x], 0);
      const ratio = {};
      for (const x of keys) ratio[x] = pot[x] / sumPot;
      auto = { pot, ratio, keys };
      goal = { type: 'ratio', ratio };
      p0 = 0.3;
    }
    const base = { goal, mode: state.mode, budget, level: state.level, cottage: state.cottage, iterations, restarts, seed: state.seed };
    const useRm = state.rmNodes && state.rmTypes.length;
    // always compute the plan WITHOUT removing nodes; with removal enabled, compute a second plan and keep it only if it wins
    const r0 = await optimize(plan, base, bar(0, useRm ? 0.5 : 1));
    let r = r0, cmp = null;
    if (useRm) {
      const r1 = await optimize(plan, { ...base, seed: state.seed + 1000, removeNodes: { enabled: true, types: state.rmTypes, minGain: state.rmMin } }, bar(0.5, 0.5));
      const t0 = cityStats({ ...plan, cells: r0.cells, levels: r0.levels }), t1 = cityStats({ ...plan, cells: r1.cells, levels: r1.levels });
      const nRm = Object.values(r1.removedNodes || {}).reduce((a, b) => a + b, 0);
      const win = nRm > 0 && r1.score > r0.score;
      cmp = { win, nRm, removed: r1.removedNodes, sum0: RES.reduce((a, x) => a + t0.prod[x], 0), sum1: RES.reduce((a, x) => a + t1.prod[x], 0) };
      if (win) r = r1;
    }
    const next = { ...plan, cells: r.cells, levels: r.levels };
    const pctTxt = auto ? auto.keys.map((x) => Math.round(auto.ratio[x] * 100)).join(':') : '';
    last = { plan: next, label: auto ? `${t('Otomatis dari node alam')} ${pctTxt}` : g.goal ? t(g.label).replace(/^\S+\s/, '') : `${t('Rasio')} ${RES.map((x) => state.ratio[x]).join(':')}` };
    showResult(next, r, cmp, auto);
  } finally {
    running = false;
    prog.classList.add('hide');
    dlg.querySelector('#o-run').disabled = false;
  }
}

function showResult(next, r, cmp, auto = null) {
  // compare at the same building level so the gain shows the layout, not the upgrades
  const set = econSet();
  const same = { ...plan, levels: plan.levels.map((v, i) => (isBuilding(plan.cells[i]) && set.includes(plan.cells[i]) ? state.level : v)) };
  const a = cityStats(same), b = cityStats(next);
  const row = (label, x, y) => {
    const d = y - x;
    const pct = x > 0 ? ` (${d >= 0 ? '+' : ''}${Math.round((d / x) * 100)}%)` : '';
    return `<tr><td>${label}</td><td class="r num">${fmtNum(x)}</td><td class="r num"><b>${fmtNum(y)}</b></td>
      <td class="r num" style="color:${d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'inherit'}">${d >= 0 ? '+' : ''}${fmtNum(d)}${pct}</td></tr>`;
  };
  const sumA = RES.reduce((s, x) => s + a.prod[x], 0), sumB = RES.reduce((s, x) => s + b.prod[x], 0);
  const gold = state.goal === 'gold';
  const cnt = Object.entries(b.count).filter(([c]) => set.includes(c) || (gold && c === 'R')).sort((x, y) => y[1] - x[1])
    .map(([c, n]) => `<span class="pill">${ico(c)} ${n}× ${esc(B[c].n)}</span>`).join(' ');
  let changed = 0;
  for (let i = 0; i < next.cells.length; i++) if ((plan.cells[i] || '-') !== next.cells[i]) changed++;
  dlg.querySelector('#o-result').innerHTML = `
    <div class="o-res-grid"><div>
    <table class="kvt otable" style="margin-top:12px">
      <thead><tr><th></th><th class="r">${t('Sekarang')} (lvl ${state.level})</th><th class="r">${t('Rekomendasi')}</th><th class="r">${t('Selisih')}</th></tr></thead>
      <tbody>${gold ? row(`<b>💰 ${t('Emas')} ${t('/jam')}</b>`, a.gold, b.gold) : ''}
      ${RES.map((x) => row(`${RES_I[x]} ${RES_N[x]} ${t('/jam')}`, a.prod[x], b.prod[x])).join('')}
      ${row('Σ ' + t('Total') + ' ' + t('/jam'), sumA, sumB)}
      ${gold ? row(`🛒 ${t('Gerobak')}`, tradeCap(same).carts, tradeCap(next).carts) : ''}
      <tr><td>🏠 ${t('Bangunan')}</td><td class="r num">${a.buildings}</td><td class="r num"><b>${b.buildings}</b></td><td class="r small muted">${t('batas')} ${limit}</td></tr></tbody>
    </table>
    <div class="row" style="margin-top:8px">${cnt}</div>
    </div><div>${miniMap(next, plan)}<div class="small muted" style="margin-top:4px">${t('Petak bergaris = berubah dari {b} ({n} petak).', { b: esc(plan.name || t('Rencana')), n: fmtNum(changed) })}</div></div></div>
    ${cmp ? rmNote(cmp) : ''}
    ${gold ? goldNote(b, r) : ''}
    ${auto ? autoNote(b, auto) : ''}
    ${a.prod.food > 0 && b.prod.food < a.prod.food * 0.5 ? `<div class="banner" style="margin:8px 0">🌾 ${t('Produksi makanan turun ke {x}/jam. Kalau kota ini punya pasukan, pilih "Seimbang semua" atau rasio kustom dengan bagian makanan.', { x: fmtNum(b.prod.food) })}</div>` : ''}
    <p class="small muted" style="margin:8px 0">${t('Kedua kolom dihitung dengan bangunan ekonomi di level {l}, jadi selisihnya murni dari penempatan. Angka dasar, belum termasuk bonus riset.', { l: state.level })}</p>
    <div class="row">
      <button class="btn primary" id="o-save">💾 ${t('Simpan sebagai rencana baru')}</button>
      <button class="btn" id="o-again" title="${t('Jalankan lagi dengan variasi acak lain')}">🎲 ${t('Coba variasi lain')}</button>
    </div>`;
}

function rmNote(c) {
  const list = Object.entries(c.removed || {}).map(([k, n]) => `${n}× ${ico(k)} ${esc(B[k].n)}`).join(', ');
  if (!c.win) {
    return `<div class="banner" style="margin:8px 0;border-color:var(--line)">🪓 ${t('Menghapus node tidak memberi tambahan yang cukup (≥ {x}/jam per node) untuk tujuan ini, jadi rekomendasi tetap <b>tanpa</b> menghapus node.', { x: fmtNum(state.rmMin) })}</div>`;
  }
  const gain = c.sum1 - c.sum0;
  return `<div class="banner" style="margin:8px 0;border-color:var(--good)">🪓 <b>${t('{n} node dihapus', { n: c.nRm })}</b>: ${list}.<br>
    ${t('Total produksi tanpa hapus node {a}/jam → dengan hapus node {b}/jam ({g}, ≈ {p} per node).', { a: fmtNum(c.sum0), b: `<b>${fmtNum(c.sum1)}</b>`, g: (gain >= 0 ? '+' : '') + fmtNum(gain), p: fmtNum(gain / c.nRm) })}
    ${t('Node yang dihapus tampil merah di perbandingan. Di game, tandai dengan alat <b>Clear</b> di City planner.')}</div>`;
}

// ---- 💰 gold goal: Townhouses + Marketplaces (+ Harbors) via the template engine, off the page thread ----
function goldWorker(base, opts, onProgress) {
  return new Promise((resolve) => {
    const inline = () => setTimeout(() => resolve(goldPlan(base, opts)), 20);
    let w;
    try { w = new Worker(new URL('../lib/template-worker.js', import.meta.url), { type: 'module' }); } catch { return inline(); }
    w.onmessage = (e) => {
      if (e.data.progress != null) onProgress(e.data.progress);
      else { w.terminate(); if (e.data.done) resolve(e.data.done); else inline(); }
    };
    w.onerror = () => { w.terminate(); inline(); };
    w.postMessage({ kind: 'gold', base: structuredClone(plan), opts });
  });
}

async function runGold(budget, iterations, restarts, prog) {
  const useRm = state.rmNodes && state.rmTypes.length;
  const bar = (from, span) => (f) => (prog.firstElementChild.style.width = ((from + f * span) * 100).toFixed(0) + '%');
  const base = { mode: state.mode, budget, level: state.level, iters: iterations, restarts, seed: 13 + state.seed };
  // like the resource goals: a plan without clearing nodes, and one with clearing that must win by ≥ rmMin gold/h per node
  const r0 = await goldWorker(plan, base, bar(0, useRm ? 0.5 : 1));
  let r = r0, cmp = null;
  if (useRm) {
    const r1 = await goldWorker(plan, { ...base, seed: base.seed + 1000, clearTypes: state.rmTypes, minGain: state.rmMin }, bar(0.5, 0.5));
    const g0 = cityStats(r0.plan).gold, g1 = cityStats(r1.plan).gold;
    const nRm = Object.values(r1.removedNodes || {}).reduce((a, b) => a + b, 0);
    const win = nRm > 0 && g1 - g0 >= state.rmMin * nRm;
    cmp = { win, nRm, removed: r1.removedNodes, sum0: g0, sum1: g1 };
    if (win) r = r1;
  }
  last = { plan: r.plan, label: t(GOALS.gold.label).replace(/^\S+\s/, '') };
  showResult(r.plan, r, cmp);
}

function goldNote(b, r) {
  const s = r.stats || {};
  const avg = s.townhouses ? b.gold / s.townhouses : 0;
  return `<p class="small muted" style="margin:8px 0">${t('{u} Townhouse, rata-rata {g} emas/jam per Townhouse ({p}% di atas dasar). {m} Marketplace memberi {c} gerobak.', { u: s.townhouses || 0, g: fmtNum(Math.round(avg)), p: Math.round((avg / 400 - 1) * 100), m: s.markets || 0, c: fmtNum(s.carts || 0) })}${s.harbors ? ' ' + t('{h} Harbor di tepi air ikut menambah pajak.', { h: s.harbors }) : ''}</p>`;
}

// 🌿 auto ratio: show the potential of every resource, the ratio taken from it, and how much of each potential the plan reaches
function autoNote(b, a) {
  const rows = a.keys.map((x) => `<tr><td>${RES_I[x]} ${RES_N[x]}</td><td class="r num">${fmtNum(a.pot[x])}</td><td class="r num">${Math.round(a.ratio[x] * 100)}%</td>
    <td class="r num"><b>${fmtNum(b.prod[x])}</b></td><td class="r num">${a.pot[x] ? Math.round((b.prod[x] / a.pot[x]) * 100) : 0}%</td></tr>`).join('');
  return `<div class="card" style="margin:10px 0;padding:10px 12px">
    <div class="small"><b>🌿 ${t('Rasio otomatis dari node alam')}</b></div>
    <table class="kvt otable" style="margin-top:6px">
      <thead><tr><th></th><th class="r">${t('Potensi maks')} ${t('/jam')}</th><th class="r">${t('Rasio')}</th><th class="r">${t('Rekomendasi')}</th><th class="r">${t('dari potensi')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="small muted" style="margin:6px 0 0">${t('Potensi maks = produksi bila semua petak dipakai hanya untuk resource itu. Rasionya mengikuti potensi tersebut, jadi tiap resource mendapat bagian yang sama dari potensinya, dengan total produksi sebesar mungkin.')}</p>
  </div>`;
}
