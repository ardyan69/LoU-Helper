// Cheat Sheet → 🧱 Buildings: cost & build time per level (game data), with your city's construction speed.
import { esc, RES_ICON } from '../lib/shared.js';
import { t, locale } from '../lib/i18n.js';
import { BUILDINGS, WALL, BY_CODE, researchPct, levelCost } from '../lib/gamedata.js';

const st = { id: 'woodcutter', speed: 0, city: '', from: 0, to: 10, n: 1 };
try { Object.assign(st, JSON.parse(localStorage.getItem('lou-cs-bld') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-cs-bld', JSON.stringify(st)); } catch {} };
const ALL = { ...BUILDINGS, wall: WALL };
const GROUPS = [
  ['Ekonomi', ['townhall', 'woodcutter', 'quarry', 'ironmine', 'farm', 'sawmill', 'stonemason', 'foundry', 'mill', 'cottage', 'warehouse', 'hideout', 'townhouse', 'marketplace', 'harbor', 'palace']],
  ['Militer', ['barracks', 'cityguard_house', 'training_ground', 'stable', 'moonglow_tower', 'trinsic_temple', 'workshop', 'shipyard', 'castle']],
  ['Tembok', ['wall', 'lookout_tower', 'ranger_tower', 'guardian_tower', 'templar_tower', 'ballista_tower', 'pitfall_trap', 'barricade', 'arcane_trap', 'camouflage_trap']]
];
const RK = ['wood', 'stone', 'iron', 'food', 'gold'];
const num = (n) => Math.round(n).toLocaleString(locale());
export function fmtT(sec) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec}s`;
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d) return `${d}d ${h}h ${String(m).padStart(2, '0')}m`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

// construction speed of a real city: Cottages (synced layout) + Construction research
export function citySpeed(state, layout) {
  let p = 0;
  if (layout?.cells) for (let i = 0; i < 441; i++) if (layout.cells[i] === 'C') p += BY_CODE.C.eff[Math.min(10, Math.max(1, layout.levels[i] || 1)) - 1];
  return p + researchPct(state.movements?.research?.construction || 0);
}
const lives = (state) => (state.layouts || []).filter((l) => l.source === 'game' && l.live).sort((a, b) => String(a.cityName).localeCompare(String(b.cityName), 'id', { numeric: true }));

export function html(state) {
  const l = lives(state).find((x) => x.id === st.city);
  if (l) st.speed = citySpeed(state, l);
  return `
    <div class="card cs-note small">${t('Biaya & waktu bangun tiap level dari data game. Waktu dibagi dengan kecepatan bangun kota: 1 + (Cottage + riset Construction) ÷ 100.')}</div>
    <div class="toolbar card">
      <label class="field">${t('Bangunan')}<select data-bs="id">${GROUPS.map(([g, ids]) => `<optgroup label="${esc(t(g))}">${ids.map((id) => `<option value="${id}" ${id === st.id ? 'selected' : ''}>${esc(ALL[id].name)}</option>`).join('')}</optgroup>`).join('')}</select></label>
      <label class="field">🏰 ${t('Kecepatan dari kota')}<select data-bs="city"><option value="">— ${t('manual')} —</option>${lives(state).map((x) => `<option value="${x.id}" ${x.id === st.city ? 'selected' : ''}>${esc(x.cityName || x.name)}</option>`).join('')}</select></label>
      <label class="field">${t('Kecepatan bangun %')}<input type="number" min="0" data-bs="speed" value="${st.speed}"></label>
      <label class="field">${t('Dari level')}<input type="number" min="0" max="9" data-bs="from" value="${st.from}"></label>
      <label class="field">${t('Sampai level')}<input type="number" min="1" max="10" data-bs="to" value="${st.to}"></label>
      <label class="field">${t('Jumlah bangunan')}<input type="number" min="1" data-bs="n" value="${st.n}"></label>
    </div>
    <div id="bs-out"></div>`;
}

export function paint(root) {
  const out = root.querySelector('#bs-out');
  if (!out) return;
  const b = ALL[st.id] || ALL.woodcutter;
  const f = 1 + (st.speed || 0) / 100;
  const used = RK.filter((r) => b.cost[r]?.some((v) => v));
  const cum = Object.fromEntries(used.map((r) => [r, 0]));
  let cumT = 0;
  const rows = [];
  for (let L = 1; L <= b.max; L++) {
    used.forEach((r) => { cum[r] += b.cost[r][L - 1] || 0; });
    cumT += b.time[L - 1] || 0;
    const inRange = L > st.from && L <= st.to;
    rows.push(`<tr class="${inRange ? 'best' : ''}"><td><b>L${L}</b></td>${used.map((r) => `<td class="num">${num(b.cost[r][L - 1] || 0)}</td>`).join('')}
      <td class="num muted">${fmtT(b.time[L - 1])}</td><td class="num"><b>${fmtT(b.time[L - 1] / f)}</b></td>
      <td class="num">${num(b.eff[L - 1])}</td>${b.eff2 ? `<td class="num">${num(b.eff2[L - 1])}</td>` : ''}
      <td class="num small muted">${used.map((r) => `${RES_ICON[r]}${num(cum[r])}`).join(' ')} · ${fmtT(cumT / f)}</td></tr>`);
  }
  const rng = levelCost(b, Math.max(0, st.from), Math.min(b.max, st.to));
  const n = Math.max(1, st.n || 1);
  out.innerHTML = `
    <div class="cs-res">
      <div><span class="muted">${t('Total L{a} → L{b}', { a: st.from, b: st.to })}${n > 1 ? ` × ${n}` : ''}</span><b>${used.map((r) => `${RES_ICON[r]} ${num(rng.cost[r] * n)}`).join(' ')}</b></div>
      <div><span class="muted">${t('Waktu bangun (kotamu)')}</span><b>${fmtT((rng.time * n) / f)}</b><span class="small muted">${t('dasar')} ${fmtT(rng.time * n)}</span></div>
      <div><span class="muted">${t('Syarat')}</span><b>${b.th ? `Town Hall L${b.th}` : '—'}</b><span class="small muted">${[b.wall ? t('slot tembok') : '', b.water ? t('kota air') : '', b.castle ? t('butuh kastil') : '', b.one ? t('hanya satu') : ''].filter(Boolean).join(' · ')}</span></div>
    </div>
    <div class="card cs-card" style="margin-top:12px"><h3>${esc(b.name)}</h3>
      <div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Level')}</th>${used.map((r) => `<th class="num">${RES_ICON[r]}</th>`).join('')}<th class="num">${t('Waktu dasar')}</th><th class="num">${t('Waktu kamu')}</th>
        <th class="num">${esc(b.label || t('Efek'))}</th>${b.eff2 ? `<th class="num">${esc(b.label2 || '')}</th>` : ''}<th class="num">${t('Kumulatif dari L1')}</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div></div>`;
}

export function onInput(e, root, rerender) {
  const el = e.target;
  if (!el.dataset.bs) return false;
  const k = el.dataset.bs;
  st[k] = el.type === 'number' ? +el.value : el.value;
  if (k === 'speed') st.city = '';
  if (k === 'from' || k === 'to') { st.from = Math.max(0, Math.min(9, st.from)); st.to = Math.max(st.from + 1, Math.min(10, st.to)); }
  persist();
  if (k === 'city' || k === 'id') rerender(); else paint(root);
  return true;
}
