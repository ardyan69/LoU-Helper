// "🎯 Operasi" — 🗡️ coordinated attack planner and 🛡️ defense assistant, from the troops read from the game.
// Read-only like the rest of the extension: it only calculates; you send the armies yourself in the game.
import { esc, fmtNum, unitName } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { unitById } from '../lib/cheatsheet.js';
import { parseCoord, continentOf } from '../lib/travel.js';
import { planAttack, defenseOptions, ownCities } from '../lib/ops.js';
import { TYPES } from '../lib/battle.js';
import { fmtT } from './cs-buildings.js';

let root, ctx, timer = null;
const os = { tab: 'atk', target: '', mode: 'asap', at: '', gap: 1, ready: 2, rows: {}, inc: '', simKey: '', simMin: 30 };
try { Object.assign(os, JSON.parse(localStorage.getItem('lou-ops') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-ops', JSON.stringify(os)); } catch {} };
const ORDERS = ['assault', 'siege', 'plunder', 'scout', 'support'];
const ORDER_N = { assault: '🗡️ Assault', siege: '🏹 Siege', plunder: '💰 Plunder', scout: '👁️ Scout', support: '🛡️ Support' };
const TYPE_N = { infantry: '🗡️ Infantry', cavalry: '🐎 Cavalry', magic: '🔮 Magic', artillery: '🪨 Artillery' };
const num = (n) => Math.round(n).toLocaleString(locale());

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow">
        <h2>${t('Operasi militer')}</h2>
        <p>${t('Hitung jam kirim pasukan supaya serangan tiba bersamaan, dan cari kota yang masih sempat mengirim bantuan saat ada serangan masuk. Extension hanya menghitung — pengiriman tetap kamu lakukan di game.')}</p>
      </div>
      <div class="seg" id="o-tab">
        <button data-otab="atk">🗡️ ${t('Perencana serangan')}</button>
        <button data-otab="def">🛡️ ${t('Asisten bertahan')}</button>
      </div>
    </div>
    <div id="o-body"></div>`;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
}

export function render() {
  if (!root) return;
  try { const pre = sessionStorage.getItem('lou-ops-inc'); if (pre) { os.tab = 'def'; os.inc = pre; sessionStorage.removeItem('lou-ops-inc'); persist(); } } catch {}
  draw();
  clearInterval(timer);
  timer = setInterval(() => {
    if (!root.classList.contains('on')) return clearInterval(timer);
    tick();
  }, 1000);
}
export function onData(state, keys) {
  if (!root?.classList.contains('on')) return;
  if (!keys.some((k) => ['movements', 'cities', 'settings', 'speedCal', 'attackLog'].includes(k))) return;
  if (root.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return; // don't disturb typing
  draw();
}

// ---------- helpers ----------
const now = () => Date.now();
function cd(ms) {
  if (ms == null || !isFinite(ms)) return '—';
  const neg = ms < 0, s = Math.floor(Math.abs(ms) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const v = h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
  return neg ? `−${v}` : v;
}
function clock(ts, sec = true) {
  if (!ts) return '—';
  const d = new Date(ts);
  const tm = d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', ...(sec ? { second: '2-digit' } : {}) });
  return new Date().toDateString() === d.toDateString() ? tm : d.toLocaleDateString(locale(), { weekday: 'short', day: 'numeric' }) + ' ' + tm;
}
const cdSpan = (ts, cls = '') => `<span class="num ${cls}" data-cd="${ts}">${cd(ts - now())}</span>`;
function tick() {
  root.querySelectorAll('[data-cd]').forEach((el) => {
    const ts = +el.dataset.cd, left = ts - now();
    el.textContent = cd(left);
    if (el.dataset.late !== undefined) el.classList.toggle('bad-t', left < 0);
  });
}
const pills = (u) => Object.entries(u || {}).filter(([, n]) => n > 0).map(([id, n]) => `<span class="pill">${fmtNum(n)}× ${esc(unitById(id)?.name || unitName(id))}</span>`).join(' ') || '<span class="muted">—</span>';
const reasonTxt = (r) => ({
  continent: t('beda benua — butuh Frigate'), frigate: t('Frigate kurang ({n} × 500 TS)'), immobile: t('ada unit yang tidak bisa berangkat (City Guard)'), empty: t('belum ada pasukan')
}[r.reason] || r.reason).replace('{n}', r.need ?? '?');
const knownCities = (state) => Object.values(state.players || {}).flatMap((x) => Object.values(x.cities || {}).map((c) => ({ ...c, key: c.key || `${c.x}:${c.y}`, owner: x.name, tag: x.tag })));
function targetInfo(state, p) {
  if (!p) return '';
  const key = `${p.x}:${p.y}`;
  const own = state.cities?.[key];
  const pl = knownCities(state).find((c) => c.key === key);
  const who = own ? `🏰 ${esc(own.name)} (${t('kotamu')})` : pl ? `${esc(pl.name || t('Kota'))} — <b>${esc(pl.tag ? `[${pl.tag}] ` : '')}${esc(pl.owner || '')}</b>` : t('kota tidak dikenal');
  return `${who} · C${String(continentOf(p.x, p.y)).padStart(2, '0')}`;
}

function onChange(e) {
  const el = e.target;
  const k = el.dataset.o;
  if (k) {
    os[k] = el.type === 'number' ? +el.value || 0 : el.value;
    persist();
    if (k !== 'at' || os.mode === 'at') draw();
    return;
  }
  const rk = el.dataset.row;
  if (rk) {
    const r = (os.rows[rk] = os.rows[rk] || { on: false, wave: 1, order: 'assault', units: {} });
    const f = el.dataset.f;
    if (f === 'on') {
      r.on = el.checked;
      if (r.on && !Object.values(r.units).some((n) => n > 0)) {
        const c = ownCities(ctx.state).find((x) => x.key === rk);
        r.units = Object.fromEntries(Object.entries(c?.home || {}).filter(([id, n]) => n > 0 && unitById(id)?.spd > 0));
      }
    } else if (f === 'wave') r.wave = Math.max(1, +el.value || 1);
    else if (f === 'order') r.order = el.value;
    else if (f === 'unit') r.units[el.dataset.u] = Math.max(0, +el.value || 0);
    persist();
    draw();
  }
}
function onClick(e) {
  const tab = e.target.closest('[data-otab]');
  if (tab) { os.tab = tab.dataset.otab; persist(); draw(); return; }
  const md = e.target.closest('[data-mode]');
  if (md) { os.mode = md.dataset.mode; persist(); draw(); return; }
  const inc = e.target.closest('[data-inc]');
  if (inc) { os.inc = inc.dataset.inc; persist(); draw(); return; }
  const all = e.target.closest('[data-allin]');
  if (all) {
    const c = ownCities(ctx.state).find((x) => x.key === all.dataset.allin);
    const r = (os.rows[c.key] = os.rows[c.key] || { on: true, wave: 1, order: 'assault', units: {} });
    r.on = true;
    r.units = Object.fromEntries(Object.entries(c?.home || {}).filter(([id, n]) => n > 0 && unitById(id)?.spd > 0));
    persist(); draw(); return;
  }
  if (e.target.closest('[data-act=clear]')) { os.rows = {}; persist(); draw(); return; }
  if (e.target.closest('[data-act=copy]')) { navigator.clipboard.writeText(root.querySelector('#o-text')?.value || ''); ctx.toast(t('Rencana disalin')); return; }
  const cp = e.target.closest('[data-copy]');
  if (cp) { e.preventDefault(); navigator.clipboard.writeText(cp.dataset.copy); ctx.toast(t('Koordinat disalin: {c}', { c: cp.dataset.copy })); }
}

function draw() {
  root.querySelectorAll('#o-tab [data-otab]').forEach((b) => b.classList.toggle('on', b.dataset.otab === os.tab));
  const body = root.querySelector('#o-body');
  const st = ctx.state;
  if (!st.movements) {
    body.innerHTML = `<div class="empty">${t('<b>Belum ada data pasukan.</b><br>Buka <a href="https://lordofultima.me/" target="_blank">lordofultima.me</a> — pasukan tiap kota terbaca otomatis dalam beberapa detik.')}</div>`;
    return;
  }
  body.innerHTML = os.tab === 'def' ? drawDefense(st) : drawAttack(st);
  tick();
}

// ---------- 🗡️ attack planner ----------
function drawAttack(st) {
  const target = parseCoord(os.target);
  const cities = ownCities(st).filter((c) => Object.values(c.home || {}).some((n) => n > 0)).sort((a, b) => (target ? Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y) : String(a.name).localeCompare(String(b.name), locale(), { numeric: true })));
  const atMs = os.mode === 'at' && os.at ? new Date(os.at).getTime() : null;
  const rows = cities.filter((c) => os.rows[c.key]?.on).map((c) => ({ key: c.key, name: c.name, castle: c.castle, from: c, units: os.rows[c.key].units, wave: os.rows[c.key].wave, order: os.rows[c.key].order }));
  const plan = target && rows.length ? planAttack(rows, { state: st, target, arriveAt: atMs, gap: os.gap, ready: os.ready * 60000 }) : null;
  const cityRow = (c) => {
    const r = os.rows[c.key] || { on: false, wave: 1, order: 'assault', units: {} };
    const units = Object.entries(c.home || {}).filter(([id, n]) => n > 0 && unitById(id)?.spd > 0);
    const d = target ? Math.hypot(c.x - target.x, c.y - target.y) : null;
    const cross = target && continentOf(c.x, c.y) !== continentOf(target.x, target.y);
    return `<tr class="${r.on ? '' : 'muted'}">
      <td><label class="check"><input type="checkbox" data-row="${c.key}" data-f="on" ${r.on ? 'checked' : ''}> <b>${esc(c.name)}</b></label> <a href="#" class="small muted" data-copy="${c.key}">${c.key}</a>${c.castle ? ' 🏰' : ''}</td>
      <td class="num small">${d == null ? '—' : num(d)}${cross ? ` <span class="pill warn" title="${t('Beda benua: pasukan darat butuh Frigate (500 TS per Frigate)')}">⛵</span>` : ''}</td>
      <td><select data-row="${c.key}" data-f="order">${ORDERS.map((o) => `<option value="${o}" ${r.order === o ? 'selected' : ''}>${ORDER_N[o]}</option>`).join('')}</select></td>
      <td><input type="number" min="1" max="20" data-row="${c.key}" data-f="wave" value="${r.wave}" style="width:56px"></td>
      <td><div class="ounits">${units.map(([id, n]) => `<label class="small" title="${t('di kota: {n}', { n: fmtNum(n) })}">${esc(unitById(id).name)}<input type="number" min="0" max="${n}" data-row="${c.key}" data-f="unit" data-u="${id}" value="${r.units?.[id] ?? 0}"><span class="muted">/${fmtNum(n)}</span></label>`).join('')}
        <button class="btn sm" data-allin="${c.key}">${t('semua')}</button></div></td></tr>`;
  };
  const res = plan ? plan.rows.slice().sort((a, b) => (a.sendAt ?? Infinity) - (b.sendAt ?? Infinity)) : [];
  const needCastle = (r) => !['scout', 'support'].includes(r.order) && !r.castle && !st.cities?.[`${target?.x}:${target?.y}`];
  const text = plan ? [`${t('Target')} ${target.x}:${target.y} · ${t('tiba')} ${clock(plan.first)}${os.gap ? ` · ${t('jeda gelombang {s} dtk', { s: os.gap })}` : ''}`,
    ...res.map((r) => r.travel.ok ? `${clock(r.sendAt)} ${t('kirim')} ${r.name} → ${r.order} [${t('gel.')} ${r.wave}] ${Object.entries(r.units).filter(([, n]) => n > 0).map(([id, n]) => `${n} ${unitById(id).name}`).join(', ')} (${fmtT(r.travel.ms / 1000)}) → ${clock(r.arriveAt)}` : `✗ ${r.name}: ${reasonTxt(r.travel)}`)].join('\n') : '';
  return `
    <div class="card">
      <div class="ogrid">
        <label class="field">${t('Target (koordinat x:y)')}<input type="text" data-o="target" value="${esc(os.target)}" placeholder="312:245" list="o-targets"><datalist id="o-targets">${knownCities(st).slice(0, 400).map((c) => `<option value="${c.key}">${esc(c.tag ? `[${c.tag}] ` : '')}${esc(c.owner)} — ${esc(c.name || '')}</option>`).join('')}</datalist><span class="small muted">${target ? targetInfo(st, target) : t('Tempel koordinat dari game.')}</span></label>
        <div class="ofield">${t('Waktu tiba')}
          <div class="seg"><button data-mode="asap" class="${os.mode === 'asap' ? 'on' : ''}">⚡ ${t('Secepatnya')}</button><button data-mode="at" class="${os.mode === 'at' ? 'on' : ''}">🕐 ${t('Pada jam')}</button></div>
          ${os.mode === 'at' ? `<input type="datetime-local" step="1" data-o="at" value="${esc(os.at)}"><span class="small muted">${t('Jam komputermu (tanggal & jam:menit:detik).')}</span>` : `<span class="row" style="gap:6px">${t('Waktu siap-siap')} <input type="number" min="0" max="120" data-o="ready" value="${os.ready}"> ${t('menit')}</span>`}
        </div>
        <label class="field">${t('Jeda antar gelombang (detik)')}<input type="number" min="0" max="3600" data-o="gap" value="${os.gap}"><span class="small muted">${t('Gelombang 1 tiba dulu (mis. pembersih), gelombang 2 sekian detik kemudian (mis. Baron / siege).')}</span></label>
      </div>
    </div>
    <div class="card">
      <div class="row"><h3 class="grow">${t('Kota & pasukan')}</h3><button class="btn sm" data-act="clear">${t('Kosongkan pilihan')}</button></div>
      ${cities.length ? `<div class="tbl-wrap"><table class="cs-tbl ops"><thead><tr><th>${t('Kota')}</th><th class="num">${t('Jarak')}</th><th>${t('Misi')}</th><th>${t('Gel.')}</th><th>${t('Pasukan dikirim')}</th></tr></thead><tbody>${cities.map(cityRow).join('')}</tbody></table></div>`
        : `<div class="small muted">${t('Belum ada kota dengan pasukan di rumah.')}</div>`}
    </div>
    ${plan ? `<div class="card">
      <div class="row"><h3 class="grow">📋 ${t('Jadwal kirim')}</h3><span class="small muted">${t('Tiba gelombang 1')}: <b>${clock(plan.first)}</b> (${cdSpan(plan.first)})</span><button class="btn sm primary" data-act="copy">📋 ${t('Salin')}</button></div>
      ${res.some((r) => r.late) ? `<div class="banner" style="margin:8px 0">⚠️ ${t('Ada kota yang sudah terlambat untuk jam tiba ini. Paling cepat semua bisa tiba {c}.', { c: `<b>${clock(plan.earliest)}</b>` })}</div>` : ''}
      <div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Kirim jam')}</th><th class="num">${t('Dalam')}</th><th>${t('Kota')}</th><th>${t('Misi')}</th><th>${t('Pasukan')}</th><th class="num">${t('Perjalanan')}</th><th>${t('Tiba')}</th></tr></thead><tbody>
      ${res.map((r) => r.travel.ok ? `<tr class="${r.late ? 'late' : ''}">
        <td><b>${clock(r.sendAt)}</b></td><td class="num">${cdSpan(r.sendAt)}</td>
        <td>${esc(r.name)}${needCastle(r) ? ` <span class="pill warn" title="${t('Menyerang kota pemain lain butuh Castle di kota pengirim')}">🏰?</span>` : ''}</td>
        <td>${ORDER_N[r.order] || r.order} <span class="small muted">${t('gel.')} ${r.wave}</span></td><td>${pills(r.units)}</td>
        <td class="num">${fmtT(r.travel.ms / 1000)}<div class="small muted">${t('{u} · {m} mnt/field', { u: esc(unitById(r.travel.slow)?.name || ''), m: r.travel.mpf.toFixed(1) })}</div></td>
        <td>${clock(r.arriveAt)}</td></tr>`
        : `<tr class="muted"><td colspan="2">✗</td><td>${esc(r.name)}</td><td>${ORDER_N[r.order] || r.order}</td><td>${pills(r.units)}</td><td colspan="2" class="small" style="color:var(--bad)">${reasonTxt(r.travel)}</td></tr>`).join('')}
      </tbody></table></div>
      <textarea id="o-text" class="share" readonly style="margin-top:8px">${esc(text)}</textarea>
      <div class="small muted">${t('Waktu memakai jam komputermu. Kecepatan unit dari Pengaturan → Unit (dikalibrasi otomatis dari pergerakan pasukanmu). Pasukan bergerak secepat unit paling lambat; pasukan dengan kapal bergerak secepat kapal.')}</div>
    </div>` : target ? '' : `<div class="card small muted">${t('Isi koordinat target dan centang kota yang ikut menyerang.')}</div>`}`;
}

// ---------- 🛡️ defense assistant ----------
function drawDefense(st) {
  const mv = st.movements;
  const off = mv.serverOffset || 0;
  const cities = ownCities(st);
  const incs = (mv.incoming || []).filter((a) => a.arriveAt && a.arriveAt - off > now() - 60000).sort((a, b) => a.arriveAt - b.arriveAt);
  // simulation when nothing is incoming (or to plan ahead)
  const simC = cities.find((c) => c.key === os.simKey) || cities[0];
  const sim = simC ? { id: 'sim', toX: simC.x, toY: simC.y, arriveAt: now() + off + os.simMin * 60000, order: 'assault', owner: null, units: null, target: { name: simC.name }, sim: true } : null;
  const list = [...incs, ...(sim ? [sim] : [])];
  const sel = list.find((a) => String(a.id) === String(os.inc)) || list[0];
  const tabs = list.map((a) => `<button class="inc ${a === sel ? 'on' : ''}" data-inc="${esc(String(a.id))}">
      ${a.sim ? `🧪 ${t('Simulasi')}` : `⚠️ ${esc(a.owner || '?')}`} → <b>${esc(a.target?.name || `${a.toX}:${a.toY}`)}</b> <span class="small">${a.sim ? `${os.simMin} ${t('menit')}` : cdSpan(a.arriveAt - off, 'bad-t')}</span></button>`).join('');
  if (!sel) return `<div class="card small muted">${t('Belum ada kota yang terbaca.')}</div>`;
  const d = defenseOptions(st, sel, now(), st.attackLog || []);
  const est = d.estimate;
  const verdict = (b) => (b.win ? `<b style="color:var(--bad)">${t('kemungkinan KALAH')}</b>` : `<b style="color:var(--good)">${t('kemungkinan BERTAHAN')}</b>`) + ` <span class="small muted">(${t('serang {a} vs bertahan {d}', { a: fmtNum(b.x), d: fmtNum(b.w) })})</span>`;
  const attTypes = est ? TYPES.filter((ty) => Object.entries(est.att).some(([id, n]) => n > 0 && unitById(id)?.type === ty)) : [];
  const bestDef = (ty) => {
    const i = TYPES.indexOf(ty);
    const mine = new Set(cities.flatMap((c) => Object.keys(c.home || {})));
    return [...mine].map(unitById).filter((u) => u && u.spd > 0 && !u.naval && !['baron', 'scout'].includes(u.id)).sort((a, b) => b.def[i] / Math.max(1, b.space) - a.def[i] / Math.max(1, a.space)).slice(0, 3);
  };
  const homeDef = TYPES.map((ty, i) => [ty, Object.entries(d.home).reduce((s, [id, n]) => s + n * (unitById(id)?.def[i] || 0), 0)]);
  return `
    <div class="card">
      <div class="inc-tabs">${tabs}</div>
      ${sel.sim ? `<div class="row small" style="gap:8px;margin-top:8px">${t('Simulasi serangan ke')} <select data-o="simKey">${cities.map((c) => `<option value="${c.key}" ${c === simC ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select> ${t('tiba dalam')} <input type="number" min="1" max="2880" data-o="simMin" value="${os.simMin}" style="width:80px"> ${t('menit')}</div>` : ''}
    </div>
    <div class="cs-res">
      <div><span class="muted">${t('Kota diserang')}</span><b>${esc(d.targetName || `${d.target.x}:${d.target.y}`)}</b><span class="small muted">${d.target.x}:${d.target.y}</span></div>
      <div><span class="muted">${t('Tiba')}</span><b>${clock(d.arriveAt)}</b><span class="small">${cdSpan(d.arriveAt, 'bad-t')}</span></div>
      <div><span class="muted">${t('Pasukan di kota')}</span><b class="small">${pills(d.home)}</b></div>
      <div><span class="muted">${t('Bantuan yang sempat tiba')}</span><b class="small">${pills(d.reach)}</b></div>
    </div>
    <div class="card">
      <h3>⚔️ ${t('Perkiraan pertempuran')}</h3>
      ${est ? `<div class="small muted" style="margin-bottom:6px">${est.attFrom === 'visible' ? t('Pasukan penyerang terlihat:') : t('Pasukan penyerang tidak terlihat — dipakai serangan terbesar {p} sebelumnya:', { p: esc(sel.owner || '') })} ${pills(est.att)}</div>
        <div class="kv"><span>${t('Hanya pasukan di kota')}</span><span>${verdict(est.homeOnly)}</span></div>
        <div class="kv"><span>${t('Dengan semua bantuan yang sempat')}</span><span>${verdict(est.withSupport)}</span></div>
        ${attTypes.length ? `<div class="small" style="margin-top:6px">${t('Bertahan terbaik melawan')} ${attTypes.map((ty) => `${TYPE_N[ty]}: ${bestDef(ty).map((u) => esc(u.name)).join(', ') || '—'}`).join(' · ')}</div>` : ''}
        <div class="small muted" style="margin-top:4px">${t('Perkiraan dengan aturan pertempuran game: tembok, menara & jebakan kota, riset militermu. Riset/artefak penyerang tidak diketahui (dianggap 0).')}</div>`
        : `<div class="small muted">${sel.sim ? t('Simulasi: pilih kota & waktu untuk melihat siapa yang sempat membantu.') : t('Pasukan penyerang tidak terlihat dan belum ada riwayat dari pemain ini — kirim Scout untuk melihatnya.')}</div>
          <div class="small" style="margin-top:6px">${t('Kekuatan bertahan di kota')}: ${homeDef.map(([ty, v]) => `${TYPE_N[ty]} ${fmtNum(v)}`).join(' · ')}</div>`}
    </div>
    <div class="card">
      <h3>🛡️ ${t('Kota yang bisa membantu')}</h3>
      ${d.options.length ? `<div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Kota')}</th><th class="num">${t('Jarak')}</th><th>${t('Unit')}</th><th class="num">${t('Perjalanan')}</th><th>${t('Kirim sebelum')}</th><th class="num">${t('Sisa waktu')}</th></tr></thead><tbody>
        ${d.options.map((o) => o.units.map((u, i) => `<tr class="${u.ok ? '' : 'muted'}">
          ${i === 0 ? `<td rowspan="${o.units.length}"><b>${esc(o.name)}</b> <a href="#" class="small muted" data-copy="${o.key}">${o.key}</a></td><td rowspan="${o.units.length}" class="num small">${num(o.dist)}</td>` : ''}
          <td>${fmtNum(u.n)}× ${esc(unitById(u.id).name)}${u.frigates ? ` <span class="small muted" title="${t('Naik {f} Frigate (500 TS per Frigate)', { f: fmtNum(u.frigates) })}">⛵${u.n < u.of ? ` ${t('dari {n}', { n: fmtNum(u.of) })}` : ''}</span>` : ''}</td>
          <td class="num">${u.ms != null ? fmtT(u.ms / 1000) : ''}</td>
          <td>${u.reason ? `<span class="small" style="color:var(--bad)">${reasonTxt(u)}</span>` : u.ok ? `<b>${clock(u.sendBy)}</b>` : `<span class="small" style="color:var(--bad)">${t('tidak sempat (telat {t})', { t: fmtT(u.lateBy / 1000) })}</span>`}</td>
          <td class="num">${u.sendBy && u.ok ? cdSpan(u.sendBy) : ''}</td></tr>`).join('')).join('')}
      </tbody></table></div>
      <div class="small muted" style="margin-top:6px">${t('Pasukan support tidak makan selama di luar kota. Kirim dengan misi Support di game; unit cepat (Crossbowman, Paladin) paling sering sempat.')}</div>`
        : `<div class="small muted">${t('Tidak ada kota lain dengan pasukan di rumah.')}</div>`}
    </div>`;
}
