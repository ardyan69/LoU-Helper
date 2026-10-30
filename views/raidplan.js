// 🎯 Raid Planner — part of the Dungeon tab.
// Picks the nearest suitable dungeons for the troops of one city, using the Revival game formulas
// (dungeon strength & max loot by level/explored %, unit efficiency, losses, travel time).
import { esc, fmtNum, fmtDur, dist } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { unitById, DUNGEON_UNITS, dungeonNeed, raid, unitEff } from '../lib/cheatsheet.js';

const KIND_ICO = { mountain: '🏔️', forest: '🌲', hill: '⛰️', sea: '🌊' };
const p = { city: '', maxD: 15, kinds: 'all', away: true, partial: true, maxExp: 100 };
try { Object.assign(p, JSON.parse(localStorage.getItem('lou-raidplan') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-raidplan', JSON.stringify(p)); } catch {} };

let root, ctx;
const num = (n) => (n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString(locale()));

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="card cs-note small">${t('Raid Planner memilih dungeon terdekat yang cocok untuk pasukan di satu kota, memakai rumus game Revival: kekuatan & max loot dungeon (sesuai level dan explored %), efisiensi unit, perkiraan kerugian, dan waktu tempuh (menit/field dari Pengaturan → Unit). Pasukan dibagi otomatis ke dungeon dengan loot per jam per pasukan terbaik.')}</div>
    <div class="toolbar card">
      <label class="field">${t('Kota')}<select id="rp-city"></select></label>
      <label class="field">${t('Jarak maks')}<input type="number" id="rp-maxD" min="1" value="${p.maxD}"></label>
      <label class="field">${t('Explored maks %')}<input type="number" id="rp-maxExp" min="0" max="100" value="${p.maxExp}"></label>
      <label class="field">${t('Tipe')}<select id="rp-kinds"><option value="all">${t('Semua')}</option>${Object.keys(KIND_ICO).map((k) => `<option value="${k}" ${p.kinds === k ? 'selected' : ''}>${KIND_ICO[k]} ${k[0].toUpperCase() + k.slice(1)}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" id="rp-away" ${p.away ? 'checked' : ''}> ${t('Hitung pasukan yang sedang raid')}</label>
      <label class="check"><input type="checkbox" id="rp-partial" ${p.partial ? 'checked' : ''}> ${t('Sisa pasukan boleh angkut sebagian loot')}</label>
    </div>
    <div id="rp-out"></div>`;
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { e.preventDefault(); navigator.clipboard.writeText(cp.dataset.copy); ctx.toast(t('Koordinat disalin: {c}', { c: cp.dataset.copy })); }
  });
}
function onInput(e) {
  const id = e.target.id?.replace('rp-', '');
  if (!id || !(id in p)) return;
  p[id] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? +e.target.value : e.target.value;
  persist();
  render();
}

// troops of a city: at home (+ optionally the ones out raiding from it)
function pool(city) {
  const mv = ctx.state.movements;
  const out = {};
  const add = (units) => { for (const [id, n] of Object.entries(units || {})) if (n > 0 && unitById(id)) out[id] = (out[id] || 0) + n; };
  const tr = (mv?.training || []).find((c) => c.x === city.x && c.y === city.y) || (mv?.training || []).find((c) => c.name === city.name);
  add(tr?.units);
  if (p.away) for (const a of mv?.armies || []) if (!a.trade && a.home?.name === city.name && /raid|return/i.test(a.order || '')) add(a.units);
  return out;
}
const mpfOf = (id) => {
  const s = ctx.state.settings.units.find((u) => u.id === id || (id === 'crossbowman' && u.id === 'xbow'));
  return s?.minPerField || unitById(id).spd;
};

export function render() {
  if (!root) return;
  const cities = Object.values(ctx.state.cities).filter((c) => c.x != null).sort((a, b) => String(a.name).localeCompare(String(b.name), 'id', { numeric: true }));
  const sel = root.querySelector('#rp-city');
  const withTroops = cities.find((c) => Object.keys(pool(c)).length);
  if (!cities.find((c) => c.key === p.city)) p.city = (withTroops || cities[0])?.key || '';
  sel.innerHTML = cities.map((c) => { const n = Object.values(pool(c)).reduce((a, b) => a + b, 0); return `<option value="${c.key}" ${c.key === p.city ? 'selected' : ''}>${esc(c.name)} (${c.key}) · ${num(n)} ${t('pasukan')}</option>`; }).join('');
  const out = root.querySelector('#rp-out');
  const city = ctx.state.cities[p.city];
  if (!city) { out.innerHTML = `<div class="card small muted">${t('Belum ada data kota. Buka game dulu.')}</div>`; return; }
  const have = pool(city);
  const overheadMin = ctx.state.settings.raidOverheadMin || 0;

  // candidate dungeons in range
  const dgs = Object.values(ctx.state.dungeons).filter((d) => d.kind !== 'boss' && d.x != null && d.level >= 1).map((d) => ({ d, kind: String(d.type || '').toLowerCase(), dd: dist(city, d), prog: Math.min(100, d.explored ?? 0) }))
    .filter((o) => KIND_ICO[o.kind] && o.dd <= p.maxD && o.prog <= p.maxExp && (p.kinds === 'all' || o.kind === p.kinds) && o.prog < 100);

  // best option per dungeon & unit type
  const options = [];
  for (const o of dgs) {
    const ids = o.kind === 'sea' ? DUNGEON_UNITS.sea : DUNGEON_UNITS.land;
    for (const id of ids) {
      const u = unitById(id);
      const need = dungeonNeed(o.kind, o.d.level, o.prog, u);
      if (!need) continue;
      const tripMin = 2 * o.dd * mpfOf(id) + overheadMin;
      const r = raid(o.kind, o.d.level, o.prog, u, need.n);
      const perH = r.carried / (tripMin / 60);
      options.push({ ...o, id, u, n: need.n, byAtk: need.byAtk, r, tripMin, perH, goldH: r.goldGot / (tripMin / 60), eff: perH / need.n, raids: Math.ceil((100 - o.prog) / 2.5) });
    }
  }

  // greedy assignment: most loot per hour per soldier first, one army per dungeon
  const left = { ...have }, plan = [], used = new Set();
  for (const o of [...options].sort((a, b) => b.eff - a.eff)) {
    if (used.has(o.d.key) || (left[o.id] || 0) < o.n) continue;
    left[o.id] -= o.n; used.add(o.d.key); plan.push({ ...o, full: true });
  }
  if (p.partial) {
    // leftovers: enough attack for the dungeon, carry what they can
    for (const o of [...options].filter((x) => !used.has(x.d.key)).sort((a, b) => b.eff - a.eff)) {
      const n = left[o.id] || 0;
      if (used.has(o.d.key) || n < o.byAtk || n <= 0) continue;
      const r = raid(o.kind, o.d.level, o.prog, o.u, n);
      if (r.carried <= 0) continue;
      left[o.id] = 0; used.add(o.d.key);
      plan.push({ ...o, n, r, perH: r.carried / (o.tripMin / 60), goldH: r.goldGot / (o.tripMin / 60), full: false });
    }
  }
  plan.sort((a, b) => a.dd - b.dd);

  const totH = plan.reduce((a, o) => a + o.perH, 0), goldH = plan.reduce((a, o) => a + o.goldH, 0);
  const sent = plan.reduce((a, o) => a + o.n, 0), all = Object.values(have).reduce((a, b) => a + b, 0);
  const idle = Object.entries(left).filter(([, n]) => n > 0);
  const unitsTxt = (o) => Object.entries(o).filter(([, n]) => n > 0).map(([id, n]) => `${num(n)}× ${esc(unitById(id).name)}`).join(', ') || '—';

  // best option per dungeon for the overview list
  // (prefer unit types the city actually has; otherwise the theoretically best one)
  const bestPer = {};
  const score = (o) => ((have[o.id] || 0) > 0 ? 1e9 : 0) + o.eff;
  for (const o of options) if (!bestPer[o.d.key] || score(o) > score(bestPer[o.d.key])) bestPer[o.d.key] = o;
  const overview = Object.values(bestPer).sort((a, b) => score(b) - score(a)).slice(0, 25);
  const dgCell = (o) => `<td><b>${KIND_ICO[o.kind]} ${esc(o.kind[0].toUpperCase() + o.kind.slice(1))} L${o.d.level}</b> <a href="#" class="small muted" data-copy="${o.d.key}">${o.d.key}</a> <span class="small muted">${o.prog}%</span></td>`;

  out.innerHTML = `
    <div class="summary">
      <div class="stat"><div class="k">${t('Pasukan tersedia')}</div><div class="v num">${num(all)}</div></div>
      <div class="stat"><div class="k">${t('Dikirim di rencana')}</div><div class="v num">${num(sent)}</div></div>
      <div class="stat"><div class="k">${t('Dungeon dalam jangkauan')}</div><div class="v num">${dgs.length}</div></div>
      <div class="stat"><div class="k">${t('Loot / jam (rencana)')}</div><div class="v num" style="color:var(--good)">${fmtNum(totH)}</div></div>
      <div class="stat"><div class="k">${t('Gold / jam (rencana)')}</div><div class="v num">${fmtNum(goldH)}</div></div>
    </div>
    <div class="card cs-card">
      <h3>🎯 ${t('Rencana raid untuk {c}', { c: esc(city.name) })}</h3>
      <p class="small muted">${t('Pasukan')}: ${unitsTxt(have)}${idle.length ? ` · ${t('tidak terpakai')}: ${unitsTxt(Object.fromEntries(idle))}` : ''}</p>
      ${plan.length ? `<div class="tbl-wrap"><table class="cs-tbl">
        <thead><tr><th>${t('Dungeon')}</th><th class="num">${t('Jarak')}</th><th>${t('Kirim')}</th><th class="num">${t('Loot / raid')}</th><th class="num">${t('Pulang-pergi')}</th><th class="num">${t('Loot / jam')}</th><th class="num">${t('Rugi')}</th><th class="num">${t('Raid s/d 100%')}</th></tr></thead>
        <tbody>${plan.map((o) => `<tr class="${o.full ? '' : 'part'}">${dgCell(o)}
          <td class="num">${o.dd.toFixed(1)}</td>
          <td><b>${num(o.n)}× ${esc(o.u.name)}</b>${o.full ? '' : ` <span class="pill warn" title="${esc(t('Pasukan kurang untuk angkut semua loot'))}">${t('sebagian')}</span>`}</td>
          <td class="num">${num(o.r.carried)} <span class="small muted">/ ${num(o.r.loot)} · +${num(o.r.goldGot)} 🪙</span></td>
          <td class="num">${fmtDur(o.tripMin * 60000)}</td>
          <td class="num"><b>${fmtNum(o.perH)}</b></td>
          <td class="num">${num(o.r.lost)} <span class="small muted">(${(o.r.lossFrac * 100).toFixed(1)}%)</span></td>
          <td class="num">${o.raids}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted">${all ? t('Tidak ada dungeon yang cocok dalam jangkauan. Perbesar jarak maks, atau buka peta Region di game agar dungeon tersimpan.') : t('Kota ini belum punya pasukan yang bisa raid (data dari tab Pergerakan).')}</p>`}
      <p class="small muted">${t('Jumlah dihitung untuk Explored % saat ini; tiap raid penuh menambah +2.5%, jadi butuh sedikit lebih banyak pasukan seiring waktu. Waktu tempuh memakai menit/field di Pengaturan → Unit (terkalibrasi otomatis dari pergerakan pasukan).')}${overheadMin ? ' ' + t('Termasuk {m} menit persiapan/bongkar per raid.', { m: overheadMin }) : ''}</p>
    </div>
    <div class="card cs-card">
      <h3>📋 ${t('Dungeon terbaik dalam jangkauan')}</h3>
      ${overview.length ? `<div class="tbl-wrap"><table class="cs-tbl">
        <thead><tr><th>${t('Dungeon')}</th><th class="num">${t('Jarak')}</th><th>${t('Unit terbaik')}</th><th class="num">${t('Butuh')}</th><th class="num">${t('Punya')}</th><th class="num">${t('Loot / raid')}</th><th class="num">${t('Loot / jam')}</th><th class="num">${t('Loot / jam / pasukan')}</th></tr></thead>
        <tbody>${overview.map((o) => `<tr>${dgCell(o)}<td class="num">${o.dd.toFixed(1)}</td><td>${esc(o.u.name)} <span class="small muted">${Math.round(unitEff(o.u, o.kind) * 100)}%</span></td>
          <td class="num">${num(o.n)}</td><td class="num ${(have[o.id] || 0) >= o.n ? 'ok' : ''}">${num(have[o.id] || 0)}</td>
          <td class="num">${num(o.r.carried)}</td><td class="num">${fmtNum(o.perH)}</td><td class="num">${o.eff.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`
        : `<p class="muted">${t('Tidak ada dungeon dalam jangkauan.')}</p>`}
    </div>`;
}
