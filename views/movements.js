// "🚩 Pergerakan" — armies on the move, incoming attacks, trade convoys and recruitment, read from the game's own state.
import { fmtNum, fmtAgo, esc, trainingTimes, unitName } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';

let root, ctx, timer = null;
const f = { order: 'all', city: 'all' };
const RES_I = { wood: '🪵', stone: '🪨', iron: '⛏️', food: '🌾', gold: '🪙' };
const ORDER = {
  raid: '⚔️ Raid', return: '↩️ Return', attack: '🗡️ Attack', assault: '🗡️ Assault', plunder: '💰 Plunder', siege: '🏹 Siege',
  support: '🛡️ Support', scout: '👁️ Scout', settle: '🏳️ Settle', trade: '🛒 Trade'
};
const orderLabel = (o) => ORDER[o] || (o ? o[0].toUpperCase() + o.slice(1) : '—');

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow">
        <h2>${t('Pergerakan &amp; Pelatihan')}</h2>
        <p>${t('Semua pasukan yang sedang bergerak, serangan masuk, konvoi dagang/Market, dan antrian pelatihan di semua kota — dibaca langsung dari game.')}</p>
      </div>
    </div>
    <div id="m-body"></div>`;
  root.addEventListener('change', (e) => {
    if (e.target.id === 'm-order') { f.order = e.target.value; render(ctx.state); }
    if (e.target.id === 'm-city') { f.city = e.target.value; render(ctx.state); }
  });
  root.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { e.preventDefault(); navigator.clipboard.writeText(cp.dataset.copy); ctx.toast(t('Koordinat disalin: {c}', { c: cp.dataset.copy })); }
  });
}

export function onData(state, keys) { if (keys.includes('movements') || keys.includes('dungeons')) render(state); }

export function render(state) {
  if (!root) return;
  clearInterval(timer);
  timer = setInterval(() => {
    if (!root.classList.contains('on')) return clearInterval(timer);
    if (root.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return; // don't close an open dropdown
    draw(ctx.state);
  }, 1000);
  draw(state);
}

// ---------- helpers ----------
function cd(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return t('tiba');
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
function clock(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const tm = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  return new Date().toDateString() === d.toDateString() ? tm : d.toLocaleDateString(locale(), { weekday: 'short' }) + ' ' + tm;
}
function units(u) {
  const e = Object.entries(u || {}).filter(([, n]) => n > 0);
  return e.length ? e.map(([k, n]) => `<span class="pill">${fmtNum(n)}× ${esc(unitName(k))}</span>`).join(' ') : '<span class="muted">—</span>';
}
function carry(c) {
  const e = Object.entries(c || {}).filter(([, n]) => n > 0);
  return e.length ? e.map(([k, n]) => `${RES_I[k] || ''}${fmtNum(n)}`).join(' ') : '<span class="muted">—</span>';
}
function place(label, x, y) {
  const key = `${x}:${y}`;
  const coord = `<a href="#" class="small muted" data-copy="${key}">${key}</a>`;
  const own = Object.values(ctx.state.cities).find((c) => c.key === key);
  if (label?.kind === 'own' || own) return `🏰 <b>${esc(label?.name || own.name)}</b> ${coord}`;
  if (label?.kind === 'dungeon') return `${esc(cap(label.type))} Dungeon <b>L${label.level}</b> ${coord}`;
  if (label?.kind === 'boss') return `👹 ${esc(cap(label.type))} <b>L${label.level}</b> ${coord}`;
  if (label?.kind === 'city') return `${esc(label.name || 'City')}${label.owner ? ` <span class="muted small">(${esc(label.tag ? `[${label.tag}] ` : '')}${esc(label.owner)})</span>` : ''} ${coord}`;
  const dg = ctx.state.dungeons[key];
  if (dg) return `${dg.kind === 'boss' ? '👹 ' + esc(dg.type) : esc(dg.type) + ' Dungeon'} <b>L${dg.level}</b> ${coord}`;
  return coord;
}
const cap = (s) => String(s || '').replace(/^\w/, (c) => c.toUpperCase());
function progress(dep, arr, now) {
  if (!dep || !arr || arr <= dep) return '';
  const p = Math.max(0, Math.min(100, ((now - dep) / (arr - dep)) * 100));
  return `<span class="bar prog"><i style="width:${p.toFixed(0)}%;background:var(--gold)"></i></span>`;
}

// ---------- drawing ----------
function draw(state) {
  const el = root.querySelector('#m-body');
  const mv = state.movements;
  if (!mv) {
    el.innerHTML = `<div class="empty">${t('<b>Belum ada data pergerakan.</b><br>Buka <a href="https://lordofultima.me/" target="_blank">lordofultima.me</a> — data pasukan, perdagangan &amp; pelatihan terbaca otomatis dalam beberapa detik.')}</div>`;
    return;
  }
  const now = Date.now() + (mv.serverOffset || 0); // server time
  const armies = mv.armies || [];
  const troops = armies.filter((a) => !a.trade);
  const trades = armies.filter((a) => a.trade);
  const inc = mv.incoming || [];
  const incT = mv.incomingTrades || [];
  const training = (mv.training || []).map((c) => ({ ...c, items: trainingTimes(c.queue, now) }));
  const busy = training.filter((c) => c.items.length);
  const stale = Date.now() - (mv.at || 0) > 60000;

  const orders = [...new Set(troops.map((a) => a.order))];
  const homes = [...new Map(troops.map((a) => [a.home?.name || '?', a.home?.name || '?'])).values()];
  const shown = troops
    .filter((a) => f.order === 'all' || a.order === f.order)
    .filter((a) => f.city === 'all' || (a.home?.name || '?') === f.city)
    .sort((a, b) => (a.arriveAt || Infinity) - (b.arriveAt || Infinity));

  el.innerHTML = `
    ${stale ? `<div class="banner">⚠️ ${t('Data terakhir {x}. Hitung mundur tetap berjalan, tapi pergerakan baru hanya terbaca saat game terbuka.', { x: fmtAgo(mv.at) })}</div>` : ''}
    <div class="summary">
      <div class="stat"><div class="k">⚠️ ${t('Serangan masuk')}</div><div class="v num" style="color:${inc.length ? 'var(--bad)' : 'inherit'}">${inc.length}</div></div>
      <div class="stat"><div class="k">⚔️ ${t('Pasukan bergerak')}</div><div class="v num">${troops.length}</div></div>
      <div class="stat"><div class="k">🛒 ${t('Konvoi dagang')}</div><div class="v num">${trades.length + incT.length}</div></div>
      <div class="stat"><div class="k">🎖️ ${t('Kota sedang melatih')}</div><div class="v num">${busy.length} / ${training.length}</div></div>
      <div class="stat"><div class="k">${t('Update')}</div><div class="v" style="font-size:15px">${fmtAgo(mv.at)}</div></div>
    </div>

    <div class="card msec ${inc.length ? 'danger' : ''}">
      <h3>⚠️ ${t('Serangan masuk')}</h3>
      ${inc.length ? `<div class="table-wrap"><table><thead><tr><th>${t('Dari')}</th><th>${t('Penyerang')}</th><th>${t('Ke')}</th><th>${t('Misi')}</th><th>${t('Pasukan')}</th><th>${t('Tiba dalam')}</th><th>${t('Jam')}</th></tr></thead><tbody>
        ${inc.sort((a, b) => (a.arriveAt || 0) - (b.arriveAt || 0)).map((a) => `<tr>
          <td>${place(a.src, a.fromX, a.fromY)}</td><td><b>${esc(a.owner || '?')}</b></td><td>${place(a.target, a.toX, a.toY)}</td>
          <td>${orderLabel(a.order)}</td><td>${a.units ? units(a.units) : `<span class="muted">${t('tidak terlihat')}</span>`}</td>
          <td class="num" style="color:var(--bad);font-weight:700">${cd(a.arriveAt - now)}</td><td class="small">${clock(a.arriveAt - (mv.serverOffset || 0))}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="small" style="color:var(--good)">${t('Tidak ada serangan masuk.')} ✓</div>`}
    </div>

    <div class="card msec">
      <div class="row"><h3 class="grow">⚔️ ${t('Pergerakan pasukan')} <span class="muted small">(${troops.length})</span></h3>
        <label class="small muted">${t('Misi')} <select id="m-order"><option value="all">${t('Semua')}</option>${orders.map((o) => `<option value="${esc(o)}" ${f.order === o ? 'selected' : ''}>${esc(orderLabel(o))}</option>`).join('')}</select></label>
        <label class="small muted">${t('Kota')} <select id="m-city"><option value="all">${t('Semua')}</option>${homes.map((h) => `<option ${f.city === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>
      </div>
      ${shown.length ? `<div class="table-wrap"><table><thead><tr><th>${t('Kota asal')}</th><th>${t('Dari')}</th><th>${t('Ke')}</th><th>${t('Misi')}</th><th>${t('Pasukan')}</th><th>${t('Muatan')}</th><th>${t('Perjalanan')}</th><th>${t('Tiba dalam')}</th><th>${t('Jam')}</th></tr></thead><tbody>
        ${shown.map((a) => `<tr>
          <td><b>${esc(a.home?.name || '?')}</b></td>
          <td>${place(a.order === 'return' ? a.target : a.home, a.fromX, a.fromY)}</td>
          <td>${place(a.order === 'return' ? a.home : a.target, a.toX, a.toY)}</td>
          <td>${orderLabel(a.order)}${a.repeat ? ` <span class="pill info" title="${t('Raid diulang otomatis sampai di-recall')}">🔁</span>` : ''}${a.stationed ? ` <span class="pill">${t('ditempatkan')}</span>` : ''}</td>
          <td>${units(a.units)}</td><td class="small">${carry(a.carry)}</td>
          <td>${progress(a.departAt, a.arriveAt, now)}</td>
          <td class="num"><b>${a.stationed ? '—' : cd(a.arriveAt - now)}</b></td><td class="small">${a.stationed ? '' : clock(a.arriveAt - (mv.serverOffset || 0))}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="small muted">${t('Tidak ada pasukan yang bergerak.')}</div>`}
    </div>

    <div class="card msec">
      <h3>🛒 ${t('Perdagangan &amp; Market')}</h3>
      ${trades.length ? `<div class="table-wrap"><table><thead><tr><th>${t('Arah')}</th><th>${t('Dari')}</th><th>${t('Ke')}</th><th>${t('Muatan')}</th><th>${t('Angkutan')}</th><th>${t('Perjalanan')}</th><th>${t('Tiba dalam')}</th><th>${t('Jam')}</th></tr></thead><tbody>
        ${trades.sort((a, b) => (a.arriveAt || 0) - (b.arriveAt || 0)).map((a) => `<tr>
          <td>${a.order === 'return' ? '↩️ ' + t('Kembali (kosong)') : '📦 ' + t('Kirim')}</td>
          <td>${place(a.order === 'return' ? a.target : a.home, a.fromX, a.fromY)}</td>
          <td>${place(a.order === 'return' ? a.home : a.target, a.toX, a.toY)}</td>
          <td class="small">${Object.values(a.carry || {}).some((n) => n > 0) ? carry(a.carry) : a.order === 'return' ? '<span class="muted">—</span>' : fmtNum(a.tradeLoad)}</td>
          <td class="small">${a.tradeShips ? '⛵ ' + t('kapal') : '🛒 ' + t('gerobak')}${a.tradeLoad ? ` · ${fmtNum(a.tradeLoad)}` : ''}</td>
          <td>${progress(a.departAt, a.arriveAt, now)}</td>
          <td class="num"><b>${cd(a.arriveAt - now)}</b></td><td class="small">${clock(a.arriveAt - (mv.serverOffset || 0))}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="small muted">${t('Tidak ada konvoi dagang milikmu yang sedang berjalan.')}</div>`}
      <h3 style="margin-top:12px;font-size:14px">📥 ${t('Kiriman masuk dari pemain lain')} <span class="muted small">(${incT.length})</span></h3>
      ${incT.length ? `<div class="table-wrap"><table><thead><tr><th>${t('Dari')}</th><th>${t('Ke')}</th><th>${t('Muatan')}</th><th>${t('Tiba dalam')}</th><th>${t('Jam')}</th></tr></thead><tbody>
        ${incT.map((tr) => { const at = tr.arriveAt || tr.endsAt || tr.at; return `<tr>
          <td>${esc(tr.fromName || tr.senderName || tr.ownerName || tr.cityName || '?')} ${tr.fromX != null ? place(null, tr.fromX, tr.fromY) : ''}</td>
          <td>${tr.toX != null ? place(null, tr.toX, tr.toY) : esc(tr.toName || '')}</td>
          <td class="small">${tr.carry ? carry(tr.carry) : tr.res ? `${RES_I[tr.res] || ''}${fmtNum(tr.amount)}` : fmtNum(tr.load || tr.tradeLoad || tr.amount)}</td>
          <td class="num"><b>${at ? cd(at - now) : '—'}</b></td><td class="small">${at ? clock(at - (mv.serverOffset || 0)) : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="small muted">${t('Tidak ada kiriman masuk.')}</div>`}
      ${(mv.marketMine || []).length ? `<h3 style="margin-top:12px;font-size:14px">🏷️ ${t('Penawaranku di Market')}</h3>
        <div class="table-wrap"><table><thead><tr><th>${t('Kota')}</th><th>${t('Jual')}</th><th>${t('Harga')}</th><th>${t('Berakhir dalam')}</th></tr></thead><tbody>
        ${mv.marketMine.map((o) => `<tr><td>${esc(o.cityName || '')}</td><td>${RES_I[o.res] || ''}${fmtNum(o.amount)}</td><td>${o.price ?? ''}</td><td class="num">${o.endsAt ? cd(o.endsAt - now) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : ''}
    </div>

    <div class="card msec">
      <h3>🎖️ ${t('Pelatihan pasukan &amp; pasukan di kota')}</h3>
      <div class="table-wrap"><table><thead><tr><th>${t('Kota')}</th><th>${t('Pasukan di kota')}</th><th>${t('Antrian pelatihan')}</th><th>${t('Unit berikut')}</th><th>${t('Antrian selesai')}</th></tr></thead><tbody>
        ${training.map((c) => {
          const last = c.items[c.items.length - 1];
          const q = c.items.length ? c.items.map((it) => `<div class="tq">
              <span class="pill ${it.active ? 'info' : ''}">${it.active ? '▶' : '⏳'} ${fmtNum(it.done)}/${fmtNum(it.count)} ${esc(unitName(it.unit))}</span>
              ${it.active ? progress(it.start, it.end, now) : ''} <span class="small muted">${t('selesai')} ${clock(it.end - (mv.serverOffset || 0))}</span></div>`).join('')
            : `<span class="small" style="color:var(--warn)">${t('kosong')}</span>`;
          const next = c.items.find((it) => it.active && it.nextUnit);
          return `<tr>
            <td><b>${esc(c.name)}</b> <a href="#" class="small muted" data-copy="${c.x}:${c.y}">${c.x}:${c.y}</a></td>
            <td>${units(c.units)}</td><td>${q}</td>
            <td class="num">${next ? cd(next.nextUnit - now) : '—'}</td>
            <td class="num">${last ? `<b>${cd(last.end - now)}</b> <span class="small muted">${clock(last.end - (mv.serverOffset || 0))}</span>` : '—'}</td></tr>`;
        }).join('')}
      </tbody></table></div>
    </div>`;
}
