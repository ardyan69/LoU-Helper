// "🗓️ Timeline" — a Gantt chart per city: incoming attacks, own troops (out & back), trade carts/ships
// (out, back, incoming deliveries), construction queue and recruitment queue on one time axis (lib/timeline.js).
import { esc, fmtNum, fmtDur, unitName } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { buildTimeline, buildingName, LANES } from '../lib/timeline.js';

let root, ctx, timer = null;
let span = 6, onlyBusy = true;
try { span = +localStorage.getItem('lou-tl-span') || 6; onlyBusy = localStorage.getItem('lou-tl-busy') !== '0'; } catch { /* storage blocked */ }
const PAST = 0.15; // part of the axis before "now"

const LANE = () => ({ incoming: ['⚠️', t('Serangan masuk')], army: ['⚔️', t('Pasukan')], trade: ['🛒', t('Dagang')], build: ['🔨', t('Bangun')], recruit: ['🎖️', t('Rekrut')] });

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head"><div class="grow"><h2>🗓️ ${t('Timeline')}</h2>
      <p>${t('Semua yang berjalan di tiap kota dalam satu sumbu waktu: serangan masuk, pasukan (pergi & pulang), gerobak/kapal dagang, antrian bangun dan rekrut. Arahkan mouse ke batang untuk detail.')}</p></div>
      <div class="seg" id="tl-span">${[3, 6, 12, 24, 48].map((h) => `<button data-h="${h}">${h} ${t('jam')}</button>`).join('')}</div>
      <label class="check small"><input type="checkbox" id="tl-busy"> ${t('Hanya kota yang ada kegiatan')}</label>
    </div>
    <div class="tl-legend small muted">
      <span><i class="tl-b enemy"></i>${t('Serangan masuk')}</span><span><i class="tl-b attack"></i>${t('Serang')}</span><span><i class="tl-b raid"></i>Raid</span>
      <span><i class="tl-b support"></i>${t('Bantuan')}</span><span><i class="tl-b back"></i>${t('Pulang')}</span><span><i class="tl-b out"></i>${t('Kirim dagang')}</span>
      <span><i class="tl-b in"></i>${t('Kiriman masuk')}</span><span><i class="tl-b build"></i>${t('Bangun')}</span><span><i class="tl-b recruit"></i>${t('Rekrut')}</span><span><i class="tl-b wait"></i>${t('Menunggu')}</span>
    </div>
    <div id="tl-body"></div>`;
  root.querySelector('#tl-span').addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    span = +b.dataset.h;
    try { localStorage.setItem('lou-tl-span', span); } catch { /* ignore */ }
    render();
  });
  root.querySelector('#tl-busy').addEventListener('change', (e) => {
    onlyBusy = e.target.checked;
    try { localStorage.setItem('lou-tl-busy', onlyBusy ? '1' : '0'); } catch { /* ignore */ }
    render();
  });
}

const clock = (ms) => new Date(ms).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const units = (u) => Object.entries(u || {}).filter(([, n]) => n > 0).map(([id, n]) => `${fmtNum(n)} ${unitName(id)}`).join(', ');

function tip(b) {
  const when = `${clock(b.s0 ?? b.s)} → ${clock(b.e0 ?? b.e)}${b.e0 > Date.now() ? ` (${fmtDur(b.e0 - Date.now())})` : ''}`;
  switch (b.kind) {
    case 'incoming': return `⚠️ ${b.owner || '?'} · ${b.order || 'attack'} ${t('dari')} ${b.from}${b.units ? ` · ${units(b.units)}` : ''}\n${when}`;
    case 'army': return `${b.order}${b.repeat ? ' 🔁' : ''} → ${b.target || ''}\n${units(b.units)}\n${when}`;
    case 'trade': return `${b.back ? t('Kembali (kosong)') : `📦 ${t('Kirim')} → ${b.target}`}${b.load ? ` · ${fmtNum(b.load)}` : ''} ${b.ships ? '⛵' : '🛒'}\n${when}`;
    case 'tradeIn': return `📥 ${t('Kiriman masuk')} ${t('dari')} ${b.from}${b.load ? ` · ${fmtNum(b.load)}` : ''}\n${when}`;
    case 'build': return `${b.demolish ? '🧹 ' + t('Bongkar') : '🔨'} ${buildingName(b.type)}${b.toLevel ? ` → L${b.toLevel}` : ''}${b.waiting ? ` (${t('menunggu')})` : ''}\n${when}`;
    case 'recruit': return `🎖️ ${fmtNum(b.count)}× ${unitName(b.unit)}${b.done ? ` (${fmtNum(b.done)} ${t('selesai')})` : ''}\n${when}`;
    default: return when;
  }
}
function label(b) {
  if (b.kind === 'build') return `${buildingName(b.type)}${b.toLevel ? ' ' + b.toLevel : ''}`;
  if (b.kind === 'recruit') return `${fmtNum(b.count)} ${unitName(b.unit)}`;
  if (b.kind === 'incoming') return b.owner || '⚠️';
  if (b.kind === 'army') return b.target || b.order;
  if (b.kind === 'trade') return b.back ? '↩' : b.target;
  if (b.kind === 'tradeIn') return b.from;
  return '';
}

export function render() {
  if (!root) return;
  root.querySelectorAll('#tl-span [data-h]').forEach((b) => b.classList.toggle('on', +b.dataset.h === span));
  root.querySelector('#tl-busy').checked = onlyBusy;
  const now = Date.now();
  const total = span * 3.6e6, from = now - total * PAST, to = from + total;
  const tl = buildTimeline(ctx.state, { from, to, now });
  const X = (ms) => ((ms - from) / total) * 100;
  // hour ticks (fewer for long spans)
  const step = span <= 6 ? 1 : span <= 12 ? 2 : span <= 24 ? 3 : 6;
  const ticks = [];
  for (let h = Math.ceil(from / 3.6e6 / step) * step; h * 3.6e6 <= to; h += step) ticks.push(h * 3.6e6);
  const axis = `<div class="tl-axis">${ticks.map((ms) => `<span style="left:${X(ms)}%">${clock(ms)}</span>`).join('')}<span class="tl-now-l" style="left:${X(now)}%">${t('sekarang')}</span></div>`;
  const grid = `${ticks.map((ms) => `<i class="tl-tick" style="left:${X(ms)}%"></i>`).join('')}<i class="tl-now" style="left:${X(now)}%"></i>`;
  const L = LANE();
  let rows = tl.rows;
  if (onlyBusy) rows = rows.filter((r) => LANES.some((k) => r.lanes[k].length));
  const body = rows.map((r) => {
    const lanes = LANES.filter((k) => r.lanes[k].length || !onlyBusy);
    return `<div class="tl-city">
      <div class="tl-name"><a href="#kota/${encodeURIComponent(r.key)}"><b>${esc(r.name)}</b></a> <span class="small muted">${r.key}</span></div>
      ${lanes.map((k) => `<div class="tl-row"><div class="tl-lab small muted">${L[k][0]} ${L[k][1]}</div><div class="tl-track">${grid}${r.lanes[k].map((b) => {
        const left = X(b.s), w = Math.max(0.35, X(b.e) - left);
        return `<div class="tl-b ${b.cls}${b.e0 > to ? ' cut' : ''}" style="left:${left}%;width:${w}%" title="${esc(tip(b))}"><span>${esc(label(b))}</span></div>`;
      }).join('')}</div></div>`).join('')}
    </div>`;
  }).join('');
  const mv = ctx.state.movements;
  root.querySelector('#tl-body').innerHTML = rows.length
    ? `<div class="tl card"><div class="tl-row tl-head"><div class="tl-lab"></div>${axis}</div>${body}</div>
       ${mv?.at && now - mv.at > 120000 ? `<p class="small muted">${t('Pergerakan terakhir terbaca {x} lalu — buka game agar timeline tetap lengkap.', { x: fmtDur(now - mv.at) })}</p>` : ''}`
    : `<div class="card small muted">${t('Tidak ada kegiatan dalam rentang waktu ini.')}</div>`;
  clearInterval(timer);
  timer = setInterval(() => { if (root.classList.contains('on')) render(); else clearInterval(timer); }, 20000);
}

export function onData(state, keys) {
  if (root?.classList.contains('on') && keys.some((k) => ['movements', 'layouts', 'cities'].includes(k))) render();
}
