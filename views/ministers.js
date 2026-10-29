// "🎩 Ministers" — the Build, Defense, War and Trade minister settings of every city on one screen, with
// recommendations. Settings are read from the game; "Apply to game" sends them with the game's own minister
// commands (the same ones its Ministers screen sends) — only when you click it and confirm.
import { esc, fmtNum, fmtDur } from '../lib/shared.js';
import { t } from '../lib/i18n.js';
import { unitById, cityRecruitPct, RECRUIT_GROUPS } from '../lib/cheatsheet.js';
import { liveLayout } from '../lib/cityrates.js';
import {
  KEYS, DEFAULTS, ministerCities, ministersOf, ministerUntil, current, cityRole, sameConfig,
  recBuild, recDefense, recWar, recTrade, planToMinister, typeLevelsFrom, raidUnits, cityCmd, tradeCmd, toggleCmd
} from '../lib/ministers.js';

let root, ctx, busy = false;
const ms = { tab: 'build', draft: { build: {}, defense: {}, military: {}, trade: {} }, plan: {}, minShipment: null, why: {} };
try { Object.assign(ms, JSON.parse(localStorage.getItem('lou-ministers') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-ministers', JSON.stringify(ms)); } catch {} };
const mark = (s) => s;
const NAME = { build: mark('Build'), defense: mark('Defense'), military: mark('War'), trade: mark('Trade') };
const ICON = { build: '🔨', defense: '🛡️', military: '⚔️', trade: '🛒' };
const ABOUT = {
  build: mark('Build Minister: antrian bangun 16, mengerjakan rencana bangun dari atas ke bawah (atau merata), menaikkan tembok, dan bisa membongkar bangunan/node yang tidak ada di rencana.'),
  defense: mark('Defense Minister: menjaga jumlah tiap unit di kota — merekrut selisihnya — dan menaikkan tembok & menara ke level yang dipilih.'),
  military: mark('War Minister: raid otomatis dengan pasukan menganggur ke dungeon terdekat sampai level tertentu, dalam radius, menyisakan sebagian di rumah.'),
  trade: mark('Trade Minister: tiap kota punya target per resource; di bawah target minta ke kota yang dipilih, kelebihan disimpan, dikirim, atau dimurnikan.')
};
const WHY = {
  keepQueued: mark('Antrian 4 (maksimal) supaya minister selalu punya pesanan.'),
  'wall-front': mark('Tembok 10: kota ini diserang dalam 14 hari terakhir.'),
  'wall-mil': mark('Tembok 10: kota militer / Castle.'),
  'wall-eco': mark('Tembok dibiarkan: resource untuk ekonomi dulu.'),
  plan: mark('Rencana dikirim dalam urutan pintar (Cottage dulu, Town Hall saat perlu); bangunan & node di luar rencana dibongkar.'),
  upgrade: mark('Tanpa rencana: semua jenis bangunan yang ada dinaikkan ke level 10, merata (level terendah dulu).'),
  'def-army': mark('Isi troop space dengan unit utama kota militer.'),
  'def-garrison': mark('Garnisun: unit bertahan terbaik, setengah troop space.'),
  'def-food': mark('Perhatian: makan pasukan ini lebih besar dari produksi makanan — atur Trade agar makanan dikirim ke kota ini.'),
  'def-none': mark('Kota ini belum bisa merekrut unit bertahan.'),
  'no-layout': mark('Layout kota belum tersinkron — buka kota ini di game.'),
  'war-none': mark('Tidak ada unit raid di kota — raid otomatis dimatikan.'),
  'war-level': mark('Level maks dipilih supaya maksimal 5 raid sekaligus memakai hampir semua pasukan raid — minister hanya mengirim secukupnya untuk membersihkan dungeon, jadi loot naik dengan pasukan yang terpakai.'),
  'war-attacked': mark('Ada serangan masuk ke kota ini — raid otomatis dimatikan dulu supaya pasukan ada di rumah.'),
  'war-offense-only': mark('Kota garis depan: hanya unit penyerang (Berserker, Knight, Mage, Warlock) yang raid; unit bertahan tetap di rumah.'),
  'war-weak': mark('Pasukan raid belum cukup untuk dungeon level 1 — raid otomatis dimatikan.'),
  'war-food': mark('Makanan kota minus — pasukan yang sedang raid tidak makan, jadi semua ikut raid.'),
  'war-cap': mark('Belum ada dungeon level setinggi itu yang tercatat dalam 60 field — level maks disesuaikan ke L{l}, level tertinggi yang ada di sekitar.'),
  'war-info': mark('≈ {a} raid sekaligus · {u}% pasukan raid terpakai · ±{l} loot/jam · {n} dungeon cocok tercatat.'),
  'war-front': mark('Sisakan 30% di rumah: kota garis depan.'),
  'war-all': mark('Kota militer: semua pasukan menganggur ikut raid.'),
  'war-keep': mark('Sisakan 10% di rumah.'),
  'war-radius': mark('Radius mencakup ±3 dungeon per raid di sekitar level maks (maks−2 … maks).'),
  'war-radius-default': mark('Belum ada data dungeon di sekitar — radius 20.'),
  'trade-hub': mark('Hub: tanpa target, menyimpan kelebihan untuk permintaan kota lain.'),
  'trade-eco': mark('Target 40% kapasitas; kekurangan diminta dari hub, kelebihan dikirim ke hub.'),
  'trade-mil': mark('Kota militer: besi 60%, kayu & batu 20%, diminta dari hub; kelebihan disimpan.'),
  'trade-food': mark('Target makanan ≥ 24 jam makan pasukan saat TS penuh ({n}).'),
  'trade-hub-info': mark('Hub untuk {n} kota lain di benua ini · {c} gerobak.'),
  'trade-carts': mark('Hub baru punya {n} gerobak — tambah Marketplace supaya kiriman tidak antre.'),
  'trade-alone': mark('Sendirian di benua ini dan tanpa kapal — tidak ada kota untuk diminta; kelebihan disimpan.'),
  'trade-purify': mark('Moonglow Tower L10: kelebihan dimurnikan.'),
  'trade-sea': mark('Tidak ada hub di benua ini — minta lewat laut dari hub dengan kapal terbanyak.'),
  'trade-dist': mark('Minta dari {c} · jarak {d} field.'),
  'trade-new': mark('Kota baru: kayu & batu 60% untuk membangun, diminta dari hub.')
};
const ROLE = { military: '⚔️', hub: '📦', economy: '🌾', new: '🌱', unknown: '❔' };
const ROLE_N = { military: mark('militer'), hub: mark('hub'), economy: mark('ekonomi'), new: mark('baru'), unknown: mark('belum tersinkron') };
const SURPLUS = { keep: mark('simpan'), send: mark('kirim'), purify: mark('murnikan') };
const RES = ['wood', 'stone', 'iron', 'food'];
const RES_I = { wood: '🪵', stone: '🪨', iron: '⛏️', food: '🌾' };

export function mount(el, c) {
  root = el;
  ctx = c;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow">
        <h2>🎩 ${t('Set Ministers')}</h2>
        <p>${t('Setelan Build, Defense, War & Trade minister untuk semua kota di satu layar, dengan rekomendasi. Perubahan baru dikirim ke game saat kamu klik <b>Terapkan ke game</b> dan mengonfirmasi.')}</p>
      </div>
    </div>
    <div id="mn-body"></div>`;
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
}
export function render() { if (root) draw(); }
export function onData(state, keys) {
  if (!root?.classList.contains('on') || busy || !keys.includes('movements')) return;
  if (root.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
  draw();
}

// ---------- values ----------
const st = () => ctx.state;
function value(key, c) {
  const d = ms.draft[key]?.[c.id];
  if (d) return d;
  const cur = current(st(), key, c.id);
  return cur ? structuredClone(cur) : key === 'trade' ? { target: {}, surplus: 'keep' } : DEFAULTS[key]();
}
function setDraft(key, c, cfg) {
  ms.draft[key] = ms.draft[key] || {};
  ms.draft[key][c.id] = cfg;
  persist();
}
// drafts that equal what the game has are done
function pruneDrafts() {
  for (const key of KEYS) for (const id of Object.keys(ms.draft[key] || {})) {
    if (sameConfig(ms.draft[key][id], gameValue(key, id))) { delete ms.draft[key][id]; }
  }
  if (ms.minShipment != null && ms.minShipment === ministersOf(st())?.trade?.minShipment) ms.minShipment = null;
}
// a city without settings in the game counts as the game's defaults
const gameValue = (key, id) => current(st(), key, id) ?? (key === 'trade' ? { target: {}, surplus: 'keep' } : DEFAULTS[key]());
const changed = (key, c) => !!ms.draft[key]?.[c.id] && !sameConfig(ms.draft[key][c.id], gameValue(key, c.id));
function changes() {
  const out = [];
  for (const key of ['build', 'defense', 'military']) for (const c of ministerCities(st())) if (changed(key, c)) out.push({ key, c });
  return out;
}
const tradeChanged = () => ministerCities(st()).some((c) => changed('trade', c)) || (ms.minShipment != null && ms.minShipment !== ministersOf(st())?.trade?.minShipment);

// ---------- events ----------
function onChange(e) {
  const el = e.target;
  if (el.dataset.mship != null) { ms.minShipment = Math.max(0, +el.value || 0); persist(); draw(); return; }
  const id = el.dataset.cid, key = el.dataset.k, f = el.dataset.f;
  if (!id || !key || !f) return;
  const c = ministerCities(st()).find((x) => x.id === id);
  if (!c) return;
  const cfg = value(key, c);
  const num = (v, a, b) => Math.max(a, Math.min(b, Math.round(+v || 0)));
  if (f === 'enabled' || f === 'upgradeExisting' || f === 'evenBuild' || f === 'demolishUnplanned') cfg[f] = el.checked;
  else if (f === 'keepQueued') cfg.keepQueued = num(el.value, 1, 4);
  else if (f === 'wallLevel' || f === 'towerLevel') cfg[f] = num(el.value, 0, 10);
  else if (f === 'maxLevel') cfg.maxLevel = num(el.value, 1, 10);
  else if (f === 'radius') cfg.radius = num(el.value, 1, 60);
  else if (f === 'maxArmies') cfg.maxArmies = num(el.value, 1, 5);
  else if (f === 'keepHomePct') cfg.keepHomePct = num(el.value, 0, 100) / 100;
  else if (f === 'target') { cfg.targets = { ...(cfg.targets || {}) }; const n = Math.max(0, Math.round(+el.value || 0)); if (n) cfg.targets[el.dataset.u] = n; else delete cfg.targets[el.dataset.u]; }
  else if (f === 'unit') { const u = el.dataset.u; cfg.units = el.checked ? [...new Set([...(cfg.units || []), u])] : (cfg.units || []).filter((x) => x !== u); }
  else if (f === 'res') { cfg.target = { ...(cfg.target || {}) }; const n = Math.max(0, Math.round(+el.value || 0)); if (n) cfg.target[el.dataset.r] = n; else delete cfg.target[el.dataset.r]; }
  else if (f === 'requestFrom' || f === 'sendTo') { if (el.value) cfg[f] = el.value; else delete cfg[f]; }
  else if (f === 'surplus') { cfg.surplus = el.value; if (el.value !== 'send') delete cfg.sendTo; }
  else if (f === 'plan') {
    ms.plan[id] = el.value;
    const layout = liveLayout(st(), c.key);
    if (el.value === '__clear') { cfg.plan = []; }
    else if (el.value) {
      const p = st().layouts.find((l) => l.id === el.value);
      if (p && layout) { cfg.plan = planToMinister(p, layout); cfg.typeLevels = typeLevelsFrom(cfg.plan, cfg.typeLevels); cfg.evenBuild = false; }
    } else { const cur = current(st(), 'build', id); cfg.plan = cur?.plan || []; }
  }
  setDraft(key, c, cfg);
  draw();
}
async function onClick(e) {
  const tab = e.target.closest('[data-mtab]');
  if (tab) { ms.tab = tab.dataset.mtab; persist(); draw(); return; }
  const a = e.target.closest('[data-mact]')?.dataset.mact;
  if (!a || busy) return;
  const cities = ministerCities(st());
  const key = ms.tab;
  if (a === 'rec-all') {
    if (key === 'trade') {
      const r = recTrade(st(), cities);
      for (const c of cities) if (r.settings.cities[c.id]) { setDraft('trade', c, r.settings.cities[c.id]); ms.why[`trade:${c.id}`] = r.why[c.id] || []; }
      ms.minShipment = r.settings.minShipment;
      ms.tradeHubs = Object.entries(r.hubs || {}).map(([cont, h]) => `C${String(cont).padStart(2, '0')} → ${h.c.name}`);
    } else for (const c of cities) recommend(key, c);
    persist(); draw(); ctx.toast(t('Rekomendasi diisi — periksa lalu klik "Terapkan ke game".'));
    return;
  }
  if (a === 'rec') { const c = cities.find((x) => x.id === e.target.closest('[data-cid]').dataset.cid); if (key === 'trade') { const r = recTrade(st(), cities); if (r.settings.cities[c.id]) { setDraft('trade', c, r.settings.cities[c.id]); ms.why[`trade:${c.id}`] = r.why[c.id] || []; } if (r.settings.minShipment) ms.minShipment = r.settings.minShipment; } else recommend(key, c); persist(); draw(); return; }
  if (a === 'reset') { ms.draft[key] = {}; if (key === 'trade') { ms.minShipment = null; ms.tradeHubs = null; } for (const k of Object.keys(ms.why)) if (k.startsWith(key + ':')) delete ms.why[k]; if (key === 'build') ms.plan = {}; persist(); draw(); return; }
  if (a === 'apply') return apply(key);
  if (a === 'toggle') {
    const k = e.target.closest('[data-key]').dataset.key, on = !ministersOf(st())?.[k]?.enabled;
    if (!confirm(t('{a} {m} Minister di game?', { a: on ? t('Nyalakan') : t('Matikan'), m: t(NAME[k]) }))) return;
    return send([toggleCmd(k, on)], () => ctx.toast(t('{m} Minister: {s}', { m: t(NAME[k]), s: on ? t('menyala') : t('mati') })));
  }
}
function recommend(key, c) {
  const pid = ms.plan[c.id];
  const plan = pid && pid !== '__clear' ? st().layouts.find((l) => l.id === pid) : null;
  const r = key === 'build' ? recBuild(st(), c, { plan }) : key === 'defense' ? recDefense(st(), c) : recWar(st(), c);
  setDraft(key, c, r.config);
  ms.why[`${key}:${c.id}`] = r.why;
}

// ---------- sending ----------
async function gameTab() {
  try { const tabs = await chrome.tabs.query({ url: 'https://lordofultima.me/*' }); return tabs[0] || null; } catch { return null; }
}
async function send(msgs, onDone) {
  const tab = await gameTab();
  if (!tab) { alert(t('Buka tab game (lordofultima.me) dulu — setelan dikirim lewat tab game.')); return; }
  busy = true; draw();
  let res;
  try { res = await chrome.tabs.sendMessage(tab.id, { type: 'lou-minister', msgs }); }
  catch { res = { ok: false, error: 'no-content' }; }
  busy = false;
  if (!res?.ok) { alert(res?.error === 'no-content' ? t('Tab game perlu di-refresh (F5) sekali setelah update extension.') : t('Tidak ada jawaban dari tab game. Coba lagi.')); draw(); return []; }
  applyLocal(msgs, res.results);
  const bad = res.results.filter((r) => !r.ok);
  if (bad.length) {
    const why = bad.map((r) => (r.error === 'no-socket' ? t('koneksi game belum siap — tunggu beberapa detik (atau F5 tab game) lalu coba lagi') : r.error === 'timeout' ? t('game tidak menjawab dalam 8 detik — cek di layar Ministers game, lalu coba lagi bila belum berubah') : r.error)).join('\n');
    alert(t('{n} dari {m} setelan ditolak game:', { n: bad.length, m: res.results.length }) + '\n' + why);
  } else onDone?.();
  draw();
  return res.results;
}
// show what the game accepted right away (the game's own data confirms it a moment later)
function applyLocal(msgs, results) {
  const mv = st().movements;
  if (!mv?.ministers) return;
  const M = structuredClone(mv.ministers);
  msgs.forEach((m, i) => {
    if (!results[i]?.ok) return;
    if (m.t === 'ministerToggle') M[m.key] = { ...(M[m.key] || {}), enabled: m.enabled };
    else if (m.t === 'ministerCity') { M[m.key] = M[m.key] || { cities: {} }; M[m.key].cities = { ...(M[m.key].cities || {}), [m.cityId]: structuredClone(m.config) }; }
    else if (m.t === 'ministerTrade') M.trade = { ...(M.trade || {}), minShipment: m.settings.minShipment ?? M.trade?.minShipment, cities: structuredClone(m.settings.cities) };
  });
  st().movements = { ...mv, ministers: M };
}
async function apply(key) {
  const cities = ministerCities(st());
  let msgs = [], lines = [];
  if (key === 'trade') {
    if (!tradeChanged()) return;
    const edits = {};
    for (const c of cities) if (changed('trade', c)) { edits[c.id] = ms.draft.trade[c.id]; lines.push(`• ${c.name}`); }
    msgs = [tradeCmd(st(), edits, ms.minShipment ?? undefined)];
  } else {
    const list = changes().filter((x) => x.key === key);
    if (!list.length) return;
    msgs = list.map(({ c }) => cityCmd(key, c.id, ms.draft[key][c.id]));
    lines = list.map(({ c }) => `• ${c.name}`);
  }
  const off = ministersOf(st())?.[key] && !ministersOf(st())[key].enabled;
  if (!confirm(`${t('Kirim setelan {m} Minister ke game untuk:', { m: t(NAME[key]) })}\n${lines.join('\n')}${off ? '\n\n' + t('Catatan: minister ini sedang mati di game — setelan tersimpan, tapi baru bekerja setelah dinyalakan.') : ''}`)) return;
  const results = await send(msgs, () => ctx.toast(t('Setelan terkirim ke game ✓ — tampilan diperbarui saat game mengirim data baru.')));
  if (results?.length) ms.lastSent = Date.now();
  persist();
}

// ---------- drawing ----------
function draw() {
  const body = root.querySelector('#mn-body');
  const S = st();
  const M = ministersOf(S);
  if (!M) {
    body.innerHTML = `<div class="empty">${t('<b>Setelan minister belum terbaca.</b><br>Buka <a href="https://lordofultima.me/" target="_blank">lordofultima.me</a> (refresh tab game sekali setelah update extension) — setelan minister semua kota terbaca otomatis.')}</div>`;
    return;
  }
  pruneDrafts();
  const until = ministerUntil(S) || {};
  const nowS = Date.now() + (S.movements?.serverOffset || 0);
  const chips = KEYS.map((k) => {
    const on = !!M[k]?.enabled, left = (until[k] || 0) - nowS;
    return `<div class="mchip ${on ? 'on' : ''}"><b>${ICON[k]} ${t(NAME[k])}</b>
      <span class="small ${left > 0 ? '' : 'bad-t'}">${left > 0 ? t('sisa {t}', { t: fmtDur(left) }) : t('tidak disewa')}</span>
      <button class="btn sm" data-mact="toggle" data-key="${k}" ${busy ? 'disabled' : ''}>${on ? '🟢 ' + t('menyala') : '⚪ ' + t('mati')}</button></div>`;
  }).join('');
  const key = ms.tab;
  const cities = ministerCities(S);
  const nChanged = key === 'trade' ? cities.filter((c) => changed('trade', c)).length + (ms.minShipment != null && ms.minShipment !== M.trade?.minShipment ? 1 : 0) : changes().filter((x) => x.key === key).length;
  body.innerHTML = `
    <div class="mchips">${chips}</div>
    <div class="seg" style="margin:12px 0">${KEYS.map((k) => `<button data-mtab="${k}" class="${k === key ? 'on' : ''}">${ICON[k]} ${t(NAME[k])}${changes().some((x) => x.key === k) || (k === 'trade' && tradeChanged()) ? ' •' : ''}</button>`).join('')}</div>
    <div class="card cs-note small">${t(ABOUT[key])}</div>
    <div class="row mbar">
      <button class="btn" data-mact="rec-all" ${busy ? 'disabled' : ''}>✨ ${t('Rekomendasi untuk semua kota')}</button>
      <button class="btn" data-mact="reset" ${busy || !nChanged ? 'disabled' : ''}>↺ ${t('Kembalikan ke setelan game')}</button>
      <span class="grow"></span>
      <button class="btn primary" data-mact="apply" ${busy || !nChanged ? 'disabled' : ''}>${busy ? '⏳ ' + t('Mengirim…') : `💾 ${t('Terapkan ke game')} (${nChanged})`}</button>
    </div>
    ${key === 'build' ? buildTable(cities) : key === 'defense' ? defenseTable(cities) : key === 'military' ? warTable(cities) : tradeTable(cities)}
    <div class="small muted" style="margin-top:8px">${t('Baris bergaris kuning = berbeda dari setelan di game. Nilai di game baru berubah setelah kamu klik Terapkan ke game.')}</div>`;
}
const cityCell = (c) => {
  const role = cityRole(liveLayout(st(), c.key));
  return `<td><b>${esc(c.name)}</b> <span class="small muted">${c.key}</span><br><span class="pill" title="${esc(t(ROLE_N[role]))}">${ROLE[role]} ${esc(t(ROLE_N[role]))}</span>${c.castle ? ' 🏰' : ''}</td>`;
};
// why the recommendation looks like this — a full-width row under the city
const whyRow = (c, key, cols) => {
  const why = (ms.why[`${key}:${c.id}`] || []).map((w) => (typeof w === 'string' ? `<li>${esc(t(WHY[w] || w))}</li>` : `<li>${esc(t(WHY[w.k] || w.k, Object.fromEntries(Object.entries(w.p || {}).map(([k, v]) => [k, typeof v === 'number' ? fmtNum(v) : v]))))}</li>`)).join('');
  return why ? `<tr class="mwhyrow ${changed(key, c) ? 'mchg' : ''}"><td colspan="${cols}"><ul class="mwhy small">${why}</ul></td></tr>` : '';
};
const recBtn = (c) => `<td><button class="btn sm" data-mact="rec" data-cid="${c.id}" title="${t('Isi rekomendasi untuk kota ini')}">✨</button></td>`;
const inp = (c, key, f, v, min, max, extra = '') => `<input type="number" min="${min}" max="${max}" value="${v}" data-cid="${c.id}" data-k="${key}" data-f="${f}" ${extra}>`;
const chk = (c, key, f, v, title = '') => `<input type="checkbox" ${v ? 'checked' : ''} data-cid="${c.id}" data-k="${key}" data-f="${f}" title="${esc(title)}">`;

function buildTable(cities) {
  const rows = cities.map((c) => {
    const v = value('build', c), cur = current(st(), 'build', c.id);
    const plans = st().layouts.filter((l) => l.source !== 'game' && l.cityKey === c.key);
    const sel = ms.plan[c.id] || '';
    return `<tr class="${changed('build', c) ? 'mchg' : ''}">${cityCell(c)}
      <td>${chk(c, 'build', 'enabled', v.enabled)}</td>
      <td><select data-cid="${c.id}" data-k="build" data-f="plan">
        <option value="" ${!sel ? 'selected' : ''}>${t('— tetap ({n} item) —', { n: (cur?.plan || []).length })}</option>
        <option value="__clear" ${sel === '__clear' ? 'selected' : ''}>✖ ${t('kosongkan rencana')}</option>
        ${plans.map((l) => `<option value="${l.id}" ${sel === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
      </select><div class="small muted">${t('{n} item dikirim', { n: (v.plan || []).length })}${!plans.length ? ' · ' + t('belum ada rencana untuk kota ini (buat di Perencana Layout)') : ''}</div></td>
      <td>${inp(c, 'build', 'keepQueued', v.keepQueued ?? 2, 1, 4)}</td>
      <td>${inp(c, 'build', 'wallLevel', v.wallLevel ?? 0, 0, 10)}</td>
      <td>${chk(c, 'build', 'upgradeExisting', v.upgradeExisting, t('Naikkan bangunan yang ada ke level per jenis'))}</td>
      <td>${chk(c, 'build', 'evenBuild', v.evenBuild !== false, t('Level terendah dulu'))}</td>
      <td>${chk(c, 'build', 'demolishUnplanned', v.demolishUnplanned, t('Bongkar bangunan & node yang tidak ada di rencana'))}</td>
      ${recBtn(c)}</tr>${whyRow(c, 'build', 9)}`;
  }).join('');
  return `<div class="tbl-wrap"><table class="cs-tbl mtbl"><thead><tr><th>${t('Kota')}</th><th>${t('Aktif')}</th><th>${t('Rencana bangun')}</th><th>${t('Antrian')}</th><th>${t('Tembok')}</th><th title="${t('Naikkan bangunan yang ada ke level per jenis')}">${t('Auto-upgrade')}</th><th title="${t('Level terendah dulu')}">${t('Merata')}</th><th title="${t('Bongkar bangunan & node yang tidak ada di rencana')}">${t('Bongkar lainnya')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function recruitableUnits(c) {
  const l = liveLayout(st(), c.key);
  if (!l) return [];
  const rec = cityRecruitPct(l);
  const out = [];
  rec.forEach((g, i) => { if (g.n) for (const id of RECRUIT_GROUPS[i].units) { const u = unitById(id); if (u && u.lvl <= g.maxLvl && !u.naval && id !== 'baron' && id !== 'scout') out.push(id); } });
  return out;
}
function defenseTable(cities) {
  const rows = cities.map((c) => {
    const v = value('defense', c);
    const ids = [...new Set([...recruitableUnits(c), ...Object.keys(v.targets || {})])];
    return `<tr class="${changed('defense', c) ? 'mchg' : ''}">${cityCell(c)}
      <td>${chk(c, 'defense', 'enabled', v.enabled)}</td>
      <td><div class="ounits">${ids.length ? ids.map((id) => `<label class="small">${esc(unitById(id)?.name || id)}${inp(c, 'defense', 'target', v.targets?.[id] || 0, 0, 1000000, `data-u="${id}"`)}<span class="muted">${t('di kota {n}', { n: fmtNum(c.home[id] || 0) })}</span></label>`).join('') : `<span class="small muted">${t('belum bisa merekrut')}</span>`}</div></td>
      <td>${inp(c, 'defense', 'wallLevel', v.wallLevel ?? 0, 0, 10)}</td>
      <td>${inp(c, 'defense', 'towerLevel', v.towerLevel ?? 0, 0, 10)}</td>
      ${recBtn(c)}</tr>${whyRow(c, 'defense', 6)}`;
  }).join('');
  return `<div class="tbl-wrap"><table class="cs-tbl mtbl"><thead><tr><th>${t('Kota')}</th><th>${t('Aktif')}</th><th>${t('Jumlah unit dijaga di kota')}</th><th>${t('Tembok')}</th><th>${t('Menara')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function warTable(cities) {
  const rows = cities.map((c) => {
    const v = value('military', c);
    const ids = [...new Set([...raidUnits(c.home).map(([id]) => id), ...(v.units || [])])];
    return `<tr class="${changed('military', c) ? 'mchg' : ''}">${cityCell(c)}
      <td>${chk(c, 'military', 'enabled', v.enabled)}</td>
      <td>${inp(c, 'military', 'maxLevel', v.maxLevel ?? 3, 1, 10)}</td>
      <td>${inp(c, 'military', 'radius', v.radius ?? 20, 1, 60)}</td>
      <td>${inp(c, 'military', 'keepHomePct', Math.round((v.keepHomePct ?? 0.2) * 100), 0, 100)}</td>
      <td>${inp(c, 'military', 'maxArmies', v.maxArmies ?? 1, 1, 5)}</td>
      <td><div class="ounits">${ids.length ? ids.map((id) => `<label class="small">${chk(c, 'military', 'unit', (v.units || []).includes(id)).replace('data-f="unit"', `data-f="unit" data-u="${id}"`)} ${esc(unitById(id)?.name || id)} <span class="muted">${fmtNum(c.home[id] || 0)}</span></label>`).join('') : `<span class="small muted">${t('tidak ada unit raid')}</span>`}</div>
        <div class="small muted">${t('kosong = semua unit boleh')}</div></td>
      ${recBtn(c)}</tr>${whyRow(c, 'military', 8)}`;
  }).join('');
  return `<div class="tbl-wrap"><table class="cs-tbl mtbl"><thead><tr><th>${t('Kota')}</th><th>${t('Aktif')}</th><th>${t('Level dungeon maks')}</th><th>${t('Radius (field)')}</th><th>${t('Sisakan di rumah %')}</th><th>${t('Raid sekaligus')}</th><th>${t('Unit yang boleh dikirim')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function tradeTable(cities) {
  const T = ministersOf(st())?.trade || {};
  const opts = (sel, self) => `<option value="">—</option>` + cities.filter((x) => x.id !== self).map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const rows = cities.map((c) => {
    const v = value('trade', c);
    return `<tr class="${changed('trade', c) ? 'mchg' : ''}">${cityCell(c)}
      ${RES.map((r) => `<td>${inp(c, 'trade', 'res', v.target?.[r] || 0, 0, 100000000, `data-r="${r}" step="1000"`)}</td>`).join('')}
      <td><select data-cid="${c.id}" data-k="trade" data-f="requestFrom">${opts(v.requestFrom, c.id)}</select></td>
      <td><select data-cid="${c.id}" data-k="trade" data-f="surplus">${['keep', 'send', 'purify'].map((s) => `<option value="${s}" ${(v.surplus || 'keep') === s ? 'selected' : ''}>${t(SURPLUS[s])}</option>`).join('')}</select></td>
      <td>${(v.surplus || 'keep') === 'send' ? `<select data-cid="${c.id}" data-k="trade" data-f="sendTo">${opts(v.sendTo, c.id)}</select>` : '<span class="muted">—</span>'}</td>
      ${recBtn(c)}</tr>${whyRow(c, 'trade', 9)}`;
  }).join('');
  return `${ms.tradeHubs?.length ? `<div class="small" style="margin-bottom:6px">📦 ${t('Hub per benua (gerobak hanya lewat darat):')} <b>${ms.tradeHubs.map(esc).join(' · ')}</b></div>` : ''}<div class="row small" style="gap:8px;margin-bottom:8px">${t('Kiriman minimum')} <input type="number" min="0" step="500" data-mship value="${ms.minShipment ?? T.minShipment ?? 500}" style="width:110px"> <span class="muted">${t('resource per kiriman (1 gerobak = 1.000)')}</span></div>
    <div class="tbl-wrap"><table class="cs-tbl mtbl"><thead><tr><th>${t('Kota')}</th>${RES.map((r) => `<th>${RES_I[r]} ${t('target')}</th>`).join('')}<th>${t('Minta dari')}</th><th>${t('Kelebihan')}</th><th>${t('Kirim ke')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="small muted" style="margin-top:6px">${t('Trade disimpan sekaligus untuk semua kota (seperti layar Trade di game); kota yang tidak kamu ubah tetap memakai setelan lamanya. Resource tanpa target tidak pernah dikirim.')}</div>`;
}
