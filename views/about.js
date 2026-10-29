// "ℹ️ Tentang" — ReadMe, Credit, Change Log.
import { esc } from '../lib/shared.js';
import { CHANGELOG, CREDIT } from '../lib/changelog.js';
import { t } from '../lib/i18n.js';

let root, part = 'readme';
const version = () => chrome.runtime.getManifest().version;

export function mount(el) {
  root = el;
  root.innerHTML = `
    <div class="view-head">
      <div class="grow"><h2>${t('Tentang LoU Revival Helper')}</h2><p>${t('Versi')} <b>${esc(version())}</b></p></div>
      <div class="seg" id="a-seg">
        <button data-part="readme">📖 ReadMe</button>
        <button data-part="credit">🙏 ${t('Credit')}</button>
        <button data-part="changelog">📝 Change Log</button>
      </div>
    </div>
    <div id="a-body"></div>`;
  root.querySelector('#a-seg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-part]');
    if (b) { part = b.dataset.part; render(); }
  });
}

export function render() {
  if (!root) return;
  root.querySelectorAll('#a-seg [data-part]').forEach((b) => b.classList.toggle('on', b.dataset.part === part));
  root.querySelector('#a-body').innerHTML = part === 'credit' ? credit() : part === 'changelog' ? changelog() : readme();
}

function readme() {
  return `<div class="about">
    <div class="card">
      <h3>${t('Apa ini?')}</h3>
      <p>${t('Chrome extension pembantu untuk <b>Lord of Ultima: Revival</b> (<a href="https://lordofultima.me/" target="_blank">lordofultima.me</a>). Semua data dibaca dari game yang sedang kamu buka — tanpa input manual.')}</p>
    </div>
    <div class="about-grid">
      <div class="card"><h3>🏰 ${t('Ringkasan Kota')}</h3><ul>
        <li>${t('Resource, kapasitas &amp; produksi per jam semua kota.')}</li>
        <li>${t('Kapan gudang ≥95% penuh / makanan habis, status antrian bangunan.')}</li>
        <li>${t('Tampilan Kartu, Tabel list, atau Tabel detail.')}</li></ul></div>
      <div class="card"><h3>📐 ${t('Perencana Layout')}</h3><ul>
        <li>${t('Peta 21×21 identik dengan game; layout semua kota tersinkron otomatis dengan level asli.')}</li>
        <li>${t('Produksi dihitung dengan rumus game, heatmap petak terbaik, bandingkan rencana.')}</li>
        <li>${t('🧠 Rekomendasi penempatan otomatis (opsional hapus node).')}</li>
        <li>${t('Impor/ekspor share string → <i>City planner → Plans &amp; share → Import</i>.')}</li></ul></div>
      <div class="card"><h3>🚩 ${t('Pergerakan')}</h3><ul>
        <li>${t('Semua pasukan bergerak, misi, muatan &amp; hitung mundur.')}</li>
        <li>${t('⚠️ Serangan masuk + notifikasi desktop.')}</li>
        <li>${t('Konvoi dagang/Market dan antrian pelatihan pasukan.')}</li></ul></div>
      <div class="card"><h3>⚔️ Dungeon &amp; Boss</h3><ul>
        <li>${t('Semua dungeon/boss di peta Region tersimpan otomatis.')}</li>
        <li>${t('Jarak ke kota terdekat, kalkulator raid, statistik loot.')}</li></ul></div>
    </div>
    <div class="about-grid">
      <div class="card"><h3>${t('Cara pasang / update')}</h3><ol>
        <li>${t('Ekstrak ZIP, buka <code>chrome://extensions</code>, nyalakan <b>Developer mode</b>.')}</li>
        <li>${t('<b>Load unpacked</b> → pilih folder <code>lou-helper</code> (update: timpa folder lalu klik ↻).')}</li>
        <li>${t('Pin ikon kastil di toolbar, lalu buka game.')}</li></ol></div>
      <div class="card"><h3>${t('Tips')}</h3><ul>
        <li>${t('Buka <b>Build bar</b>, <b>Guide → Your city &amp; the grid</b>, dan klik <b>Town Hall</b> sekali agar ikon game lengkap.')}</li>
        <li>${t('Notifikasi diatur di tab ⚙️ Pengaturan.')}</li>
        <li>${t('Cadangkan data lewat Pengaturan → Ekspor cadangan.')}</li></ul></div>
      <div class="card"><h3>🔒 ${t('Keamanan &amp; privasi')}</h3><ul>
        <li>${t('Hanya <b>membaca</b> data yang sudah ada di halaman game — tidak mengklik, tidak mengirim perintah, tidak mengotomasi aksi.')}</li>
        <li>${t('Semua data disimpan lokal di browser (chrome.storage); tidak ada yang dikirim ke server lain.')}</li></ul></div>
    </div>
  </div>`;
}

function credit() {
  return `<div class="about">
    <div class="card credit">
      <img src="icons/icon128.png" alt="" width="72" height="72">
      <div>
        <div class="small muted">${t('Dibuat oleh')}</div>
        <h3 style="font-size:24px;margin:2px 0">${esc(CREDIT.name)}</h3>
        <div>📧 <a href="mailto:${esc(CREDIT.email)}">${esc(CREDIT.email)}</a></div>
        <p class="small muted" style="margin-top:10px">${t('Saran, laporan bug, atau ide fitur? Kirim email ke alamat di atas — sertakan versi extension ({v}).', { v: `<b>${esc(version())}</b>` })}</p>
      </div>
    </div>
    <div class="card">
      <h3>${t('Catatan')}</h3>
      <p class="small">${t('LoU Revival Helper adalah alat buatan pemain dan <b>tidak berafiliasi</b> dengan pengembang <i>Lord of Ultima: Revival</i>. Nama game, ikon bangunan, dan aset lainnya adalah milik pemiliknya masing-masing; ikon hanya ditampilkan dari game yang terbuka di browsermu dan tidak didistribusikan bersama extension ini.')}</p>
    </div>
  </div>`;
}

function changelog() {
  const cur = version();
  return `<div class="about">${CHANGELOG.map((r) => `
    <div class="card cl">
      <div class="row"><h3>v${esc(r.v)}</h3>${r.v === cur ? `<span class="pill good">${t('terpasang')}</span>` : ''}<span class="grow"></span><span class="small muted">${esc(r.date)}</span></div>
      <ul>${r.items.map((i) => `<li>${esc(t(i))}</li>`).join('')}</ul>
    </div>`).join('')}</div>`;
}
