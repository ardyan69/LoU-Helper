import { RES, RES_LABEL, RES_ICON, accountGold, projected, fullAt, emptyAt, fmtNum, fmtDur, fmtClock, fmtAgo, esc } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import * as transfer from './transfer.js';
import { cityFood } from '../lib/food.js';
import { refreshAllRates } from '../lib/cityrates.js';
import { rpct, researchLevels } from '../lib/research.js';

let root, ctx, sortBy = 'full', sortDir = 1;
let mode = (() => { try { return localStorage.getItem('lou.cityView') || 'cards'; } catch { return 'cards'; } })();
const RES_COLOR = { wood: 'var(--wood)', stone: 'var(--stone)', iron: 'var(--iron)', food: 'var(--food)' };

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow">
        <h2>${t('Ringkasan Kota')}</h2>
        <p>${t('Data dibaca otomatis dari bar resource di game. Buka tiap kota sekali (atau panel <b>Your cities</b>) supaya semua kota tercatat.')}</p>
      </div>
      <div class="field">${t('Tampilan')}
        <div class="seg" id="c-mode">
          <button data-mode="cards" title="${t('Kartu per kota')}">🗂 ${t('Kartu')}</button>
          <button data-mode="list" title="${t('Satu baris per kota')}">☰ ${t('Tabel list')}</button>
          <button data-mode="detail" title="${t('Stok, kapasitas, %, produksi & waktu penuh per resource')}">▦ ${t('Tabel detail')}</button>
          <button data-mode="transfer" title="${t('Rencana kirim resource antar-kota')}">🔁 ${t('Transfer')}</button>
          <button data-mode="food" title="${t('Produksi makanan vs makan pasukan per kota')}">🌾 ${t('Makanan pasukan')}</button>
        </div>
      </div>
      <div class="field">&nbsp;<button class="btn" id="c-refresh" title="${t('Minta data terbaru semua kota dari tab game, lalu hitung ulang produksi/jam & kapasitas tiap kota dari layout game-nya')}">🔄 ${t('Refresh semua kota')}</button></div>
      <label class="field">${t('Urutkan')}
        <select id="c-sort">
          <option value="full">${t('Gudang penuh tercepat')}</option>
          <option value="queue">${t('Antrian selesai tercepat')}</option>
          <option value="name">${t('Nama kota')}</option>
          <option value="group">${t('Grup')}</option>
          <option value="seen">${t('Terakhir dilihat')}</option>
          <option value="score">${t('Skor')}</option>
          <option value="troops">${t('Pasukan')}</option>
        </select>
      </label>
    </div>
    <div id="c-stale"></div>
    <div class="summary" id="c-summary"></div>
    <div id="c-list"></div>`;
  root.querySelector('#c-sort').addEventListener('change', (e) => { sortBy = e.target.value; sortDir = 1; render(ctx.state); });
  root.querySelector('#c-refresh').addEventListener('click', refreshAll);
  root.querySelector('#c-mode').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    mode = b.dataset.mode;
    try { localStorage.setItem('lou.cityView', mode); } catch { /* ignore */ }
    render(ctx.state);
  });
  root.addEventListener('change', (e) => { if (mode === 'transfer') transfer.onInput(e, () => render(ctx.state)); });
  root.addEventListener('click', async (e) => {
    const th = e.target.closest('th[data-sort]');
    if (th) {
      sortDir = sortBy === th.dataset.sort ? -sortDir : 1;
      sortBy = th.dataset.sort;
      const sel = root.querySelector('#c-sort');
      if ([...sel.options].some((o) => o.value === sortBy)) sel.value = sortBy;
      render(ctx.state);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const key = del.dataset.del;
      if (!confirm(t('Hapus kota {key} dari daftar? (Akan muncul lagi kalau kamu membukanya di game.)', { key }))) return;
      const cities = { ...ctx.state.cities };
      delete cities[key];
      await ctx.save({ cities });
      render(ctx.state);
    }
    const cp = e.target.closest('[data-copy]');
    if (cp) { e.preventDefault(); navigator.clipboard.writeText(cp.dataset.copy); ctx.toast(t('Koordinat disalin: {c}', { c: cp.dataset.copy })); }
  });
}

function earliestFull(c, pct) {
  if (!c.res) return Infinity;
  let t = Infinity;
  for (const r of RES) { const f = fullAt(c.res[r], c.seenAt, pct); if (f && f < t) t = f; }
  return t;
}

export function render(state) {
  if (!root) return;
  const pct = state.settings.alerts.fullThreshold;
  const list = Object.values(state.cities);
  const now = Date.now();

  // summary (one line)
  const totals = { wood: 0, stone: 0, iron: 0, food: 0, gold: 0 };
  let idleQueues = 0, soonFull = 0, foodNeg = 0, troops = 0;
  for (const c of list) {
    if (c.res) for (const k of RES) totals[k] += c.res[k]?.rate || 0;
    if (c.queue && c.queue.count === 0) idleQueues++;
    if (earliestFull(c, pct) - now < 2 * 3.6e6) soonFull++;
    if ((c.res?.food?.rate ?? 0) < 0) foodNeg++;
  }
  for (const tr of state.movements?.training || []) for (const n of Object.values(tr.units || {})) troops += n || 0;
  for (const a of state.movements?.armies || []) if (!a.trade) for (const n of Object.values(a.units || {})) troops += n || 0;
  const incoming = (state.movements?.incoming || []).filter((a) => !a.arriveAt || a.arriveAt - (state.movements.serverOffset || 0) > now).length;
  totals.gold = accountGold(state.cities, now)?.rate || 0; // already the total of all cities
  const tile = (k, v, color, title) => `<div class="stat" title="${esc(title || k)}"><div class="k">${k}</div><div class="v num"${color ? ` style="color:${color}"` : ''}>${v}</div></div>`;
  root.querySelector('#c-summary').innerHTML = [
    tile(`🏰 ${t('Kota')}`, list.length, '', t('Kota tercatat')),
    ...['wood', 'stone', 'iron', 'food', 'gold'].map((k) => tile(`${RES_ICON[k]} ${t('/jam')}`, `${totals[k] >= 0 ? '+' : ''}${fmtNum(totals[k])}`, totals[k] < 0 ? 'var(--bad)' : '', t('{r} / jam (total)', { r: RES_LABEL[k] }))),
    tile(`⚔️ ${t('Pasukan')}`, fmtNum(troops), '', t('Semua pasukan: di kota + sedang bergerak')),
    tile(`⚠️ ${t('Serangan')}`, incoming, incoming ? 'var(--bad)' : '', t('Serangan masuk')),
    tile(`🌾 ${t('Minus')}`, foodNeg, foodNeg ? 'var(--bad)' : '', t('Kota dengan produksi makanan minus')),
    tile(`🔨 ${t('Kosong')}`, idleQueues, idleQueues ? 'var(--warn)' : '', t('Antrian kosong')),
    tile(`📦 ≥${pct}%`, soonFull, soonFull ? 'var(--warn)' : '', t('Gudang ≥{p}% dalam 2 jam', { p: pct }))
  ].join('');
  root.querySelector('#c-summary').classList.add('oneline');

  const latest = Math.max(0, ...list.map((c) => Math.max(c.syncedAt || 0, c.seenAt || 0)));
  root.querySelector('#c-stale').innerHTML = latest && now - latest > 5 * 60000
    ? `<div class="banner">⚠️ ${t('Data terakhir masuk <b>{x}</b>. Kalau game sedang terbuka tapi angka tidak bergerak, refresh tab game (F5) sekali. Ingat: tiap kota hanya terbaca saat kota itu sedang aktif di game — angka di bawah tetap diproyeksikan dari produksi/jam.', { x: fmtAgo(latest) })}</div>`
    : '';
  if (!list.length) {
    root.querySelector('#c-list').innerHTML = `<div class="empty">${t('<b>Belum ada kota.</b><br>Buka <a href="https://lordofultima.me/" target="_blank">lordofultima.me</a>, login, lalu pindah-pindah kota sebentar. Data akan muncul di sini otomatis.')}</div>`;
    return;
  }

  list.sort((a, b) => cmp(sortKey(a, sortBy, pct, now), sortKey(b, sortBy, pct, now)) * sortDir);
  root.querySelectorAll('#c-mode [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  const el = root.querySelector('#c-list');
  if (mode === 'transfer') el.innerHTML = transfer.html(state);
  else if (mode === 'food') el.innerHTML = foodTable(state, list, now);
  else if (mode === 'list') el.innerHTML = tableList(list, pct, now);
  else if (mode === 'detail') el.innerHTML = tableDetail(list, pct, now);
  else el.innerHTML = `<div class="cities">${list.map((c) => card(c, pct, now)).join('')}</div>`;
}

// ---------- sorting ----------
function cmp(x, y) {
  if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y), locale(), { numeric: true });
  return (x ?? Infinity) - (y ?? Infinity);
}
function sortKey(c, key, pct, now) {
  const [k, r] = key.split(':');
  switch (k) {
    case 'full': return earliestFull(c, pct);
    case 'queue': return c.queue?.count === 0 ? -1 : c.queue?.endsAt || Infinity;
    case 'name': return String(c.name);
    case 'group': return String(c.group || '~');
    case 'seen': return -(c.seenAt || 0);
    case 'score': return -(c.score ?? -1);
    case 'troops': return -(c.troops ?? -1);
    case 'bld': return -(c.buildings?.used ?? -1);
    case 'gold': return -(c.res?.gold ? projected(c.res.gold, c.seenAt, now) : -1);
    case 'rate': return c.res?.[r]?.rate == null ? Infinity : -c.res[r].rate;
    case 'v': return -(resInfo(c, r, pct, now)?.v ?? -1);
    case 'p': return -(resInfo(c, r, pct, now)?.p ?? -1);
    case 'rate': return -(c.res?.[r]?.rate ?? -1e9);
    case 'cap': return -(c.res?.[r]?.cap ?? -1);
    case 'eta': { const i = resInfo(c, r, pct, now); return i?.etaAt ?? Infinity; }
    default: return 0;
  }
}

// ---------- shared per-resource info ----------
function resInfo(c, r, pct, now) {
  const x = c.res?.[r];
  if (!x) return c.list?.[r] != null ? { v: c.list[r], approx: true } : null;
  const v = projected(x, c.seenAt, now);
  const p = x.cap ? Math.min(100, (v / x.cap) * 100) : 0;
  const f = fullAt(x, c.seenAt, pct), e = emptyAt(x, c.seenAt);
  let eta = '<span class="muted">—</span>', etaAt = null;
  if (e) { etaAt = e; eta = e > now ? `<span style="color:var(--bad)">${t('habis {x}', { x: fmtDur(e - now) })}</span>` : `<span style="color:var(--bad)">${t('HABIS')}</span>`; }
  else if (p >= pct) { etaAt = now; eta = `<span style="color:var(--bad)">${t('PENUH')}</span>`; }
  else if (f) { etaAt = f; eta = `<span style="color:${f - now < 2 * 3.6e6 ? 'var(--warn)' : 'inherit'}">${fmtDur(f - now)}</span>`; }
  const color = p >= pct ? 'var(--bad)' : p >= 80 ? 'var(--warn)' : RES_COLOR[r];
  return { v, cap: x.cap, p, rate: x.rate, eta, etaAt, color };
}

function queueCell(c, now) {
  const q = c.queue;
  if (!q) return '<span class="muted">?</span>';
  if (q.count === 0) return `<span style="color:var(--warn)">${t('kosong')}</span>`;
  if (q.endsAt && q.endsAt > now) return `${q.count ?? '?'} · <b>${fmtDur(q.endsAt - now)}</b> <span class="muted small">(${fmtClock(q.endsAt)})</span>`;
  if (q.endsAt) return `<span style="color:var(--warn)">${t('selesai?')}</span>`;
  return t('{n} order', { n: q.count });
}
function th(label, key, cls = '') {
  const on = sortBy === key;
  return `<th class="sort ${cls}${on ? ' on' : ''}" data-sort="${key}">${label}${on ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
}
function cityCell(c) {
  return `<td class="sticky-col"><b>${esc(c.name)}</b> <a href="#" class="small muted" data-copy="${c.key}" title="${t('Salin koordinat')}">${c.key}</a></td>`;
}
function delCell(c) { return `<td><button class="btn sm danger" data-del="${c.key}" title="${t('Hapus dari daftar')}">✕</button></td>`; }

// ---------- table: one row per city ----------
function tableList(list, pct, now) {
  const rows = list.map((c) => {
    const stale = now - Math.max(c.syncedAt || 0, c.seenAt || 0) > 6 * 3.6e6;
    const first = (() => {
      let best = null;
      for (const r of RES) { const i = resInfo(c, r, pct, now); if (i?.etaAt && (!best || i.etaAt < best.i.etaAt)) best = { r, i }; }
      return best ? `${RES_ICON[best.r]} ${best.i.eta}` : '<span class="muted">—</span>';
    })();
    return `<tr class="${stale ? 'stale' : ''}">
      ${cityCell(c)}
      <td>${c.group ? `<span class="pill">${esc(c.group)}</span>` : ''}</td>
      ${RES.map((r) => {
        const i = resInfo(c, r, pct, now);
        if (!i) return '<td class="muted">—</td>';
        if (i.approx) return `<td class="r num muted" title="${t('Perkiraan dari daftar kota')}">~${fmtNum(i.v)}</td>`;
        return `<td class="r num"><div class="res-mini"><span>${fmtNum(i.v)}</span><span class="bar"><i style="width:${i.p.toFixed(0)}%;background:${i.color}"></i></span></div></td>`;
      }).join('')}
      ${RES.map((r) => rateCell(c.res?.[r])).join('')}
      <td class="r num">${c.res?.gold ? fmtNum(projected(c.res.gold, c.seenAt, now)) : '—'}</td>
      <td>${first}</td>
      <td>${queueCell(c, now)}</td>
      <td class="r num ${c.buildings && c.buildings.used >= c.buildings.max ? 'warn-t' : ''}">${c.buildings ? `${c.buildings.used}/${c.buildings.max}` : '—'}</td>
      <td class="r num">${c.troops != null ? fmtNum(c.troops) : c.troopsHome != null ? fmtNum(c.troopsHome) : '—'}</td>
      <td class="r num">${c.score != null ? fmtNum(c.score) : '—'}</td>
      <td class="small muted">${c.syncedAt || c.seenAt ? fmtAgo(Math.max(c.syncedAt || 0, c.seenAt || 0)) : '—'}</td>
      ${delCell(c)}
    </tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="ctable">
    <thead><tr>
      ${th(t('Kota'), 'name', 'sticky-col')}${th(t('Grup'), 'group')}
      ${RES.map((r) => th(`${RES_ICON[r]} ${RES_LABEL[r]}`, 'p:' + r, 'r')).join('')}
      ${RES.map((r) => th(`${RES_ICON[r]} ${t('/jam')}`, 'rate:' + r, 'r rate-col')).join('')}
      ${th(`${RES_ICON.gold} ${t('Emas')}`, 'gold', 'r')}${th(t('Penuh tercepat'), 'full')}${th(t('Antrian'), 'queue')}
      ${th('🏠', 'bld', 'r')}${th('⚔️ ' + t('Pasukan'), 'troops', 'r')}${th('★ ' + t('Skor'), 'score', 'r')}${th(t('Update'), 'seen')}<th></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- table: full details per resource ----------
function tableDetail(list, pct, now) {
  const tot = {};
  for (const r of RES) tot[r] = { v: 0, vx: 0, cap: 0, rate: 0 };
  const rows = list.map((c) => {
    const stale = now - Math.max(c.syncedAt || 0, c.seenAt || 0) > 6 * 3.6e6;
    const cells = RES.map((r) => {
      const i = resInfo(c, r, pct, now);
      if (!i) return '<td class="muted gs">—</td><td></td><td></td><td></td><td></td>';
      if (i.approx) { tot[r].v += i.v; return `<td class="r num muted gs" title="${t('Perkiraan dari daftar kota')}">~${fmtNum(i.v)}</td><td class="muted">—</td><td></td><td></td><td></td>`; }
      tot[r].v += i.v; tot[r].vx += i.v; tot[r].cap += i.cap || 0; tot[r].rate += i.rate || 0;
      return `<td class="r num gs">${fmtNum(i.v)}</td>
        <td class="r num muted">${fmtNum(i.cap)}</td>
        <td class="r num"><span style="color:${i.p >= 80 ? i.color : 'inherit'}">${i.p.toFixed(0)}%</span></td>
        <td class="r num" style="color:${i.rate < 0 ? 'var(--bad)' : 'inherit'}">${i.rate >= 0 ? '+' : ''}${fmtNum(i.rate)}</td>
        <td class="r">${i.eta}</td>`;
    }).join('');
    return `<tr class="${stale ? 'stale' : ''}">
      ${cityCell(c)}${cells}
      <td class="r num gs">${c.res?.gold ? fmtNum(projected(c.res.gold, c.seenAt, now)) : '—'}</td>
      <td class="r num">${c.res?.gold ? '+' + fmtNum(c.res.gold.rate) : ''}</td>
      <td class="gs">${queueCell(c, now)}</td>
      <td class="r num">${c.buildings ? `${c.buildings.used}/${c.buildings.max}` : '—'}</td>
      <td class="small muted">${c.syncedAt || c.seenAt ? fmtAgo(Math.max(c.syncedAt || 0, c.seenAt || 0)) : '—'}</td>
      ${delCell(c)}
    </tr>`;
  }).join('');
  const sub = (r) => `${th(t('Stok'), 'v:' + r, 'r gs')}${th(t('Kap'), 'cap:' + r, 'r')}${th('%', 'p:' + r, 'r')}${th(t('/jam'), 'rate:' + r, 'r')}${th(`≥${pct}%`, 'eta:' + r, 'r')}`;
  return `<div class="table-wrap"><table class="ctable detail">
    <thead>
      <tr class="grp"><th class="sticky-col"></th>${RES.map((r) => `<th colspan="5" class="gs">${RES_ICON[r]} ${RES_LABEL[r]}</th>`).join('')}<th colspan="2" class="gs">${RES_ICON.gold} ${t('Emas')}</th><th class="gs" colspan="4"></th></tr>
      <tr>${th(t('Kota'), 'name', 'sticky-col')}${RES.map(sub).join('')}${th(t('Stok'), 'gold', 'r gs')}<th class="r">${t('/jam')}</th>${th(t('Antrian'), 'queue', 'gs')}${th('🏠', 'bld', 'r')}${th(t('Update'), 'seen')}<th></th></tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td class="sticky-col"><b>${t('Total')}</b></td>${RES.map((r) => `
      <td class="r num gs"><b>${fmtNum(tot[r].v)}</b></td><td class="r num muted">${fmtNum(tot[r].cap)}</td>
      <td class="r num">${tot[r].cap ? ((tot[r].vx / tot[r].cap) * 100).toFixed(0) + '%' : ''}</td>
      <td class="r num"><b>${tot[r].rate >= 0 ? '+' : ''}${fmtNum(tot[r].rate)}</b></td><td></td>`).join('')}
      ${(() => { const g = accountGold(ctx.state.cities, now); return g ? `<td class="r num gs" title="${t('Emas dihitung per akun (sama di semua kota)')}"><b>${fmtNum(g.v)}</b></td><td class="r num"><b>+${fmtNum(g.rate)}</b></td>` : '<td class="gs"></td><td></td>'; })()}<td class="gs"></td><td></td><td></td><td></td></tr></tfoot>
  </table></div>`;
}

function card(c, pct, now) {
  const stale = now - Math.max(c.syncedAt || 0, c.seenAt || 0) > 6 * 3.6e6;
  const pills = [];
  if (c.group) pills.push(`<span class="pill">${esc(c.group)}</span>`);
  if (c.buildings) pills.push(`<span class="pill ${c.buildings.used >= c.buildings.max ? 'warn' : ''}">🏠 ${c.buildings.used}/${c.buildings.max}</span>`);
  if (c.troops != null) pills.push(`<span class="pill">⚔️ ${t('{n} pasukan', { n: fmtNum(c.troops) })}</span>`);
  if (c.score != null) pills.push(`<span class="pill">★ ${fmtNum(c.score)}</span>`);

  let queue = `<span class="pill">🔨 ${t('antrian: ?')}</span>`;
  const q = c.queue;
  if (q) {
    if (q.count === 0) queue = `<span class="pill warn">🔨 ${t('Antrian kosong')}</span>`;
    else if (q.endsAt && q.endsAt > now) queue = `<span class="pill info" title="${t('Diukur {x}', { x: fmtAgo(q.measuredAt) })}">🔨 ${t('{n} order · selesai {d} ({c})', { n: q.count ?? '?', d: fmtDur(q.endsAt - now), c: fmtClock(q.endsAt) })}</span>`;
    else if (q.endsAt && q.endsAt <= now) queue = `<span class="pill warn">🔨 ${t('Antrian kemungkinan sudah selesai')}</span>`;
    else if (q.count) queue = `<span class="pill" title="${t('Buka panel Construction di game untuk waktu selesai')}">🔨 ${t('{n} order · buka panel antrian untuk jam selesai', { n: q.count })}</span>`;
  }

  let body;
  if (c.res) {
    body = RES.map((r) => {
      const x = c.res[r];
      if (!x) return '';
      const v = projected(x, c.seenAt, now);
      const p = x.cap ? Math.min(100, (v / x.cap) * 100) : 0;
      const f = fullAt(x, c.seenAt, pct), e = emptyAt(x, c.seenAt);
      let eta = `<span class="muted">${t('stabil')}</span>`;
      if (p >= pct) eta = `<span style="color:var(--bad)">${t('PENUH')}</span>`;
      else if (f) eta = t('{p}% dlm {d}', { p: pct, d: `<b style="color:${f - now < 2 * 3.6e6 ? 'var(--warn)' : 'inherit'}">${fmtDur(f - now)}</b>` });
      if (e) eta = e > now ? `<span style="color:var(--bad)">${t('habis dlm {x}', { x: fmtDur(e - now) })}</span>` : `<span style="color:var(--bad)">${t('HABIS')}</span>`;
      const color = p >= pct ? 'var(--bad)' : p >= 80 ? 'var(--warn)' : RES_COLOR[r];
      return `
        <span class="ico" title="${RES_LABEL[r]}">${RES_ICON[r]}</span>
        <div class="bar"><i style="width:${p.toFixed(1)}%;background:${color}"></i></div>
        <span class="num small">${fmtNum(v)} / ${fmtNum(x.cap)}</span>
        <div class="meta"><span class="num">${x.rate >= 0 ? '+' : ''}${fmtNum(x.rate)}${t('/j')}</span><span>${eta}</span></div>`;
    }).join('');
    if (c.res.gold) body += `<span class="ico">${RES_ICON.gold}</span><span class="num small">${fmtNum(projected(c.res.gold, c.seenAt, now))}</span><span class="num small muted">+${fmtNum(c.res.gold.rate)}${t('/j')}</span>`;
    body = `<div class="resbar">${body}</div>`;
  } else if (c.list) {
    body = `<div class="small muted">${t('Hanya ringkasan dari daftar kota ({x}):', { x: fmtAgo(c.list.at) })}<br>
      ${RES.map((r) => `${RES_ICON[r]} ${fmtNum(c.list[r])}`).join(' &nbsp; ')}<br>${t('Buka kota ini di game untuk kapasitas &amp; produksi.')}</div>`;
  } else body = `<div class="small muted">${t('Belum ada data resource.')}</div>`;

  return `
    <div class="city ${stale ? 'stale' : ''}">
      <div class="city-head">
        <h3>${esc(c.name)}</h3>
        <a href="#" class="small muted" data-copy="${c.key}" title="${t('Salin koordinat')}">C${c.cont ?? '?'} · ${c.key}</a>
        <span class="grow"></span>
        <span class="small muted" title="${c.seenAt ? new Date(c.seenAt).toLocaleString(locale()) : ''}">${c.seenAt ? fmtAgo(c.seenAt) : ''}</span>
      </div>
      <div class="row">${pills.join('')}${queue}</div>
      ${body}
      <div class="city-foot"><span class="grow"></span><button class="btn sm danger" data-del="${c.key}">${t('Hapus')}</button></div>
    </div>`;
}

export function onData(state) { render(state); }

// ---------- 🌾 army food balance ----------
const sNum = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${fmtNum(n)}`);
const netCell = (n, until, now) => {
  if (n == null) return '<td class="num muted">—</td>';
  const col = n < 0 ? 'var(--bad)' : 'var(--good)';
  return `<td class="num"><b style="color:${col}">${sNum(n)}</b>${until ? `<div class="small" style="color:var(--bad)">${t('habis {t}', { t: fmtDur(until - now) })}</div>` : ''}</td>`;
};
function foodTable(state, list, now) {
  const rows = list.map((c) => cityFood(state, c.key, now)).filter(Boolean)
    .sort((a, b) => (a.netFull ?? a.netAll ?? a.netNow ?? Infinity) - (b.netFull ?? b.netAll ?? b.netNow ?? Infinity));
  const fr = researchLevels(state) ? rpct(state, 'food') : null;
  const advice = (f) => {
    if (f.gross == null) return `<span class="muted">${t('Buka kota ini di game supaya layout & produksinya terbaca.')}</span>`;
    if (f.netNow < 0) return `<span style="color:var(--bad)">⚠️ ${t('Sekarang minus — kirim makanan atau kirim pasukan raid/support.')}</span>`;
    if (f.netAll != null && f.netAll < 0) return `<span style="color:var(--warn)">${t('Minus saat semua pasukan pulang ({n}/jam).', { n: sNum(f.netAll) })}</span>`;
    if (f.netFull != null && f.netFull < 0) return `<span style="color:var(--warn)">${t('Minus kalau TS diisi penuh — butuh {n}/jam lagi (Farm/Mill, riset makanan, atau kiriman).', { n: fmtNum(-f.netFull) })}</span>`;
    return `<span style="color:var(--good)">✓ ${t('Aman')}</span>`;
  };
  return `<div class="card cs-note small">${t('Hanya pasukan yang ada <b>di kota</b> yang makan — pasukan yang sedang raid, menyerang atau support tidak makan sampai pulang. Makanan pasukan dihitung per hari di game (Berserker 6, Knight 25, War Galleon 2.500 …) dan di sini dibagi 24 per jam. Produksi = Farm dari layout game × riset makanan{r}. Kalau makanan habis saat produksi minus, sebagian pasukan kabur.', { r: fr != null ? ` (+${fr}%)` : '' })}</div>
    <div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Kota')}</th><th class="num">${t('Produksi makanan')}</th><th class="num">${t('Makan (di kota)')}</th><th class="num">${t('Bersih sekarang')}</th><th class="num">${t('Stok')}</th><th class="num" title="${t('Pasukan di kota + yang sedang di luar + antrian latihan')}">${t('Semua pulang')}</th><th class="num" title="${t('TS penuh dengan komposisi pasukan sekarang')}">${t('TS penuh')}</th><th>${t('Saran')}</th></tr></thead><tbody>
    ${rows.map((f) => `<tr>
      <td><b>${esc(f.name)}</b> <a href="#" class="small muted" data-copy="${f.key}">${f.key}</a></td>
      <td class="num">${f.gross == null ? '—' : fmtNum(f.gross)}${f.source === 'game' ? ' <span class="small muted" title="' + t('Dari produksi bersih di game + makan pasukan di kota') + '">≈</span>' : ''}</td>
      <td class="num">${f.eatHome ? '−' + fmtNum(f.eatHome) : '0'}</td>
      ${netCell(f.netNow, f.emptyAt, now)}
      <td class="num">${f.stock == null ? '—' : fmtNum(f.stock)}</td>
      ${netCell(f.netAll, f.emptyAtAll, now)}
      ${netCell(f.netFull, null, now)}
      <td class="small">${advice(f)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// production/h cell (≈ = computed from the synced layout by "Refresh all cities")
function rateCell(x) {
  if (!x || x.rate == null) return '<td class="r num muted rate-col">—</td>';
  const calc = x.calcAt ? ` <span class="muted small" title="${t('Dihitung dari layout game + riset (Refresh semua kota)')}">≈</span>` : '';
  return `<td class="r num rate-col" style="color:${x.rate < 0 ? 'var(--bad)' : 'inherit'}">${x.rate >= 0 ? '+' : ''}${fmtNum(x.rate)}${calc}</td>`;
}

// 🔄 ask the open game tab(s) for a fresh snapshot of every city, then recompute rates & capacity from the layouts
async function refreshAll() {
  const btn = root.querySelector('#c-refresh');
  btn.disabled = true;
  let tabs = 0;
  try {
    const list = await chrome.tabs.query({ url: 'https://lordofultima.me/*' });
    for (const tb of list) { try { await chrome.tabs.sendMessage(tb.id, { type: 'lou-refresh' }); tabs++; } catch { /* old content script: needs F5 */ } }
  } catch { /* tabs API unavailable */ }
  if (tabs) await new Promise((r) => setTimeout(r, 2500)); // let the snapshot arrive
  const fresh = await chrome.storage.local.get(['cities', 'layouts', 'movements']);
  const st = { ...ctx.state, cities: fresh.cities || ctx.state.cities, layouts: fresh.layouts || ctx.state.layouts, movements: fresh.movements || ctx.state.movements };
  const patch = refreshAllRates(st);
  const n = Object.keys(patch).length;
  if (n) await ctx.save({ cities: { ...st.cities, ...patch } });
  btn.disabled = false;
  render(ctx.state);
  ctx.toast(tabs
    ? t('Diperbarui dari game · produksi/jam {n} kota dihitung ulang dari layout', { n })
    : t('Tab game tidak terbuka (atau perlu F5) · produksi/jam {n} kota dihitung ulang dari layout', { n }));
}
