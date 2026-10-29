// 🔁 Resource transfer plan between own cities (part of City Overview).
// Suggests shipments from cities that are filling up to cities that run low, limited by carts.
import { RES, RES_ICON, RES_LABEL, projected, fmtNum, fmtDur, fmtClock, esc, dist } from '../lib/shared.js';
import { t } from '../lib/i18n.js';
import { BY_CODE, CART_CAP, CART_MPF, researchPct } from '../lib/gamedata.js';

const cfg = { give: 70, low: 35, fill: 60, res: { wood: true, stone: true, iron: true, food: true } };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('lou-transfer') || '{}')); } catch {}
const persist = () => { try { localStorage.setItem('lou-transfer', JSON.stringify(cfg)); } catch {} };

// carts of a city = sum of its Marketplaces' cart counts (from the synced layout)
function carts(state, key) {
  const l = (state.layouts || []).find((x) => x.source === 'game' && x.live && x.cityKey === key);
  if (!l) return null;
  let n = 0;
  for (let i = 0; i < 441; i++) if (l.cells[i] === 'P') n += BY_CODE.P.eff[Math.min(10, Math.max(1, l.levels[i] || 1)) - 1];
  return n;
}
// minutes per field for carts: calibrated from your trade convoys, else 10 ÷ (1 + trade research)
function cartMpf(state) {
  if (state.speedCal?.cartFactor) return CART_MPF * state.speedCal.cartFactor;
  const r = researchPct(state.movements?.research?.trade || 0);
  return CART_MPF / (1 + r / 100);
}

export function plan(state, now = Date.now()) {
  const cities = Object.values(state.cities).filter((c) => c.res && c.x != null);
  const mpf = cartMpf(state);
  const left = Object.fromEntries(cities.map((c) => [c.key, carts(state, c.key)]));
  const moves = [];
  for (const r of RES) {
    if (!cfg.res[r]) continue;
    const info = cities.map((c) => {
      const x = c.res[r];
      if (!x?.cap) return null;
      const v = projected(x, c.seenAt, now);
      return { c, v, cap: x.cap, give: Math.max(0, v - (cfg.give / 100) * x.cap), need: v < (cfg.low / 100) * x.cap ? (cfg.fill / 100) * x.cap - v : 0 };
    }).filter(Boolean);
    const dests = info.filter((d) => d.need > 0).sort((a, b) => b.need - a.need);
    for (const d of dests) {
      const srcs = info.filter((s) => s !== d && s.give > 0).sort((a, b) => dist(a.c, d.c) - dist(b.c, d.c));
      for (const s of srcs) {
        if (d.need <= 0) break;
        const cap = left[s.c.key] == null ? Infinity : left[s.c.key] * CART_CAP;
        const amt = Math.floor(Math.min(d.need, s.give, cap) / 100) * 100;
        if (amt < 1000) continue;
        const nc = Math.ceil(amt / CART_CAP);
        if (left[s.c.key] != null) left[s.c.key] -= nc;
        s.give -= amt; d.need -= amt;
        const mins = dist(s.c, d.c) * mpf;
        moves.push({ r, from: s.c, to: d.c, amt, carts: nc, mins, arrive: now + mins * 60000 });
      }
    }
  }
  return { moves, mpf, cities, cartsOf: (k) => carts(state, k) };
}

export function html(state) {
  const now = Date.now();
  const p = plan(state, now);
  const pct = (c, r) => { const x = c.res[r]; return x?.cap ? Math.round((projected(x, c.seenAt, now) / x.cap) * 100) : null; };
  const cls = (v) => (v == null ? '' : v >= cfg.give ? 'warn-t' : v < cfg.low ? 'bad-t' : '');
  return `
    <div class="card cs-note small">${t('Rencana kirim resource antar-kota: kota yang stoknya di atas batas memberi ke kota yang stoknya rendah (kota terdekat dulu), dibatasi jumlah gerobak (Marketplace × 1.000 per gerobak). Waktu tempuh memakai kecepatan gerobak hasil kalibrasi atau riset Trade.')}</div>
    <div class="toolbar card" id="tr-cfg">
      <label class="field">${t('Beri jika stok di atas (%)')}<input type="number" min="10" max="100" data-tr="give" value="${cfg.give}"></label>
      <label class="field">${t('Terima jika stok di bawah (%)')}<input type="number" min="0" max="90" data-tr="low" value="${cfg.low}"></label>
      <label class="field">${t('Isi tujuan sampai (%)')}<input type="number" min="10" max="100" data-tr="fill" value="${cfg.fill}"></label>
      ${RES.map((r) => `<label class="check"><input type="checkbox" data-trr="${r}" ${cfg.res[r] ? 'checked' : ''}> ${RES_ICON[r]} ${RES_LABEL[r]}</label>`).join('')}
      <span class="small muted">🛒 ${t('{m} menit/field', { m: p.mpf.toFixed(2) })}</span>
    </div>
    <div class="card cs-card"><h3>🔁 ${t('Saran pengiriman')} (${p.moves.length})</h3>
      ${p.moves.length ? `<div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Dari')}</th><th>${t('Ke')}</th><th>${t('Resource')}</th><th class="num">${t('Jumlah')}</th><th class="num">🛒 ${t('Gerobak')}</th><th class="num">${t('Jarak')}</th><th class="num">${t('Waktu tempuh')}</th><th class="num">${t('Tiba')}</th></tr></thead><tbody>
        ${p.moves.map((m) => `<tr><td><b>${esc(m.from.name)}</b> <span class="small muted">${m.from.key}</span></td><td><b>${esc(m.to.name)}</b> <span class="small muted">${m.to.key}</span></td>
          <td>${RES_ICON[m.r]} ${RES_LABEL[m.r]}</td><td class="num"><b>${fmtNum(m.amt)}</b></td><td class="num">${m.carts}</td><td class="num">${dist(m.from, m.to).toFixed(1)}</td><td class="num">${fmtDur(m.mins * 60000)}</td><td class="num small">${fmtClock(m.arrive)}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">${t('Tidak ada yang perlu dikirim dengan batas sekarang.')}</p>`}
    </div>
    <div class="card cs-card"><h3>📦 ${t('Stok per kota (% kapasitas)')}</h3>
      <div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Kota')}</th>${RES.map((r) => `<th class="num">${RES_ICON[r]}</th>`).join('')}<th class="num">🛒 ${t('Gerobak')}</th></tr></thead><tbody>
      ${p.cities.map((c) => `<tr><td><b>${esc(c.name)}</b></td>${RES.map((r) => { const v = pct(c, r); return `<td class="num ${cls(v)}">${v == null ? '—' : v + '%'}</td>`; }).join('')}<td class="num">${p.cartsOf(c.key) ?? '?'}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="small muted">${t('Jumlah gerobak dihitung dari Marketplace di layout kota yang tersinkron ("?" = layout belum tersinkron, gerobak tidak dibatasi). Gerobak yang sedang dipakai tidak terlihat.')}</p>
    </div>`;
}

export function onInput(e, rerender) {
  const el = e.target;
  if (el.dataset.tr) { cfg[el.dataset.tr] = Math.max(0, Math.min(100, +el.value || 0)); persist(); rerender(); return true; }
  if (el.dataset.trr) { cfg.res[el.dataset.trr] = el.checked; persist(); rerender(); return true; }
  return false;
}
