// "✅ To-do" — what needs doing now, over all cities, most urgent first (lib/todo.js). Items can be snoozed.
import { esc, fmtNum, fmtDur, fmtClock, RES_ICON, RES_LABEL } from '../lib/shared.js';
import { t } from '../lib/i18n.js';
import { buildTodos } from '../lib/todo.js';

let root, ctx, timer = null;
const SEV = () => [['bad', t('Kritis')], ['warn', t('Penting')], ['info', t('Sebaiknya')], ['', t('Info')]];

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head"><div class="grow"><h2>✅ ${t('To-do')}</h2>
      <p>${t('Yang perlu dikerjakan sekarang di semua kota, paling mendesak di atas. Klik untuk membuka kotanya; 💤 menyembunyikan satu item untuk sementara.')}</p></div>
      <button class="btn sm" id="td-wake" title="${t('Tampilkan lagi semua item yang ditunda')}">💤 ${t('Tampilkan yang ditunda')}</button></div>
    <div id="td-body"></div>`;
  root.addEventListener('click', onClick);
}

function text(x) {
  const c = `<b>${esc(x.city || x.key || '')}</b>`;
  switch (x.kind) {
    case 'incoming': return t('{n} serangan menuju {c} — tiba {d}', { n: x.n, c, d: `<b>${fmtDur(x.at - Date.now())}</b>` });
    case 'food': return x.at <= Date.now() ? t('Makanan {c} habis — pasukan kelaparan', { c }) : t('Makanan {c} habis dalam {d}', { c, d: `<b>${fmtDur(x.at - Date.now())}</b>` });
    case 'full': return x.at <= Date.now() ? t('Gudang {r} {c} penuh — produksi terbuang', { c, r: `${RES_ICON[x.res]} ${RES_LABEL[x.res]}` }) : t('Gudang {r} {c} penuh dalam {d}', { c, r: `${RES_ICON[x.res]} ${RES_LABEL[x.res]}`, d: `<b>${fmtDur(x.at - Date.now())}</b>` });
    case 'queue': return t('Antrian bangunan {c} kosong', { c });
    case 'queueSoon': return t('Antrian bangunan {c} selesai dalam {d}', { c, d: `<b>${fmtDur(x.at - Date.now())}</b>` });
    case 'recruit': return t('Antrian rekrut {c} kosong', { c });
    case 'idle': return t('{n} pasukan menganggur di {c} — kirim raid?', { n: fmtNum(x.n), c });
    case 'dungeon': return t('Dungeon {d} yang sedang di-raid sudah ≈{p}% dijelajahi — cari dungeon baru', { d: `<b>${esc(`${x.type || ''} L${x.level ?? '?'} (${x.key})`)}</b>`, p: Math.round(x.n) });
    default: return esc(x.kind);
  }
}
const ICON = { incoming: '⚠️', food: '🌾', full: '📦', queue: '🔨', queueSoon: '🔨', recruit: '🎖️', idle: '⚔️', dungeon: '🗺️' };

export function render() {
  if (!root) return;
  const S = ctx.state, now = Date.now();
  const list = buildTodos(S, now);
  const snoozed = Object.values(S.todoSnooze || {}).filter((u) => u > now).length;
  root.querySelector('#td-wake').classList.toggle('hide', !snoozed);
  const sev = SEV();
  root.querySelector('#td-body').innerHTML = list.length ? `<div class="todo-list">${list.map((x) => `
    <div class="todo sev${x.sev}">
      <span class="pill ${sev[x.sev][0]}">${sev[x.sev][1]}</span>
      <a href="#${x.go.split('/').map((p, i) => (i ? encodeURIComponent(p) : p)).join('/')}" class="grow todo-t">${ICON[x.kind] || '•'} ${text(x)}</a>
      ${x.at && x.at > now ? `<span class="small muted num">${fmtClock(x.at)}</span>` : ''}
      <button class="btn sm" data-snooze="${esc(x.id)}" data-h="1" title="${t('Sembunyikan 1 jam')}">💤 ${t('{h}j', { h: 1 })}</button>
      <button class="btn sm" data-snooze="${esc(x.id)}" data-h="8" title="${t('Sembunyikan 8 jam')}">${t('{h}j', { h: 8 })}</button>
    </div>`).join('')}</div>`
    : `<div class="card"><b style="color:var(--good)">✓ ${t('Tidak ada yang mendesak.')}</b> <span class="small muted">${t('Daftar ini memakai data terakhir dari game; buka game agar tetap terbaru.')}</span></div>`;
  clearInterval(timer);
  timer = setInterval(() => { if (root.classList.contains('on')) render(); else clearInterval(timer); }, 30000);
}

async function onClick(e) {
  const b = e.target.closest('[data-snooze]');
  if (b) {
    const all = { ...(ctx.state.todoSnooze || {}) }, now = Date.now();
    for (const [k, u] of Object.entries(all)) if (u <= now) delete all[k];
    all[b.dataset.snooze] = now + (+b.dataset.h || 1) * 3.6e6;
    await ctx.save({ todoSnooze: all });
    render();
    return;
  }
  if (e.target.closest('#td-wake')) { await ctx.save({ todoSnooze: {} }); render(); }
}

const KEYS = ['cities', 'movements', 'layouts', 'dungeons', 'dungeonGains', 'settings', 'todoSnooze'];
export function onData(state, keys) {
  if (root?.classList.contains('on') && keys.some((k) => KEYS.includes(k))) render();
}

// number of urgent items (critical + high) for the menu badge / popup
export const urgentCount = (state) => buildTodos(state).filter((x) => x.sev <= 1).length;
