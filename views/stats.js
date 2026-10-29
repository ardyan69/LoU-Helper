// "📈 Statistik" — raid loot per day/city, production, score & troops over time (hourly snapshots).
import { esc, fmtNum, RES, RES_ICON, RES_LABEL } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { lineChart, barChart, SERIES } from '../lib/chart.js';
import { dayKey } from '../lib/history.js';

let root, ctx, range = 14;
try { range = +localStorage.getItem('lou-stats-range') || 14; } catch {}
const RES5 = [...RES, 'gold'];
const RCOL = { wood: SERIES[0], stone: SERIES[1], iron: SERIES[2], food: SERIES[3], gold: SERIES[4] };

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow"><h2>📈 ${t('Statistik')}</h2><p>${t('Loot raid per hari, produksi, skor, dan pasukan dari waktu ke waktu. Data dicatat otomatis tiap jam selama extension aktif.')}</p></div>
      <div class="seg" id="st-range">${[7, 14, 30, 60].map((d) => `<button data-d="${d}">${t('{d} hari', { d })}</button>`).join('')}</div>
    </div>
    <div id="st-body"></div>`;
  let rt = null;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (root.classList.contains('on')) render(); }, 200); });
  root.querySelector('#st-range').addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    range = +b.dataset.d;
    try { localStorage.setItem('lou-stats-range', range); } catch {}
    render();
  });
}

let span = 0;
const dfmt = (ms, long) => new Date(ms).toLocaleString(locale(), long ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : span < 3 * 864e5 ? { day: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });

export function render() {
  if (!root) return;
  root.querySelectorAll('#st-range [data-d]').forEach((b) => b.classList.toggle('on', +b.dataset.d === range));
  const S = ctx.state, now = Date.now(), from = now - range * 864e5;
  const loot = S.lootLog || { days: {}, byCity: {} };
  const days = [];
  for (let i = range - 1; i >= 0; i--) days.push(dayKey(now - i * 864e5));
  const lootTot = days.reduce((a, d) => { const x = loot.days[d] || {}; for (const r of RES5) a[r] += x[r] || 0; a.raids += x.raids || 0; return a; }, { wood: 0, stone: 0, iron: 0, food: 0, gold: 0, raids: 0 });
  const cities = Object.values(S.cities).sort((a, b) => String(a.name).localeCompare(String(b.name), 'id', { numeric: true }));
  const hist = S.history || {};
  const hasHist = Object.values(hist).some((rows) => rows.length);

  root.querySelector('#st-body').innerHTML = `
    <div class="summary">
      <div class="stat"><div class="k">${t('Raid tercatat')}</div><div class="v num">${fmtNum(lootTot.raids)}</div></div>
      ${RES5.map((r) => `<div class="stat"><div class="k">${RES_ICON[r]} ${t('Loot {r}', { r: r === 'gold' ? t('Emas') : RES_LABEL[r] })}</div><div class="v num">${fmtNum(lootTot[r])}</div></div>`).join('')}
    </div>
    <div class="card cs-card"><h3>⚔️ ${t('Loot raid per hari')}</h3><div id="ch-loot"></div>
      <p class="small muted">${t('Dihitung dari muatan pasukan yang pulang dari raid (sekali per pasukan).')}</p></div>
    <div class="card cs-card"><h3>🏰 ${t('Loot per kota (semua waktu)')}</h3>
      ${Object.keys(loot.byCity || {}).length ? `<div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Kota')}</th><th class="num">${t('Raid')}</th>${RES5.map((r) => `<th class="num">${RES_ICON[r]}</th>`).join('')}<th class="num">${t('Total')}</th></tr></thead><tbody>
        ${Object.entries(loot.byCity).sort((a, b) => sum(b[1]) - sum(a[1])).map(([c, x]) => `<tr><td><b>${esc(c)}</b></td><td class="num">${fmtNum(x.raids)}</td>${RES5.map((r) => `<td class="num">${fmtNum(x[r] || 0)}</td>`).join('')}<td class="num"><b>${fmtNum(sum(x))}</b></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted small">${t('Belum ada raid yang tercatat. Loot terhitung saat pasukan pulang dari dungeon sementara game terbuka.')}</p>`}
    </div>
    ${hasHist ? `
    <div class="card cs-card"><h3>📦 ${t('Produksi total per jam (semua kota)')}</h3><div id="ch-prod"></div></div>
    <div class="card cs-card"><h3>⭐ ${t('Skor per kota')}</h3><div id="ch-score"></div></div>
    <div class="card cs-card"><h3>⚔️ ${t('Pasukan per kota')}</h3><div id="ch-troops"></div></div>`
    : `<div class="card cs-note small">${t('Grafik produksi, skor & pasukan muncul setelah beberapa jam: extension mencatat data kota sekali per jam.')}</div>`}`;

  barChart(root.querySelector('#ch-loot'), {
    bars: days.map((d) => { const x = loot.days[d] || {}; return { label: d.slice(8), full: d, parts: RES5.map((r) => ({ name: r === 'gold' ? t('Emas') : RES_LABEL[r], color: RCOL[r], v: x[r] || 0 })) }; }),
    yFmt: fmtNum
  });
  if (!hasHist) return;

  // total production per hour: sum of the cities' latest point in each hour bucket
  const buckets = new Map();
  for (const [key, rows] of Object.entries(hist)) for (const r of rows) {
    if (r[0] < from) continue;
    const h = Math.floor(r[0] / 3.6e6) * 3.6e6;
    const b = buckets.get(h) || {};
    b[key] = r;
    buckets.set(h, b);
  }
  const hours = [...buckets.keys()].sort((a, b) => a - b);
  span = hours.length ? hours[hours.length - 1] - hours[0] : 0;
  lineChart(root.querySelector('#ch-prod'), {
    series: RES5.map((r, i) => ({ name: r === 'gold' ? t('Emas') : RES_LABEL[r], color: RCOL[r], points: hours.map((h) => [h, Object.values(buckets.get(h)).reduce((s, row) => s + (row[3 + i] || 0), 0)]) })),
    yFmt: fmtNum, xFmt: (x, long) => dfmt(x, long)
  });
  const perCity = (col) => cities.map((c, i) => ({ name: c.name, color: SERIES[i % SERIES.length], points: (hist[c.key] || []).filter((r) => r[0] >= from && r[col] != null).map((r) => [r[0], r[col]]) })).filter((s) => s.points.length);
  lineChart(root.querySelector('#ch-score'), { series: perCity(1), yFmt: fmtNum, xFmt: (x, long) => dfmt(x, long) });
  lineChart(root.querySelector('#ch-troops'), { series: perCity(2), yFmt: fmtNum, xFmt: (x, long) => dfmt(x, long) });
}
const sum = (x) => RES5.reduce((s, r) => s + (x[r] || 0), 0);

export function onData(state, keys) {
  if (root?.classList.contains('on') && keys.some((k) => ['history', 'lootLog', 'cities'].includes(k))) render();
}
