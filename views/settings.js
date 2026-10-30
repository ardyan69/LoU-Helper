import { DEFAULT_UNITS, DEFAULT_SETTINGS, esc, fmtAgo, storageUsage, fmtBytes } from '../lib/shared.js';
import { t, LANGS, getLang } from '../lib/i18n.js';
import { applyTheme } from '../lib/theme.js';

let root, ctx;

export function mount(el, c) {
  root = el;
  ctx = c;
  root.addEventListener('change', onChange);
  root.addEventListener('click', onClick);
}

export function render(state) {
  const s = state.settings;
  const cur = s.lang || 'id';
  const gameLang = state.movements?.lang;
  root.innerHTML = `
    <div class="view-head"><div class="grow"><h2>${t('Pengaturan')}</h2><p>${t('Semua data disimpan lokal di browser ini (chrome.storage). Tidak ada yang dikirim ke server mana pun.')}</p></div></div>
    <div class="settings">
      <div class="card">
        <h3>🌐 ${t('Bahasa')}</h3>
        <p>${t('Bahasa tampilan extension (dashboard, popup, notifikasi). Nama bangunan tetap memakai nama dari game.')}</p>
        <div class="langs">${LANGS.map(([code, name]) => `
          <label class="lang ${cur === code ? 'on' : ''}">
            <input type="radio" name="lang" value="${code}" ${cur === code ? 'checked' : ''}>
            <span>${code === 'auto' ? `🎮 ${t('Ikuti bahasa game')}${gameLang ? ` <span class="muted small">(${esc(String(gameLang).toUpperCase())})</span>` : ''}` : esc(name)}</span>
          </label>`).join('')}
        </div>
        <p class="small muted" style="margin-top:8px">${t('Sedang dipakai: {l}', { l: `<b>${esc((LANGS.find(([c]) => c === getLang()) || [])[1] || getLang())}</b>` })}</p>
        <h3 style="margin-top:14px">🎨 ${t('Tema')}</h3>
        <div class="seg" id="s-theme">${[['dark', '🌙 ' + t('Gelap')], ['light', '☀️ ' + t('Terang')], ['auto', '🖥️ ' + t('Ikuti sistem')]].map(([k, l]) => `<button type="button" data-theme="${k}" class="${(s.theme || 'dark') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">${t('Pintasan: Ctrl+K (atau /) untuk mencari kota, pemain, dungeon & koordinat · Alt+1…0 untuk pindah tab.')}</p>
      </div>

      <div class="card">
        <h3>🔔 ${t('Notifikasi desktop')}</h3>
        <p>${t('Muncul walaupun tab game tidak sedang dibuka. Perkiraan dihitung dari data terakhir yang terbaca.')}</p>
        <label class="check"><input type="checkbox" data-k="alerts.full" ${s.alerts.full ? 'checked' : ''}> ${t('Gudang hampir penuh')}</label>
        <label class="check" style="padding-left:26px">${t('Ambang batas')} <input type="number" data-k="alerts.fullThreshold" min="50" max="100" value="${s.alerts.fullThreshold}"> %</label>
        <label class="check"><input type="checkbox" data-k="alerts.queue" ${s.alerts.queue ? 'checked' : ''}> ${t('Antrian bangunan selesai')}</label>
        <label class="check"><input type="checkbox" data-k="alerts.foodEmpty" ${s.alerts.foodEmpty ? 'checked' : ''}> ${t('Makanan akan habis (produksi negatif)')}</label>
        <label class="check"><input type="checkbox" data-k="alerts.incoming" ${s.alerts.incoming ? 'checked' : ''}> ⚠️ ${t('Serangan masuk ke kotaku')}</label>
        <label class="check"><input type="checkbox" data-k="alerts.training" ${s.alerts.training ? 'checked' : ''}> ${t('Antrian pelatihan pasukan selesai')}</label>
        <label class="check"><input type="checkbox" data-k="alerts.trade" ${s.alerts.trade ? 'checked' : ''}> ${t('Kiriman dagang tiba di tujuan')}</label>
        <button class="btn sm" id="s-test" style="margin-top:8px">${t('Kirim notifikasi tes')}</button>
      </div>

      <div class="card">
        <h3>👁 ${t('Pembacaan data dari game')}</h3>
        <p>${t('Extension membaca data yang sudah ada di halaman game, tanpa klik atau aksi otomatis. Hanya 🎩 Set Ministers → Terapkan ke game yang mengirim setelan minister, setelah kamu konfirmasi.')}</p>
        <label class="check"><input type="checkbox" data-k="capture.cities" ${s.capture.cities ? 'checked' : ''}> ${t('Baca resource, antrian &amp; daftar kota')}</label>
        <label class="check"><input type="checkbox" data-k="capture.dungeons" ${s.capture.dungeons ? 'checked' : ''}> ${t('Simpan dungeon/boss dari peta &amp; panel')}</label>
        <h3 style="margin-top:14px">📐 ${t('Perencana layout')}</h3>
        <p>${t('Bonus &amp; produksi memakai rumus resmi game (node +50%/+40%, cottage +3%/level, pengolahan +30–75%, danau +50% untuk farm). Batas bangunan diambil dari kota yang terhubung.')}</p>
        <h3 style="margin-top:14px">⚔️ Raid</h3>
        <label class="check">${t('Waktu persiapan + bongkar per raid')} <input type="number" data-k="raidOverheadMin" min="0" value="${s.raidOverheadMin}"> ${t('menit')}</label>
      </div>

      <div class="card">
        <div class="row"><h3 class="grow">${t('Unit')}</h3><button class="btn sm" data-reset="units">${t('Reset ke data game')}</button></div>
        <p>${t('Nilai default diambil dari data game Revival: daya angkut, kecepatan dasar (menit per field), dan kekuatan = serangan ÷ 50 (relatif terhadap 1 Berserker). Kecepatan nyata bisa berbeda karena bonus atau kecepatan server — pakai fitur kalibrasi di tab Dungeon.')}</p>
        <label class="check"><input type="checkbox" data-k="autoSpeed" ${s.autoSpeed !== false ? 'checked' : ''}> ${t('Kalibrasi menit/field otomatis dari pergerakan pasukan')}</label>
        <p class="small">${state.speedCal ? t('Terkalibrasi: faktor ×{f} dari {n} pergerakan · {a}', { f: state.speedCal.factor, n: state.speedCal.n, a: fmtAgo(state.speedCal.at) }) : t('Belum ada data: kirim pasukan (raid dll.) saat game terbuka, kalibrasi berjalan sendiri.')}</p>
        <table class="tbl-compact"><thead><tr><th>${t('Unit')}</th><th>${t('Daya angkut')}</th><th>${t('Menit/field')}</th><th>${t('Kekuatan')}</th></tr></thead>
        <tbody>${s.units.map((u, i) => `<tr>
          <td><input type="text" data-u="${i}.name" value="${esc(u.name)}"></td>
          <td><input type="number" data-u="${i}.carry" min="0" value="${u.carry}"></td>
          <td><input type="number" data-u="${i}.minPerField" min="0" step="0.01" value="${u.minPerField || ''}" placeholder="?"></td>
          <td><input type="number" data-u="${i}.power" min="0" step="0.01" value="${u.power}"></td></tr>`).join('')}</tbody></table>
      </div>

      <div class="card">
        <h3>💾 ${t('Data')}</h3>
        <p>${t('Cadangkan semua data (kota, dungeon, layout, catatan raid, pengaturan) ke file JSON.')}</p>
        <div class="row">
          <button class="btn" id="s-export">${t('Ekspor cadangan')}</button>
          <label class="btn">${t('Impor cadangan')}<input type="file" id="s-import" accept="application/json" hidden></label>
          <button class="btn danger" id="s-wipe">${t('Hapus semua data')}</button>
        </div>
        <h3 style="margin-top:14px">🗄️ ${t('Penyimpanan')}</h3>
        <p>${t('Riwayat statistik disimpan per jam selama 7 hari, lalu satu titik per hari sampai 60 hari. Kota pemain lain yang tidak terlihat di peta selama 90 hari dilupakan (catatanmu tetap ada).')}</p>
        <div id="s-storage" class="small muted">…</div>
        <button class="btn sm" id="s-compact" style="margin-top:8px">${t('Rapikan sekarang')}</button>
      </div>
    </div>`;
  showStorage();
}

// friendly names for the biggest storage keys
const KEY_LABEL = () => ({ history: t('Statistik'), players: t('Pemain'), cities: t('Kota'), movements: t('Pergerakan'), layouts: t('Perencana Layout'), dungeons: 'Dungeon & Boss', gameIcons: t('Ikon game'), attackLog: t('Riwayat serangan'), lootLog: t('Loot raid per hari') });
let storageBusy = false;
async function showStorage() {
  const el = root.querySelector('#s-storage');
  if (!el || storageBusy) return;
  storageBusy = true;
  try {
    const u = await storageUsage();
    const pct = u.quota ? Math.min(100, Math.round((u.total / u.quota) * 100)) : null;
    const color = pct == null ? 'var(--good)' : pct >= 90 ? 'var(--bad)' : pct >= 70 ? 'var(--warn)' : 'var(--good)';
    const L = KEY_LABEL();
    el.innerHTML = `
      <div>${u.quota ? t('Terpakai {a} dari {b} ({p}%)', { a: `<b>${fmtBytes(u.total)}</b>`, b: fmtBytes(u.quota), p: pct }) : t('Terpakai {a} · tanpa batas', { a: `<b>${fmtBytes(u.total)}</b>` })}</div>
      ${u.quota ? `<div class="bar" style="margin:6px 0"><i style="width:${pct}%;background:${color}"></i></div>` : ''}
      ${pct != null && pct >= 80 ? `<div style="color:var(--bad);margin:4px 0">⚠️ ${t('Penyimpanan hampir penuh — data baru bisa gagal tersimpan. Klik Rapikan sekarang, atau ekspor cadangan lalu hapus data lama.')}</div>` : ''}
      <div style="margin-top:4px">${u.keys.slice(0, 6).map(([k, n]) => `${esc(L[k] || k)} <b>${fmtBytes(n)}</b>`).join(' · ')}</div>`;
  } catch (e) {
    el.textContent = String(e);
  } finally { storageBusy = false; }
}

function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) o = o[k] = Array.isArray(o[k]) ? [...o[k]] : { ...o[k] };
  o[ks.at(-1)] = val;
}

async function onChange(e) {
  const el = e.target;
  const s = structuredClone(ctx.state.settings);
  if (el.name === 'lang') {
    s.lang = el.value;
    await ctx.save({ settings: s });
    location.reload(); // every view re-renders in the new language
    return;
  }
  const val = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
  if (el.dataset.k) setPath(s, el.dataset.k, val);
  else if (el.dataset.u) { const [i, k] = el.dataset.u.split('.'); s.units[+i] = { ...s.units[+i], [k]: val }; }
  else if (el.id === 's-import') return importFile(el.files[0]);
  else return;
  await ctx.save({ settings: s });
  ctx.toast(t('Tersimpan'));
}

async function onClick(e) {
  const el = e.target;
  const s = structuredClone(ctx.state.settings);
  if (el.closest('#s-theme [data-theme]')) {
    s.theme = el.closest('[data-theme]').dataset.theme;
    await ctx.save({ settings: s });
    applyTheme(s.theme);
    render(ctx.state);
    return;
  }
  if (el.id === 's-test') {
    chrome.runtime.sendMessage({ type: 'test-notification' });
  } else if (el.dataset.reset) {
    if (!confirm(t('Kembalikan ke nilai default?'))) return;
    s[el.dataset.reset] = structuredClone(DEFAULT_UNITS);
    await ctx.save({ settings: s });
    render(ctx.state);
  } else if (el.id === 's-export') {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify({ app: 'lou-helper', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lou-helper-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } else if (el.id === 's-compact') {
    el.disabled = true;
    try {
      const r = await chrome.runtime.sendMessage({ type: 'compact-storage' });
      if (r?.ok) ctx.toast(t('Dirapikan: {a} → {b}', { a: fmtBytes(r.before), b: fmtBytes(r.after) }));
    } finally { el.disabled = false; showStorage(); }
  } else if (el.id === 's-wipe') {
    if (!confirm(t('Hapus SEMUA data LoU Helper? Ini tidak bisa dibatalkan.'))) return;
    const lang = ctx.state.settings.lang;
    await chrome.storage.local.clear();
    await chrome.storage.local.set({ settings: { ...structuredClone(DEFAULT_SETTINGS), lang } });
    location.reload();
  }
}

async function importFile(file) {
  if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    const data = j.app === 'lou-helper' ? j.data : j;
    // everything the export contains except live game data (it is read again from the game)
    const allowed = ['cities', 'dungeons', 'raids', 'layouts', 'layoutFocus', 'settings', 'speedCal', 'history', 'lootLog', 'dungeonGains', 'attackLog', 'players', 'playerNotes', 'gameIcons'];
    const clean = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
    if (!Object.keys(clean).length) throw new Error('empty');
    if (!confirm(t('Impor {k}? Data yang sama akan ditimpa.', { k: Object.keys(clean).join(', ') }))) return;
    await chrome.storage.local.set(clean);
    location.reload();
  } catch {
    ctx.toast(t('File cadangan tidak valid'));
  }
}

export function onData(state, keys) {
  // re-render only when settings changed from elsewhere and the user isn't typing here
  if ((keys.includes('settings') || keys.includes('speedCal')) && root.classList.contains('on') && !root.contains(document.activeElement)) render(state);
}
