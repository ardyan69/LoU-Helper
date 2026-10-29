// Layout Planner → 📋 Build steps: what to demolish, build and upgrade (in order) to turn the
// current city (or any compared plan) into the selected plan, with cost & time from the game data.
// The order itself comes from lib/buildorder.js (smart greedy simulation).
import { esc, RES_ICON, fmtNum } from '../lib/shared.js';
import { planSteps } from '../lib/buildorder.js';
import { t, locale } from '../lib/i18n.js';
import { N, B } from '../lib/city.js';
import { citySpeed, fmtT } from './cs-buildings.js';

const RK = ['wood', 'stone', 'iron', 'food', 'gold'];
const num = (n) => Math.round(n).toLocaleString(locale());
const xy = (i) => `${i % N}:${Math.floor(i / N)}`;
let dlg = null;

const mark = (s) => s; // text translated later with t(); marked for tests/i18n-check.mjs
const WHY = { speed: ['🏡', mark('Cottage dulu: mempercepat semua langkah berikutnya')], th: ['🏯', mark('Town Hall dinaikkan karena dibutuhkan bangunan berikutnya (syarat level / slot bangunan)')], slot: ['🧹', mark('Dibongkar sekarang untuk membebaskan slot bangunan')], final: ['🏯', mark('Level Town Hall sesuai rencana')] };
function gainTxt(g) {
  if (!g) return '';
  const out = [];
  if (g.prod > 0) out.push(`+${num(g.prod)}${t('/j')}`);
  if (g.gold > 0) out.push(`🪙+${num(g.gold)}`);
  if (g.speed > 0) out.push(`🏡+${num(g.speed)}%`);
  if (g.rec > 0) out.push(`⚔️+${num(g.rec)}%`);
  if (g.ts > 0) out.push(`⛺+${num(g.ts)}`);
  if (g.store > 0) out.push(`📦+${fmtNum(g.store)}`);
  if (g.carts > 0) out.push(`🛒+${num(g.carts)}`);
  return out.join(' ');
}

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
  const research = citySpeed(state, null);
  const { steps, total } = planSteps(plan, base, { researchPct: research });
  const tot = total.cost;
  const used = RK.filter((r) => tot[r] > 0);
  const label = { demolish: '🧹 ' + t('Bongkar'), build: '🔨 ' + t('Bangun'), upgrade: '⬆️ ' + t('Upgrade') };
  const name = (c) => (c === 'T' ? 'Town Hall' : B[c]?.n || c);
  const rows = steps.map((s, k) => {
    const why = WHY[s.why];
    const tag = why ? ` <span class="pill info" title="${esc(t(why[1]))}">${why[0]}</span>` : '';
    return `<tr class="${s.kind}"><td class="num muted">${k + 1}</td><td>${label[s.kind]}</td><td><b>${esc(name(s.code))}</b>${tag}</td><td class="small muted">${xy(s.i)}</td>
      <td class="num">${s.kind === 'demolish' ? '' : s.kind === 'build' ? `→ L${s.to}` : `L${s.from} → L${s.to}`}</td>
      ${used.map((r) => `<td class="num">${s.cost?.[r] ? num(s.cost[r]) : ''}</td>`).join('')}
      <td class="num">${s.time ? fmtT(s.time) : ''}</td><td class="num small muted">${s.time ? fmtT(s.at) : ''}</td>
      <td class="num small" title="${esc(t('Kecepatan bangun saat langkah ini'))}">${s.base ? `${num(s.speed)}%` : ''}</td>
      <td class="small good-t">${gainTxt(s.gain)}</td></tr>`;
  }).join('');
  const saved = total.naive - total.time;
  dlg._text = steps.map((s, k) => `${k + 1}. ${label[s.kind].replace(/^\S+ /, '')} ${name(s.code)} (${xy(s.i)})${s.kind === 'upgrade' ? ` L${s.from}→L${s.to}` : s.kind === 'build' ? ` →L${s.to}` : ''}${s.time ? ` · ${fmtT(s.time)}` : ''}`).join('\n');
  dlg.innerHTML = `
    <div class="row"><h3 class="grow">📋 ${t('Langkah pembangunan')}</h3><button class="btn sm" data-act="copy">📋 ${t('Salin daftar')}</button><button class="btn sm" data-act="close">✕</button></div>
    <p class="small muted">${t('Dari {a} ke rencana {b}. Urutan pintar: Cottage dulu selama waktu yang dihemat lebih besar dari waktu bangunnya, Town Hall dinaikkan hanya saat dibutuhkan, lalu langkah dengan tambahan terbesar per jam bangun. Bangunan lama dibongkar tepat sebelum petaknya dipakai, jadi tetap berproduksi sampai saat itu. Waktu tiap langkah memakai kecepatan bangun saat itu (Cottage yang sudah jadi + riset Construction {r}%).', { a: `<b>${esc(base.name)}</b>`, b: `<b>${esc(plan.name)}</b>`, r: research })}</p>
    <div class="cs-res">
      <div><span class="muted">${t('Langkah')}</span><b>${steps.length}</b><span class="small muted">${['demolish', 'build', 'upgrade'].map((k) => `${label[k]} ${steps.filter((s) => s.kind === k).length}`).join(' · ')}</span></div>
      <div><span class="muted">${t('Total biaya')}</span><b>${used.map((r) => `${RES_ICON[r]} ${num(tot[r])}`).join(' ') || '—'}</b></div>
      <div><span class="muted">${t('Total waktu bangun')}</span><b>${fmtT(total.time)}</b><span class="small muted">${t('berurutan, 1 antrian')}${saved > 60 ? ` · <span class="good-t">${t('hemat {t} dibanding urutan biasa', { t: fmtT(saved) })}</span>` : ''}</span></div>
      <div><span class="muted">${t('Kecepatan bangun')}</span><b>${num(total.startSpeed)}% → ${num(total.endSpeed)}%</b></div>
    </div>
    ${steps.length ? `<div class="tbl-wrap" style="max-height:55vh;margin-top:10px"><table class="cs-tbl steps"><thead><tr><th>#</th><th>${t('Aksi')}</th><th>${t('Bangunan')}</th><th>${t('Petak')}</th><th class="num">${t('Level')}</th>${used.map((r) => `<th class="num">${RES_ICON[r]}</th>`).join('')}<th class="num">${t('Waktu')}</th><th class="num">${t('Kumulatif')}</th><th class="num">🏡</th><th>${t('Tambahan')}</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="muted">${t('Rencana sudah sama dengan kota ini — tidak ada yang perlu dibangun.')}</p>`}`;
  dlg.showModal();
}
