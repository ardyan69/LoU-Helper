// "ℹ️ Tentang → 🩺 Diagnostik": is every source of game data still read correctly? (after a game update, this
// shows which part broke) — with a report to copy into a bug report.
import { esc, fmtAgo } from '../lib/shared.js';
import { t, getLang } from '../lib/i18n.js';
import { diagnose, verdict } from '../lib/diagnose.js';
import { CREDIT } from '../lib/changelog.js';

const GAME = 'https://lordofultima.me/';
let el = null, last = null;

const LABEL = () => ({
  hook: t('Pembaca state game (page hook)'), shape: t('Struktur state game'), cities: t('Data kota'),
  movements: t('Pergerakan & pelatihan'), layouts: t('Layout kota'), map: t('Peta (dungeon & pemain)'),
  resourceBar: t('Resource bar (kapasitas & produksi/jam)'), queuePanel: t('Panel Construction'),
  cityList: t('Daftar kota (Your cities)'), dungeonPanel: t('Panel dungeon/boss'), icons: t('Ikon game'),
  storage: t('Penyimpanan'), errors: t('Error')
});
// what to do in the game so a source gets (re)read — shown for every row that is not OK
const HOW = () => ({
  hook: t('Buka game di tab browser ini dan login. Kalau tab game sudah terbuka, refresh (F5) lalu tunggu sampai kota tampil.'),
  shape: t('Biasanya karena game baru di-update. Refresh tab game (F5); kalau tetap, salin laporan dan kirim ke pengembang.'),
  cities: t('Buka game — data kota terbaca otomatis. Klik nama kota di kiri atas sekali supaya semua kota tercatat.'),
  movements: t('Terbaca otomatis selama game terbuka. Kalau tetap kosong, refresh tab game (F5).'),
  layouts: t('Terbaca otomatis untuk semua kota selama game terbuka. Kalau tetap kosong, buka tampilan kota sekali.'),
  map: t('Buka peta Region di game dan geser sedikit; dungeon, boss dan kota pemain di sekitar ikut tercatat.'),
  resourceBar: t('Buka tampilan kota di game (bukan peta Region/World): resource bar di atas dibaca dari situ.'),
  queuePanel: t('Opsional: buka panel Construction (antrian bangunan) sekali per kota.'),
  cityList: t('Opsional: klik nama kota di kiri atas game untuk membuka daftar Your cities.'),
  dungeonPanel: t('Opsional: di peta Region, klik ikon dungeon atau boss.'),
  icons: t('Buka Build bar, Guide dan Town Hall sekali di game; ikonnya tersimpan otomatis.'),
  storage: t('Penyimpanan extension gagal. Tutup tab yang tidak perlu dan restart browser; kalau tetap, Ekspor cadangan lalu Hapus semua data di Pengaturan.'),
  errors: t('Refresh tab game (F5). Kalau error muncul lagi, salin laporan dan kirim ke pengembang.')
});
const STATUS = () => ({ ok: ['good', 'OK'], warn: ['warn', t('Perhatian')], bad: ['bad', t('Masalah')], idle: ['', t('Belum dipakai')] });

function detail(r) {
  const d = r.detail;
  if (d == null) return '';
  if (typeof d === 'string') {
    return {
      'no-tab': t('Tab game tidak terbuka.'),
      'no-answer': t('Tidak ada jawaban dari halaman game — refresh tab game (F5).'),
      'city-view': t('State utama game tidak ditemukan; hanya kota yang sedang terbuka yang terbaca.'),
      'not-found': t('State game tidak ditemukan — login dulu, atau update game mengubah strukturnya.'),
      lost: t('State game sempat terbaca, sekarang tidak — refresh tab game (F5).'),
      never: t('Belum ada data.'),
      'open-region': t('Buka peta Region sekali.'),
      unreadable: t('Tidak terbaca — tampilan game mungkin berubah.'),
      'not-opened': t('Belum dibuka (opsional).'),
      'no-city-view': t('Buka tampilan kota di game.')
    }[d] || d;
  }
  if (r.id === 'hook') return `v${d.v}${d.mutable ? ` · ${t('mode lengkap')}` : ''}`;
  if (r.id === 'shape') return t('Tidak ditemukan: {x} — kemungkinan update game.', { x: d.missing.join(', ') });
  if (r.id === 'map') return t('{n} dungeon/boss dikenal', { n: d.dungeons });
  if (r.id === 'icons') return `${d.n}/28${d.n < 28 ? ` · ${t('Buka Build bar, Guide & Town Hall sekali.')}` : ''}`;
  if (r.id === 'storage') return d.err || '';
  if (r.id === 'errors') return d.list.join(' · ');
  if (d.cities != null) return t('{n} kota tersimpan', { n: d.cities });
  if (d.n != null) return t('{n} pembacaan', { n: d.n });
  return '';
}

async function collect() {
  let tab = null, tabs = [];
  try { tabs = await chrome.tabs.query({ url: GAME + '*' }); } catch (_) { /* no access */ }
  for (const tb of tabs) {
    try {
      const r = await chrome.tabs.sendMessage(tb.id, { type: 'lou-diag' });
      if (r?.ok) { tab = r; break; }
    } catch (_) { /* no content script in that tab */ }
  }
  const stored = await chrome.storage.local.get(['cities', 'movements', 'layouts', 'gameIcons']);
  return { tab, tabsOpen: tabs.length, stored, at: Date.now() };
}

const AUTO_S = 5; // re-check while the panel is open, so doing the hint in the game updates the status
let timer = null;
export async function render(target, quiet = false) {
  el = target || el;
  if (!el) return;
  if (!quiet) el.innerHTML = `<div class="card small muted">${t('Memeriksa…')}</div>`;
  last = await collect();
  if (!el.isConnected) return;
  draw();
  clearTimeout(timer);
  timer = setTimeout(tick, AUTO_S * 1000);
}
// only while this panel is shown (About → Diagnostics open); skipped while the dashboard tab is hidden
function tick() {
  if (!el?.isConnected || !el.querySelector('#dg-again')) return;
  if (el.offsetParent && document.visibilityState === 'visible') render(el, true);
  else timer = setTimeout(tick, AUTO_S * 1000);
}

function draw() {
  const { tab, tabsOpen, stored } = last;
  const rows = diagnose({ tab, stored });
  const v = verdict(rows);
  const L = LABEL(), S = STATUS(), H = HOW();
  const head = !tab
    ? (tabsOpen ? t('Tab game terbuka tapi tidak menjawab — refresh tab game (F5), lalu periksa lagi.') : t('Tab game tidak terbuka. Buka game lalu periksa lagi — di bawah ini data terakhir yang tersimpan.'))
    : v === 'ok' ? t('Semua sumber data terbaca dengan baik.')
      : v === 'warn' ? t('Data utama terbaca; beberapa detail perlu perhatian.')
        : t('Ada sumber data yang tidak terbaca. Kalau game baru di-update, kirim laporan ini ke pengembang.');
  el.innerHTML = `
    <div class="about">
      <div class="card">
        <div class="row" style="gap:10px;flex-wrap:wrap">
          <h3 class="grow" style="margin:0">🩺 ${t('Diagnostik')} <span class="pill ${S[v][0]}">${S[v][1]}</span></h3>
          <button class="btn sm" id="dg-again">🔄 ${t('Periksa lagi')}</button>
          <button class="btn sm" id="dg-copy">📋 ${t('Salin laporan')}</button>
          <a class="btn sm" id="dg-mail" href="#" style="text-decoration:none">✉️ ${t('Kirim ke pengembang')}</a>
          ${!tabsOpen ? `<a class="btn sm primary" href="${GAME}" target="_blank">${t('Buka game')}</a>` : ''}
        </div>
        <p class="small" style="margin-top:8px">${head}</p>
        <p class="small muted">${[
          `LoU Helper v${esc(chrome.runtime.getManifest().version)}`,
          tab?.hook ? `page hook v${esc(tab.hook.v)}` : null,
          tab?.gameLang ? `${t('Bahasa game')}: ${esc(String(tab.gameLang).toUpperCase())}` : null,
          tab ? (tab.visible ? t('tab game terlihat') : t('tab game di latar belakang')) : null,
          tab ? t('{n} kota', { n: tab.ownCities }) : null
        ].filter(Boolean).join(' · ')}</p>
      </div>
      <div class="card">
        <div class="tbl-wrap"><table class="cs-tbl"><thead><tr><th>${t('Sumber data')}</th><th>${t('Status')}</th><th>${t('Terakhir')}</th><th>${t('Keterangan')}</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td><b>${esc(L[r.id] || r.id)}</b></td><td><span class="pill ${S[r.status][0]}">${S[r.status][1]}</span></td>
            <td class="small muted">${r.at ? esc(fmtAgo(r.at)) : '—'}</td><td class="small" style="white-space:normal">${esc(detail(r))}${r.status !== 'ok' && H[r.id] ? `<div class="dg-how">👉 ${esc(H[r.id])}</div>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="dg-legend small">
          <b>${t('Cara memperbarui status')}</b>
          <ul>
            <li><span class="pill">${S.idle[1]}</span> ${t('= sumber itu belum terbaca sejak tab game dibuka. Ini bukan error: lakukan petunjuk 👉 di barisnya di dalam game, lalu kembali ke sini.')}</li>
            <li><span class="pill warn">${S.warn[1]}</span> / <span class="pill bad">${S.bad[1]}</span> ${t('= ikuti petunjuk 👉; biasanya cukup refresh tab game (F5).')}</li>
            <li>${t('Halaman ini memeriksa ulang otomatis tiap {n} detik selama terbuka, atau klik 🔄 Periksa lagi.', { n: AUTO_S })}</li>
          </ul>
        </div>
        <p class="small muted" style="margin-top:8px">${t('Data utama (kota, pergerakan, layout) dibaca dari state game dan tidak bergantung pada bahasa. Panel yang ditandai opsional hanya menambah detail saat kamu membukanya di game.')}</p>
      </div>
    </div>`;
  el.querySelector('#dg-again').onclick = () => render();
  el.querySelector('#dg-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(report(rows)); flash(el.querySelector('#dg-copy'), '✅ ' + t('Tersalin')); } catch (_) { prompt(t('Salin laporan'), report(rows)); }
  };
  el.querySelector('#dg-mail').onclick = (e) => {
    e.preventDefault();
    const body = report(rows);
    location.href = `mailto:${CREDIT.email}?subject=${encodeURIComponent(`LoU Helper v${chrome.runtime.getManifest().version} — ${t('Diagnostik')}`)}&body=${encodeURIComponent(body.length > 1800 ? body.slice(0, 1800) + '\n…' : body)}`;
  };
}

function flash(btn, txt) { const o = btn.textContent; btn.textContent = txt; setTimeout(() => { btn.textContent = o; }, 1500); }

// plain-text report (status table + the raw readings, without game data like resources or city names)
export function report(rows) {
  const { tab } = last;
  const L = LABEL(), S = STATUS();
  const lines = [
    `LoU Helper v${chrome.runtime.getManifest().version} — ${t('Diagnostik')} — ${new Date(last.at).toISOString()}`,
    `UI: ${getLang()} · game: ${tab?.gameLang || '?'} · ${tab?.ua || navigator.userAgent}`,
    '',
    ...rows.map((r) => `[${S[r.status][1]}] ${L[r.id] || r.id}${r.at ? ` (${fmtAgo(r.at)})` : ''}${detail(r) ? ` — ${detail(r)}` : ''}`),
    '',
    'hook: ' + JSON.stringify(tab?.hook || null),
    'readers: ' + JSON.stringify(tab?.diag?.readers || null),
    'messages: ' + JSON.stringify(Object.fromEntries(Object.entries(tab?.diag?.msgs || {}).map(([k, m]) => [k, m.n]))),
    'storage: ' + JSON.stringify(tab?.diag?.storage || null),
    'capture: ' + JSON.stringify(tab?.capture || null)
  ];
  return lines.join('\n');
}
