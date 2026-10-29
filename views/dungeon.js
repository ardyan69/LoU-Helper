import { fmtNum, fmtDur, fmtAgo, dist, esc, uid } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import * as planner from './raidplan.js';

const TYPES = ['Forest', 'Hill', 'Mountain', 'Sea'];
const TYPE_ID = { Forest: 'Forest', Hill: 'Hill', Mountain: 'Mountain', Sea: 'Sea' }; // game names (English)
const TYPE_ICON = { Forest: '🌲', Hill: '⛰️', Mountain: '🏔️', Sea: '🌊' };

let root, ctx, selKey = null, part = 'list';
try { part = localStorage.getItem('lou-dg-part') || 'list'; } catch {}
const f = { type: 'all', minL: 1, maxL: 10, from: 'nearest', maxD: 0, maxExp: 100, q: '', sort: 'dist', dir: 1 };

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow">
        <h2>${t('Dungeon &amp; Boss')}</h2>
        <p>${t('Semua dungeon/boss yang dimuat peta Region game otomatis tersimpan di sini (level, explored %). Guardians &amp; max loot terisi saat panelnya dibuka.')}</p>
      </div>
      <div class="seg" id="d-seg">
        <button data-part="list">📋 ${t('Daftar')}</button>
        <button data-part="plan">🎯 Raid Planner</button>
      </div>
      <button class="btn" id="d-add">+ ${t('Tambah manual')}</button>
    </div>
    <div id="d-plan"></div>
    <div id="d-list">
    <div class="toolbar card">
      <label class="field">${t('Tipe')}
        <select id="f-type"><option value="all">${t('Semua')}</option>${TYPES.map((ty) => `<option value="${ty}">${TYPE_ICON[ty]} ${TYPE_ID[ty]}</option>`).join('')}<option value="boss">👹 Boss</option></select></label>
      <label class="field">${t('Level min')}<input type="number" id="f-minL" min="1" max="10" value="1"></label>
      <label class="field">${t('Level max')}<input type="number" id="f-maxL" min="1" max="10" value="10"></label>
      <label class="field">${t('Jarak dari')}<select id="f-from"></select></label>
      <label class="field">${t('Jarak maks (0 = bebas)')}<input type="number" id="f-maxD" min="0" value="0"></label>
      <label class="field">${t('Explored maks %')}<input type="number" id="f-maxExp" min="0" max="100" value="100"></label>
      <label class="field grow">${t('Cari')}<input type="text" id="f-q" placeholder="${t('koordinat / weak to / catatan')}"></label>
    </div>
    <div class="two-col">
      <div class="table-wrap" id="d-table"></div>
      <div class="col" style="display:flex;flex-direction:column;gap:14px">
        <div class="card" id="d-calc"></div>
        <div class="card" id="d-stats"></div>
      </div>
    </div>
    </div>
    <dialog id="d-dlg"><form method="dialog" id="d-form">
      <h3>${t('Tambah / ubah dungeon')}</h3>
      <div class="grid2">
        <label class="field">${t('Jenis')}<select name="kind"><option value="dungeon">Dungeon</option><option value="boss">Boss</option></select></label>
        <label class="field">${t('Tipe / nama boss')}<input type="text" name="type" placeholder="Forest / Hill / Mountain / Sea / Dragon…" required></label>
        <label class="field">${t('Koordinat (x:y)')}<input type="text" name="coord" placeholder="222:233" required pattern="\\d+:\\d+"></label>
        <label class="field">Level<input type="number" name="level" min="1" max="10" value="1" required></label>
        <label class="field">Explored %<input type="number" name="explored" min="0" max="100" value="0"></label>
        <label class="field">Guardians<input type="number" name="guardians" min="0"></label>
        <label class="field">Max loot<input type="number" name="maxLoot" min="0"></label>
        <label class="field">Weak to<input type="text" name="weakTo"></label>
      </div>
      <label class="field">${t('Catatan')}<input type="text" name="note"></label>
      <div class="row"><span class="grow"></span><button class="btn" value="cancel" formnovalidate>${t('Batal')}</button><button class="btn primary" value="ok">${t('Simpan')}</button></div>
    </form></dialog>`;

  for (const id of ['type', 'minL', 'maxL', 'from', 'maxD', 'maxExp', 'q']) {
    root.querySelector('#f-' + id).addEventListener('input', (e) => {
      f[id] = e.target.type === 'number' ? +e.target.value : e.target.value;
      renderTable();
    });
  }
  root.querySelector('#d-add').onclick = () => openDialog(null);
  planner.mount(root.querySelector('#d-plan'), ctx);
  root.querySelector('#d-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-part]');
    if (!b) return;
    part = b.dataset.part;
    try { localStorage.setItem('lou-dg-part', part); } catch {}
    showPart();
  });
  root.querySelector('#d-dlg').addEventListener('close', saveDialog);

  root.querySelector('#d-table').addEventListener('click', async (e) => {
    const th = e.target.closest('th[data-sort]');
    if (th) { f.dir = f.sort === th.dataset.sort ? -f.dir : 1; f.sort = th.dataset.sort; renderTable(); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) { e.stopPropagation(); navigator.clipboard.writeText(cp.dataset.copy); ctx.toast('Koordinat disalin: ' + cp.dataset.copy); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { e.stopPropagation(); openDialog(ctx.state.dungeons[ed.dataset.edit]); return; }
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      const dungeons = { ...ctx.state.dungeons };
      delete dungeons[del.dataset.del];
      await ctx.save({ dungeons });
      renderTable();
      return;
    }
    const tr = e.target.closest('tr[data-key]');
    if (tr) { selKey = tr.dataset.key; renderTable(); renderCalc(); }
  });

  root.querySelector('#d-calc').addEventListener('input', renderCalcOut);
  root.querySelector('#d-calc').addEventListener('click', async (e) => {
    if (e.target.id === 'c-calib') calibrate();
    if (e.target.id === 'c-log') logRaid();
  });
  root.querySelector('#d-stats').addEventListener('click', async (e) => {
    if (e.target.id === 's-clear' && confirm(t('Hapus semua catatan raid?'))) { await ctx.save({ raids: [] }); renderStats(); }
  });
}

function showPart() {
  root.querySelectorAll('#d-seg [data-part]').forEach((b) => b.classList.toggle('on', b.dataset.part === part));
  root.querySelector('#d-list').classList.toggle('hide', part !== 'list');
  root.querySelector('#d-plan').classList.toggle('hide', part !== 'plan');
  root.querySelector('#d-add').classList.toggle('hide', part !== 'list');
  if (part === 'plan') planner.render();
}

export function render(state) {
  showPart();
  const from = root.querySelector('#f-from');
  const cities = Object.values(state.cities).sort((a, b) => String(a.name).localeCompare(String(b.name), 'id', { numeric: true }));
  from.innerHTML = `<option value="nearest">${t('Kota terdekat (otomatis)')}</option>` +
    cities.map((c) => `<option value="${c.key}" ${f.from === c.key ? 'selected' : ''}>${esc(c.name)} (${c.key})</option>`).join('');
  if (f.from !== 'nearest' && !state.cities[f.from]) f.from = 'nearest';
  from.value = f.from;
  renderTable();
  renderCalc();
  renderStats();
}
export function onData(state, keys) {
  if (!root.classList.contains('on')) return;
  if (part === 'plan') { if (keys.some((k) => ['dungeons', 'cities', 'movements', 'settings'].includes(k))) planner.render(); return; }
  if (keys.includes('dungeons') || keys.includes('cities')) { renderTable(); if (keys.includes('dungeons')) renderCalcHead(); }
  if (keys.includes('raids')) renderStats();
  if (keys.includes('settings')) renderCalc();
}

function nearest(d) {
  const cities = Object.values(ctx.state.cities).filter((c) => c.x != null && (c.cont == null || d.cont == null || c.cont === d.cont));
  const pool = cities.length ? cities : Object.values(ctx.state.cities);
  if (f.from !== 'nearest' && ctx.state.cities[f.from]) {
    const c = ctx.state.cities[f.from];
    return { city: c, d: dist(c, d) };
  }
  let best = null;
  for (const c of pool) { const dd = dist(c, d); if (!best || dd < best.d) best = { city: c, d: dd }; }
  return best;
}

function rows() {
  const q = f.q.trim().toLowerCase();
  return Object.values(ctx.state.dungeons).map((d) => ({ d, n: nearest(d) })).filter(({ d, n }) => {
    if (f.type === 'boss' ? d.kind !== 'boss' : f.type !== 'all' && d.type !== f.type) return false;
    if (d.level < f.minL || d.level > f.maxL) return false;
    if (f.maxD > 0 && n && n.d > f.maxD) return false;
    if ((d.explored ?? 0) > f.maxExp) return false;
    if (q && !`${d.key} ${d.type} ${d.weakTo} ${d.note || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderTable() {
  const list = rows();
  const key = {
    dist: (r) => r.n?.d ?? 1e9, level: (r) => r.d.level, explored: (r) => r.d.explored ?? 0,
    loot: (r) => r.d.maxLoot ?? 0, guardians: (r) => r.d.guardians ?? 0, seen: (r) => -(r.d.seenAt || 0), type: (r) => r.d.type
  }[f.sort];
  list.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : 0) * f.dir; });
  const el = root.querySelector('#d-table');
  if (!Object.keys(ctx.state.dungeons).length) {
    el.innerHTML = `<div class="empty">${t('<b>Belum ada dungeon.</b><br>Di game buka tab <b>Region</b>; dungeon &amp; boss di peta tersimpan otomatis. Klik ikonnya untuk guardians &amp; max loot.')}</div>`;
    return;
  }
  const arrow = (k) => (f.sort === k ? (f.dir > 0 ? ' ▲' : ' ▼') : '');
  el.innerHTML = `<table>
    <thead><tr>
      <th class="sort" data-sort="type">${t('Tipe')}${arrow('type')}</th>
      <th class="sort r" data-sort="level">Lv${arrow('level')}</th>
      <th>${t('Koordinat')}</th>
      <th class="sort r" data-sort="dist">${t('Jarak')}${arrow('dist')}</th>
      <th class="sort" data-sort="explored">Explored${arrow('explored')}</th>
      <th class="sort r" data-sort="guardians">Guardians${arrow('guardians')}</th>
      <th class="sort r" data-sort="loot">Max loot${arrow('loot')}</th>
      <th>Weak to</th>
      <th class="sort" data-sort="seen">${t('Dilihat')}${arrow('seen')}</th>
      <th></th>
    </tr></thead>
    <tbody>${list.map(({ d, n }) => `
      <tr data-key="${d.key}" class="${d.key === selKey ? 'sel' : ''}" style="cursor:pointer">
        <td>${d.kind === 'boss' ? '👹' : TYPE_ICON[d.type] || '❔'} ${esc(TYPE_ID[d.type] || d.type)}${d.note ? ` <span class="muted small" title="${esc(d.note)}">📝</span>` : ''}</td>
        <td class="r num"><b>${d.level}</b></td>
        <td><a href="#" data-copy="${d.key}" title="${t('Salin')}">${d.cont != null ? 'C' + d.cont + ' · ' : ''}${d.key}</a></td>
        <td class="r num">${n ? `${n.d.toFixed(1)} <span class="muted small">${esc(n.city.name)}</span>` : '—'}</td>
        <td><span class="bar prog"><i style="width:${d.explored ?? 0}%;background:${(d.explored ?? 0) >= 75 ? 'var(--bad)' : 'var(--gold)'}"></i></span><span class="num small">${d.explored ?? '?'}%</span></td>
        <td class="r num">${fmtNum(d.guardians)}</td>
        <td class="r num">${fmtNum(d.maxLoot)}</td>
        <td>${esc(d.weakTo || '')}</td>
        <td class="small muted">${fmtAgo(d.seenAt)}</td>
        <td><button class="btn sm" data-edit="${d.key}" title="${t('Ubah')}">✎</button> <button class="btn sm danger" data-del="${d.key}" title="${t('Hapus')}">✕</button></td>
      </tr>`).join('') || `<tr><td colspan="10" class="muted" style="text-align:center;padding:20px">${t('Tidak ada dungeon yang cocok dengan filter.')}</td></tr>`}
    </tbody></table>`;
  el.querySelectorAll('a[data-copy]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
}

// ---------- calculator ----------
function renderCalc() {
  const units = ctx.state.settings.units;
  const el = root.querySelector('#d-calc');
  el.innerHTML = `
    <h3 style="font-size:16px">${t('Kalkulator raid')}</h3>
    <div id="c-head" class="small muted" style="margin:4px 0 10px"></div>
    <div class="row">
      <label class="field grow">${t('Unit')}<select id="c-unit">${units.map((u, i) => `<option value="${i}">${esc(u.name)} (${t('bawa')} ${u.carry})</option>`).join('')}</select></label>
      <label class="field">Max loot<input type="number" id="c-loot" min="0"></label>
    </div>
    <div class="row" style="margin-top:8px">
      <label class="field">${t('Jarak (field)')}<input type="number" id="c-dist" min="0" step="0.1"></label>
      <label class="field">${t('Menit / field')}<input type="number" id="c-mpf" min="0" step="0.1"></label>
    </div>
    <div class="calc-out" id="c-out"></div>
    <details style="margin-top:10px"><summary class="small">${t('Kalibrasi kecepatan unit')}</summary>
      <p class="small muted">${t('Buka panel Raid di game, pilih hanya unit ini, lalu salin angka <b>TRAVEL</b> (mis. "2h 44m").')}</p>
      <div class="row"><input type="text" id="c-travel" placeholder="2h 44m" style="width:110px"><button class="btn sm" id="c-calib">${t('Hitung &amp; simpan')}</button></div>
    </details>
    <details style="margin-top:8px"><summary class="small">${t('Catat hasil raid')}</summary>
      <div class="row" style="margin-top:6px">
        <label class="field">${t('Jumlah unit')}<input type="number" id="r-count" min="1"></label>
        <label class="field">${t('Loot didapat')}<input type="number" id="r-loot" min="0"></label>
        <label class="field">${t('Unit hilang')}<input type="number" id="r-loss" min="0" value="0"></label>
      </div>
      <button class="btn sm primary" id="c-log" style="margin-top:6px">${t('Simpan catatan')}</button>
    </details>`;
  renderCalcHead();
}

function renderCalcHead() {
  const el = root.querySelector('#c-head');
  if (!el) return;
  const d = ctx.state.dungeons[selKey];
  if (!d) { el.innerHTML = t('Pilih dungeon di tabel, atau isi angka manual.'); renderCalcOut(); return; }
  const n = nearest(d);
  el.innerHTML = `<b style="color:var(--text)">${d.kind === 'boss' ? '👹' : TYPE_ICON[d.type] || ''} ${esc(TYPE_ID[d.type] || d.type)} L${d.level}</b> ${t('di')} ${d.key} · explored ${d.explored ?? '?'}%${n ? ` · ${t('dari')} <b>${esc(n.city.name)}</b>` : ''}`;
  root.querySelector('#c-loot').value = d.maxLoot ?? '';
  root.querySelector('#c-dist').value = n ? n.d.toFixed(1) : '';
  const weak = (d.weakTo || '').toLowerCase();
  // preselect a unit that matches "weak to"
  const units = ctx.state.settings.units;
  const prefer = weak.includes('cav') ? ['knight', 'paladin'] : weak.includes('mag') ? ['mage', 'warlock'] : weak.includes('inf') ? ['berserker', 'ranger', 'templar'] : weak.includes('art') || weak.includes('siege') || d.type === 'Sea' ? ['frigate', 'sloop', 'war_galleon'] : [];
  const idx = units.findIndex((u) => prefer.includes(u.id));
  if (idx >= 0) root.querySelector('#c-unit').value = idx;
  syncMpf();
  renderCalcOut();
}

function syncMpf() {
  const u = ctx.state.settings.units[+root.querySelector('#c-unit').value];
  root.querySelector('#c-mpf').value = u?.minPerField || '';
}

function renderCalcOut(e) {
  if (e?.target?.id === 'c-unit') syncMpf();
  const out = root.querySelector('#c-out');
  if (!out) return;
  const u = ctx.state.settings.units[+root.querySelector('#c-unit').value];
  const loot = +root.querySelector('#c-loot').value || 0;
  const dd = +root.querySelector('#c-dist').value || 0;
  const mpf = +root.querySelector('#c-mpf').value || 0;
  if (!u || !loot) { out.innerHTML = `<div class="small muted">${t('Isi max loot untuk melihat hasil.')}</div>`; return; }
  const need = u.carry > 0 ? Math.ceil(loot / u.carry) : Infinity;
  const lines = [`<div class="kv"><span>${t('Unit untuk angkut semua loot')}</span><b class="num">${need === Infinity ? '—' : need.toLocaleString(locale())} ${esc(u.name)}</b></div>`];
  const d = ctx.state.dungeons[selKey];
  if (d?.guardians && u.power) {
    lines.push(`<div class="kv"><span>${t('Guardians ÷ kekuatan unit')}</span><span class="num">${Math.ceil(d.guardians / u.power).toLocaleString(locale())}</span></div>`);
    lines.push(`<div class="small muted" style="margin-top:-4px">${t('Perkiraan kasar — tombol "Enough to clear" di game lebih akurat.')}</div>`);
  }
  if (dd && mpf) {
    const oneWay = dd * mpf * 60000;
    const trip = oneWay * 2 + (ctx.state.settings.raidOverheadMin || 0) * 60000;
    lines.push(`<div class="kv"><span>${t('Waktu tempuh sekali jalan')}</span><span class="num">${fmtDur(oneWay)}</span></div>`);
    lines.push(`<div class="kv"><span>${t('Satu putaran (+{m}m persiapan/bongkar)', { m: ctx.state.settings.raidOverheadMin })}</span><span class="num">${fmtDur(trip)}</span></div>`);
    lines.push(`<div class="kv"><span>${t('Loot per jam (maks)')}</span><b class="num" style="color:var(--good)">${fmtNum(loot / (trip / 3.6e6))}</b></div>`);
  } else {
    lines.push(`<div class="small muted">${t('Isi menit/field (atau kalibrasi) untuk menghitung waktu tempuh &amp; loot per jam.')}</div>`);
  }
  const st = statsFor(d);
  if (st) lines.push(`<div class="kv"><span>${t('Riwayat ({n} raid tipe ini)', { n: st.n })}</span><span class="num">${fmtNum(st.perUnit)} loot/unit · ${t('hilang')} ${st.loss.toFixed(1)}%</span></div>`);
  out.innerHTML = lines.join('');
}

async function calibrate() {
  const ms = parseDur(root.querySelector('#c-travel').value);
  const dd = +root.querySelector('#c-dist').value;
  if (!ms || !dd) return ctx.toast(t('Isi jarak dan waktu tempuh dulu'));
  const idx = +root.querySelector('#c-unit').value;
  const units = ctx.state.settings.units.map((u, i) => (i === idx ? { ...u, minPerField: +(ms / 60000 / dd).toFixed(2) } : u));
  await ctx.save({ settings: { ...ctx.state.settings, units } });
  root.querySelector('#c-mpf').value = units[idx].minPerField;
  renderCalcOut();
  ctx.toast(t('{u}: {m} menit/field disimpan', { u: units[idx].name, m: units[idx].minPerField }));
}

async function logRaid() {
  const count = +root.querySelector('#r-count').value;
  const loot = +root.querySelector('#r-loot').value;
  const loss = +root.querySelector('#r-loss').value || 0;
  if (!count) return ctx.toast(t('Isi jumlah unit'));
  const d = ctx.state.dungeons[selKey];
  const u = ctx.state.settings.units[+root.querySelector('#c-unit').value];
  const raids = [...ctx.state.raids, {
    id: uid(), at: Date.now(), dungeon: d?.key || null, kind: d?.kind || 'dungeon', type: d?.type || '?', level: d?.level || 0,
    explored: d?.explored ?? null, unit: u?.name || '?', count, loot, loss
  }];
  await ctx.save({ raids });
  root.querySelector('#r-count').value = root.querySelector('#r-loot').value = '';
  root.querySelector('#r-loss').value = 0;
  renderStats();
  renderCalcOut();
  ctx.toast(t('Catatan raid disimpan'));
}

function statsFor(d) {
  if (!d) return null;
  const rs = ctx.state.raids.filter((r) => r.type === d.type && r.level === d.level);
  if (!rs.length) return null;
  const units = rs.reduce((a, r) => a + r.count, 0);
  return { n: rs.length, perUnit: rs.reduce((a, r) => a + r.loot, 0) / units, loss: (rs.reduce((a, r) => a + r.loss, 0) / units) * 100 };
}

function renderStats() {
  const el = root.querySelector('#d-stats');
  const raids = ctx.state.raids;
  if (!raids.length) {
    el.innerHTML = `<h3 style="font-size:16px">${t('Statistik raid')}</h3><div class="small muted" style="margin-top:6px">${t('Belum ada catatan. Simpan hasil raid lewat kalkulator untuk melihat rata-rata loot per unit dan tingkat kerugian.')}</div>`;
    return;
  }
  const g = {};
  for (const r of raids) {
    const k = `${r.type}|${r.level}|${r.unit}`;
    (g[k] ||= { type: r.type, level: r.level, unit: r.unit, n: 0, count: 0, loot: 0, loss: 0 });
    g[k].n++; g[k].count += r.count; g[k].loot += r.loot; g[k].loss += r.loss;
  }
  const list = Object.values(g).sort((a, b) => a.type.localeCompare(b.type) || a.level - b.level);
  el.innerHTML = `<div class="row"><h3 style="font-size:16px" class="grow">${t('Statistik raid')}</h3><button class="btn sm danger" id="s-clear">${t('Hapus semua')}</button></div>
    <table class="tbl-compact" style="margin-top:8px"><thead><tr><th>Dungeon</th><th>${t('Unit')}</th><th class="r">Raid</th><th class="r">Loot/unit</th><th class="r">${t('Hilang')}</th></tr></thead>
    <tbody>${list.map((s) => `<tr><td>${esc(TYPE_ID[s.type] || s.type)} L${s.level}</td><td>${esc(s.unit)}</td><td class="r num">${s.n}</td>
      <td class="r num">${fmtNum(s.loot / s.count)}</td><td class="r num">${((s.loss / s.count) * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table>`;
}

// ---------- dialog ----------
function openDialog(d) {
  const form = root.querySelector('#d-form');
  form.reset();
  form.dataset.key = d?.key || '';
  if (d) {
    form.kind.value = d.kind; form.type.value = d.type; form.coord.value = d.key; form.level.value = d.level;
    form.explored.value = d.explored ?? 0; form.guardians.value = d.guardians ?? ''; form.maxLoot.value = d.maxLoot ?? '';
    form.weakTo.value = d.weakTo || ''; form.note.value = d.note || '';
  }
  root.querySelector('#d-dlg').showModal();
}

async function saveDialog() {
  const dlg = root.querySelector('#d-dlg');
  if (dlg.returnValue !== 'ok') return;
  const form = root.querySelector('#d-form');
  const [x, y] = form.coord.value.split(':').map(Number);
  const key = `${x}:${y}`;
  const old = ctx.state.dungeons[form.dataset.key] || {};
  const dungeons = { ...ctx.state.dungeons };
  if (form.dataset.key && form.dataset.key !== key) delete dungeons[form.dataset.key];
  const conts = Object.values(ctx.state.cities).map((c) => c.cont).filter((c) => c != null);
  let type = form.type.value.trim();
  const found = TYPES.find((tt) => tt.toLowerCase() === type.toLowerCase() || TYPE_ID[tt].toLowerCase() === type.toLowerCase());
  if (found) type = found;
  dungeons[key] = {
    ...old, key, x, y, cont: old.cont ?? conts[0] ?? null,
    kind: form.kind.value, type, level: +form.level.value, explored: +form.explored.value || 0,
    guardians: form.guardians.value ? +form.guardians.value : null, maxLoot: form.maxLoot.value ? +form.maxLoot.value : null,
    weakTo: form.weakTo.value.trim(), note: form.note.value.trim(), seenAt: old.seenAt || Date.now(), manual: true
  };
  await ctx.save({ dungeons });
  selKey = key;
  renderTable();
  renderCalcHead();
}

function parseDur(s) {
  let ms = 0, hit = false, m;
  const re = /(\d+(?:[.,]\d+)?)\s*(d|h|j|m|s)\b/gi;
  while ((m = re.exec(s || ''))) {
    hit = true;
    const n = parseFloat(m[1].replace(',', '.')), u = m[2].toLowerCase();
    ms += n * (u === 'd' ? 864e5 : u === 'h' || u === 'j' ? 36e5 : u === 'm' ? 6e4 : 1e3);
  }
  return hit ? ms : null;
}
