// Layout Planner → 📋 Build steps: what to demolish, build and upgrade (in order) to turn the
// current city (or any compared plan) into the selected plan, with cost & time from the game data.
import { esc, RES_ICON } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { N, TOWNHALL, B, zone, isBuilding, isNode } from '../lib/city.js';
import { BY_CODE, levelCost } from '../lib/gamedata.js';
import { citySpeed, fmtT } from './cs-buildings.js';

const ORDER = ['C', 'S', '2', '3', '4', '1', 'L', 'A', 'D', 'M', 'U', 'P', 'H', 'R', 'B', 'K', 'G', 'E', 'J', 'Z', 'Y', 'V', 'X'];
const RK = ['wood', 'stone', 'iron', 'food', 'gold'];
const num = (n) => Math.round(n).toLocaleString(locale());
const xy = (i) => `${i % N}:${Math.floor(i / N)}`;
let dlg = null;

export function computeSteps(plan, base) {
  const steps = [];
  const lvl = (p, i) => (isBuilding(p.cells[i]) || i === TOWNHALL ? (p.levels?.[i] || (p.source === 'game' ? 1 : 10)) : 0);
  for (let i = 0; i < N * N; i++) {
    const z = zone(i, plan.water);
    if (i !== TOWNHALL && z !== 'interior' && z !== 'shore') continue;
    const a = i === TOWNHALL ? 'T' : plan.cells[i], b = i === TOWNHALL ? 'T' : (base.cells[i] || '-');
    const la = lvl(plan, i), lb = lvl(base, i);
    if (a === b) {
      if ((isBuilding(a) || a === 'T') && la > lb) steps.push({ kind: 'upgrade', code: a, i, from: lb, to: la });
      continue;
    }
    if (isBuilding(b) || isNode(b)) steps.push({ kind: 'demolish', code: b, i, from: lb, to: 0 });
    if (isBuilding(a)) steps.push({ kind: 'build', code: a, i, from: 0, to: la || 10 });
  }
  for (const s of steps) {
    const g = BY_CODE[s.code];
    if (s.kind !== 'demolish' && g) { const c = levelCost(g, s.from, s.to); s.cost = c.cost; s.time = c.time; s.th = g.th || 0; }
    else { s.cost = {}; s.time = 0; }
  }
  const rank = (c) => (c === 'T' ? -1 : ORDER.indexOf(c) < 0 ? 99 : ORDER.indexOf(c));
  const grp = (s) => (s.kind === 'demolish' ? 0 : s.code === 'T' ? 1 : s.kind === 'build' ? 2 : 3);
  steps.sort((x, y) => grp(x) - grp(y) || (grp(x) === 3 ? x.to - y.to : 0) || rank(x.code) - rank(y.code) || sumCost(x) - sumCost(y));
  return steps;
}
const sumCost = (s) => RK.reduce((a, r) => a + (s.cost[r] || 0), 0);

export function openBuildSteps(plan, base, state) {
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.className = 'optdlg stepsdlg';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      if (e.target.dataset.act === 'close') dlg.close();
      if (e.target.dataset.act === 'copy') { navigator.clipboard.writeText(dlg._text || ''); e.target.textContent = '✓ ' + t('Disalin'); }
    });
  }
  const steps = computeSteps(plan, base);
  const live = base.source === 'game' && base.live ? base : null;
  const speed = citySpeed(state, live);
  const f = 1 + speed / 100;
  const thNow = base.levels?.[TOWNHALL] || 0;
  const thPlan = Math.max(thNow, ...steps.filter((s) => s.code === 'T').map((s) => s.to));
  const tot = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
  let time = 0;
  for (const s of steps) { for (const r of RK) tot[r] += s.cost[r] || 0; time += s.time; }
  const used = RK.filter((r) => tot[r] > 0);
  const label = { demolish: '🧹 ' + t('Bongkar'), build: '🔨 ' + t('Bangun'), upgrade: '⬆️ ' + t('Upgrade') };
  const name = (c) => (c === 'T' ? 'Town Hall' : B[c]?.n || c);
  let run = 0;
  const rows = steps.map((s, k) => {
    run += s.time;
    const warn = s.th && s.th > thPlan ? ` <span class="pill warn" title="${esc(t('Butuh Town Hall level {l}', { l: s.th }))}">TH ${s.th}</span>` : '';
    return `<tr class="${s.kind}"><td class="num muted">${k + 1}</td><td>${label[s.kind]}</td><td><b>${esc(name(s.code))}</b>${warn}</td><td class="small muted">${xy(s.i)}</td>
      <td class="num">${s.kind === 'demolish' ? '' : s.kind === 'build' ? `→ L${s.to}` : `L${s.from} → L${s.to}`}</td>
      ${used.map((r) => `<td class="num">${s.cost[r] ? num(s.cost[r]) : ''}</td>`).join('')}<td class="num">${s.time ? fmtT(s.time / f) : ''}</td><td class="num small muted">${s.time ? fmtT(run / f) : ''}</td></tr>`;
  }).join('');
  dlg._text = steps.map((s, k) => `${k + 1}. ${label[s.kind].replace(/^\S+ /, '')} ${name(s.code)} (${xy(s.i)})${s.kind === 'upgrade' ? ` L${s.from}→L${s.to}` : s.kind === 'build' ? ` →L${s.to}` : ''}`).join('\n');
  dlg.innerHTML = `
    <div class="row"><h3 class="grow">📋 ${t('Langkah pembangunan')}</h3><button class="btn sm" data-act="copy">📋 ${t('Salin daftar')}</button><button class="btn sm" data-act="close">✕</button></div>
    <p class="small muted">${t('Dari {a} ke rencana {b}. Urutan: bongkar dulu, Town Hall, bangunan baru (Cottage & produksi dulu), lalu upgrade dari level terendah. Waktu memakai kecepatan bangun {s}% (Cottage + riset Construction).', { a: `<b>${esc(base.name)}</b>`, b: `<b>${esc(plan.name)}</b>`, s: speed })}</p>
    <div class="cs-res">
      <div><span class="muted">${t('Langkah')}</span><b>${steps.length}</b><span class="small muted">${['demolish', 'build', 'upgrade'].map((k) => `${label[k]} ${steps.filter((s) => s.kind === k).length}`).join(' · ')}</span></div>
      <div><span class="muted">${t('Total biaya')}</span><b>${used.map((r) => `${RES_ICON[r]} ${num(tot[r])}`).join(' ') || '—'}</b></div>
      <div><span class="muted">${t('Total waktu bangun')}</span><b>${fmtT(time / f)}</b><span class="small muted">${t('berurutan, 1 antrian')}</span></div>
    </div>
    ${steps.length ? `<div class="tbl-wrap" style="max-height:55vh;margin-top:10px"><table class="cs-tbl steps"><thead><tr><th>#</th><th>${t('Aksi')}</th><th>${t('Bangunan')}</th><th>${t('Petak')}</th><th class="num">${t('Level')}</th>${used.map((r) => `<th class="num">${RES_ICON[r]}</th>`).join('')}<th class="num">${t('Waktu')}</th><th class="num">${t('Kumulatif')}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="muted">${t('Rencana sudah sama dengan kota ini — tidak ada yang perlu dibangun.')}</p>`}`;
  dlg.showModal();
}
