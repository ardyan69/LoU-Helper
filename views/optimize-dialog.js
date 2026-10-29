// "🧠 Rekomendasi" dialog for the layout planner.
import { esc, fmtNum } from '../lib/shared.js';
import { B, isBuilding, cityStats } from '../lib/city.js';
import { optimize, ECON } from '../lib/optimizer.js';
import { ico } from '../lib/icons.js';
import { t } from '../lib/i18n.js';

const RES = ['wood', 'stone', 'iron', 'food'];
const RES_N = new Proxy({ wood: 'Kayu', stone: 'Batu', iron: 'Besi', food: 'Makanan' }, { get: (o, k) => (o[k] ? t(o[k]) : o[k]) });
const RES_I = { wood: '🪵', stone: '🪨', iron: '⛏️', food: '🌾' };
const GOALS = {
  wood: { label: '🪵 Kayu maksimal', goal: { type: 'weights', weights: { wood: 1 } } },
  stone: { label: '🪨 Batu maksimal', goal: { type: 'weights', weights: { stone: 1 } } },
  iron: { label: '⛏️ Besi maksimal', goal: { type: 'weights', weights: { iron: 1 } } },
  food: { label: '🌾 Makanan maksimal', goal: { type: 'weights', weights: { food: 1 } } },
  r3: { label: '⚖️ Seimbang kayu : batu : besi (1:1:1)', goal: { type: 'ratio', ratio: { wood: 1, stone: 1, iron: 1 } } },
  r4: { label: '⚖️ Seimbang semua resource (1:1:1:1)', goal: { type: 'ratio', ratio: { wood: 1, stone: 1, iron: 1, food: 1 } } },
  custom: { label: '✏️ Rasio kustom…', goal: null }
};
const QUALITY = { fast: [100000, 1], normal: [200000, 2], best: [600000, 3] };

let dlg, state = { goal: 'r3', mode: 'econ', level: 10, cottage: true, quality: 'normal', ratio: { wood: 40, stone: 30, iron: 20, food: 10 }, seed: 1,
  rmNodes: false, rmTypes: ['.', ':', ','], rmMin: 250 };
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
  for (const c of p.cells) if (isBuilding(c)) { all++; if (ECON.includes(c)) econ++; }
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
      <label class="check small" style="align-self:end"><input type="checkbox" id="o-cottage"> ${t('Gunakan Cottage')}</label>
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
  dlg.querySelector('#o-goal').onchange = (e) => { state.goal = e.target.value; syncForm(); };
  dlg.querySelectorAll('input[name="o-mode"]').forEach((r) => (r.onchange = (e) => { state.mode = e.target.value; syncForm(true); }));
  dlg.querySelectorAll('[data-ratio]').forEach((i) => (i.oninput = (e) => { state.ratio[e.target.dataset.ratio] = Math.max(0, +e.target.value || 0); }));
  dlg.querySelector('#o-level').oninput = (e) => { state.level = Math.max(1, Math.min(10, +e.target.value || 10)); };
  dlg.querySelector('#o-cottage').onchange = (e) => { state.cottage = e.target.checked; };
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
  const goal = g.goal || { type: 'ratio', ratio: { ...state.ratio } };
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
    const base = { goal, mode: state.mode, budget, level: state.level, cottage: state.cottage, iterations, restarts, seed: state.seed };
    const useRm = state.rmNodes && state.rmTypes.length;
    const bar = (from, span) => (f) => (prog.firstElementChild.style.width = ((from + f * span) * 100).toFixed(0) + '%');
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
    last = { plan: next, label: g.goal ? t(g.label).replace(/^\S+\s/, '') : `${t('Rasio')} ${RES.map((x) => state.ratio[x]).join(':')}` };
    showResult(next, r, cmp);
  } finally {
    running = false;
    prog.classList.add('hide');
    dlg.querySelector('#o-run').disabled = false;
  }
}

function showResult(next, r, cmp) {
  // compare at the same building level so the gain shows the layout, not the upgrades
  const same = { ...plan, levels: plan.levels.map((v, i) => (isBuilding(plan.cells[i]) && ECON.includes(plan.cells[i]) ? state.level : v)) };
  const a = cityStats(same), b = cityStats(next);
  const row = (label, x, y) => {
    const d = y - x;
    const pct = x > 0 ? ` (${d >= 0 ? '+' : ''}${Math.round((d / x) * 100)}%)` : '';
    return `<tr><td>${label}</td><td class="r num">${fmtNum(x)}</td><td class="r num"><b>${fmtNum(y)}</b></td>
      <td class="r num" style="color:${d > 0 ? 'var(--good)' : d < 0 ? 'var(--bad)' : 'inherit'}">${d >= 0 ? '+' : ''}${fmtNum(d)}${pct}</td></tr>`;
  };
  const sumA = RES.reduce((s, x) => s + a.prod[x], 0), sumB = RES.reduce((s, x) => s + b.prod[x], 0);
  const cnt = Object.entries(b.count).filter(([c]) => ECON.includes(c)).sort((x, y) => y[1] - x[1])
    .map(([c, n]) => `<span class="pill">${ico(c)} ${n}× ${esc(B[c].n)}</span>`).join(' ');
  dlg.querySelector('#o-result').innerHTML = `
    <table class="kvt otable" style="margin-top:12px">
      <thead><tr><th></th><th class="r">${t('Sekarang')} (lvl ${state.level})</th><th class="r">${t('Rekomendasi')}</th><th class="r">${t('Selisih')}</th></tr></thead>
      <tbody>${RES.map((x) => row(`${RES_I[x]} ${RES_N[x]} ${t('/jam')}`, a.prod[x], b.prod[x])).join('')}
      ${row('Σ ' + t('Total') + ' ' + t('/jam'), sumA, sumB)}
      <tr><td>🏠 ${t('Bangunan')}</td><td class="r num">${a.buildings}</td><td class="r num"><b>${b.buildings}</b></td><td class="r small muted">${t('batas')} ${limit}</td></tr></tbody>
    </table>
    <div class="row" style="margin-top:8px">${cnt}</div>
    ${cmp ? rmNote(cmp) : ''}
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
