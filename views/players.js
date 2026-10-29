// "👥 Pemain" — other players seen on the map, your notes/relations, and the history of incoming attacks.
import { esc, fmtNum, fmtAgo, fmtClock, dist } from '../lib/shared.js';
import { t } from '../lib/i18n.js';

let root, ctx, sel = null;
const f = { q: '', rel: 'all', sort: 'attacks' };
const REL = { enemy: ['🔴', 'Musuh'], watch: ['🟠', 'Waspadai'], neutral: ['⚪', 'Netral'], ally: ['🟢', 'Sekutu'] };

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow"><h2>👥 ${t('Pemain &amp; Aliansi')}</h2><p>${t('Pemain lain yang terlihat di peta Region, catatan & status hubunganmu, serta riwayat serangan masuk per pemain.')}</p></div>
    </div>
    <div class="toolbar card">
      <label class="field grow">${t('Cari')}<input type="text" id="pl-q" placeholder="${t('nama pemain / aliansi / catatan')}"></label>
      <label class="field">${t('Hubungan')}<select id="pl-rel"><option value="all">${t('Semua')}</option>${Object.entries(REL).map(([k, [i, n]]) => `<option value="${k}">${i} ${t(n)}</option>`).join('')}<option value="attackers">⚔️ ${t('Pernah menyerang')}</option></select></label>
      <label class="field">${t('Urutkan')}<select id="pl-sort"><option value="attacks">${t('Serangan terbanyak')}</option><option value="near">${t('Terdekat')}</option><option value="cities">${t('Kota terbanyak')}</option><option value="name">${t('Nama')}</option></select></label>
    </div>
    <div class="two-col">
      <div class="table-wrap" id="pl-table"></div>
      <div id="pl-side"></div>
    </div>`;
  root.querySelector('#pl-q').addEventListener('input', (e) => { f.q = e.target.value.toLowerCase(); render(); });
  root.querySelector('#pl-rel').addEventListener('change', (e) => { f.rel = e.target.value; render(); });
  root.querySelector('#pl-sort').addEventListener('change', (e) => { f.sort = e.target.value; render(); });
  root.querySelector('#pl-table').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-name]');
    if (tr) { sel = tr.dataset.name; render(); }
  });
  root.querySelector('#pl-side').addEventListener('change', saveNote);
  root.querySelector('#pl-side').addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]');
    if (cp) { e.preventDefault(); navigator.clipboard.writeText(cp.dataset.copy); ctx.toast(t('Koordinat disalin: {c}', { c: cp.dataset.copy })); }
  });
}

async function saveNote(e) {
  const el = e.target;
  if (!sel || !el.dataset.pn) return;
  const notes = { ...ctx.state.playerNotes };
  notes[sel] = { ...(notes[sel] || {}), [el.dataset.pn]: el.value, at: Date.now() };
  await ctx.save({ playerNotes: notes });
  ctx.toast(t('Tersimpan'));
  renderTable();
}

function model() {
  const S = ctx.state;
  const mine = Object.values(S.cities).filter((c) => c.x != null);
  const att = {};
  for (const a of S.attackLog || []) if (a.owner) (att[a.owner] = att[a.owner] || []).push(a);
  const names = new Set([...Object.keys(S.players || {}), ...Object.keys(att), ...Object.keys(S.playerNotes || {})]);
  return [...names].map((name) => {
    const p = S.players?.[name] || { name, cities: {} };
    const cs = Object.values(p.cities || {});
    let near = null;
    for (const c of cs) for (const m of mine) { const d = dist(c, m); if (!near || d < near.d) near = { d, mine: m, theirs: c }; }
    const n = S.playerNotes?.[name] || {};
    const list = (att[name] || []).sort((a, b) => (b.arriveAt || b.seenAt) - (a.arriveAt || a.seenAt));
    return { name, tag: p.tag || list[0]?.tag || null, cities: cs, near, attacks: list, rel: n.rel || '', note: n.note || '', seenAt: p.seenAt };
  });
}

export function render() {
  if (!root) return;
  renderTable();
}
function renderTable() {
  let rows = model();
  if (f.q) rows = rows.filter((r) => `${r.name} ${r.tag || ''} ${r.note}`.toLowerCase().includes(f.q));
  if (f.rel === 'attackers') rows = rows.filter((r) => r.attacks.length);
  else if (f.rel !== 'all') rows = rows.filter((r) => r.rel === f.rel);
  const by = { attacks: (a, b) => b.attacks.length - a.attacks.length || (a.near?.d ?? 1e9) - (b.near?.d ?? 1e9), near: (a, b) => (a.near?.d ?? 1e9) - (b.near?.d ?? 1e9), cities: (a, b) => b.cities.length - a.cities.length, name: (a, b) => a.name.localeCompare(b.name) };
  rows.sort(by[f.sort]);
  const tbl = root.querySelector('#pl-table');
  tbl.innerHTML = rows.length ? `<table class="cs-tbl"><thead><tr><th>${t('Pemain')}</th><th>${t('Aliansi')}</th><th class="num">${t('Kota')}</th><th class="num">${t('Jarak terdekat')}</th><th class="num">⚔️ ${t('Serangan')}</th><th>${t('Terakhir')}</th><th>${t('Catatan')}</th></tr></thead><tbody>
    ${rows.map((r) => `<tr data-name="${esc(r.name)}" class="${r.name === sel ? 'sel' : ''}" style="cursor:pointer">
      <td>${r.rel ? REL[r.rel][0] + ' ' : ''}<b>${esc(r.name)}</b></td><td>${r.tag ? `<span class="pill">${esc(r.tag)}</span>` : '<span class="muted">—</span>'}</td>
      <td class="num">${r.cities.length || '—'}</td><td class="num">${r.near ? r.near.d.toFixed(1) : '—'}</td>
      <td class="num ${r.attacks.length ? 'bad-t' : ''}">${r.attacks.length || '—'}</td>
      <td class="small muted">${r.attacks[0] ? fmtAgo(r.attacks[0].arriveAt || r.attacks[0].seenAt) : '—'}</td>
      <td class="small">${esc(r.note.slice(0, 40))}</td></tr>`).join('')}</tbody></table>`
    : `<div class="card muted">${t('Belum ada pemain. Buka peta Region di game supaya kota pemain lain tercatat; serangan masuk tercatat otomatis.')}</div>`;
  renderSide(rows.find((r) => r.name === sel) || model().find((r) => r.name === sel));
}

function renderSide(r) {
  const side = root.querySelector('#pl-side');
  if (!r) { side.innerHTML = `<div class="card small muted">${t('Pilih pemain untuk melihat kota, riwayat serangan & catatan.')}</div>`; return; }
  side.innerHTML = `<div class="card">
      <h3>${esc(r.name)} ${r.tag ? `<span class="pill">${esc(r.tag)}</span>` : ''}</h3>
      <label class="field">${t('Hubungan')}<select data-pn="rel"><option value="">—</option>${Object.entries(REL).map(([k, [i, n]]) => `<option value="${k}" ${r.rel === k ? 'selected' : ''}>${i} ${t(n)}</option>`).join('')}</select></label>
      <label class="field" style="margin-top:8px">${t('Catatan')}<textarea data-pn="note" rows="3" placeholder="${t('mis. aktif malam, punya banyak Knight…')}">${esc(r.note)}</textarea></label>
    </div>
    <div class="card"><h3>🏰 ${t('Kota')} (${r.cities.length})</h3>
      ${r.cities.length ? `<table class="cs-tbl"><tbody>${r.cities.sort((a, b) => (b.score || 0) - (a.score || 0)).map((c) => `<tr><td>${esc(c.name || '—')}${c.castle ? ' 🏯' : ''}${c.water ? ' 🌊' : ''}</td><td><a href="#" class="small muted" data-copy="${c.key}">${c.key}</a></td><td class="num small">${c.score != null ? fmtNum(c.score) : ''}</td></tr>`).join('')}</tbody></table>
        ${r.near ? `<p class="small muted">${t('Terdekat: {a} ↔ {b} ({d} field)', { a: esc(r.near.theirs.name || r.near.theirs.key), b: esc(r.near.mine.name), d: r.near.d.toFixed(1) })}</p>` : ''}` : `<p class="small muted">${t('Belum terlihat di peta.')}</p>`}
    </div>
    <div class="card"><h3>⚔️ ${t('Riwayat serangan masuk')} (${r.attacks.length})</h3>
      ${r.attacks.length ? `<table class="cs-tbl"><thead><tr><th>${t('Waktu')}</th><th>${t('Misi')}</th><th>${t('Dari')}</th><th>${t('Ke')}</th></tr></thead><tbody>${r.attacks.slice(0, 50).map((a) => `<tr><td class="small">${fmtClock(a.arriveAt || a.seenAt)}</td><td>${esc(a.order || '?')}</td><td class="small">${esc(a.src || `${a.fromX}:${a.fromY}`)}</td><td class="small">${esc(a.target || `${a.toX}:${a.toY}`)}</td></tr>`).join('')}</tbody></table>` : `<p class="small muted">${t('Tidak ada serangan tercatat dari pemain ini.')}</p>`}
    </div>`;
}

export function onData(state, keys) {
  if (root?.classList.contains('on') && keys.some((k) => ['players', 'attackLog', 'cities'].includes(k)) && !root.contains(document.activeElement)) render();
}
