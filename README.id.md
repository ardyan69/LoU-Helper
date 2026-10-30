# LoU Revival Helper (extension browser: Chrome · Edge · Firefox · Safari)

🇮🇩 Bahasa Indonesia · [English](README.md)

Versi 1.24.2 · dibuat oleh **ardhie** · ardhie.andro@gmail.com

Alat bantu untuk **Lord of Ultima: Revival** (lordofultima.me):

1. **Ringkasan Kota**: resource, kapasitas, produksi/jam, kapan gudang penuh atau makanan habis, dan status antrian bangunan semua kota. Dilengkapi notifikasi desktop dan rencana **🔁 Transfer** yang menyarankan kiriman resource antar-kota (jumlah, gerobak, waktu tempuh).
2. **Perencana Layout**: peta 21×21 yang sama dengan game (tembok, menara, jalan, Town Hall, kota air). Produksinya dihitung dengan rumus resmi game. Layout kota yang sedang aktif tersinkron otomatis dari game, lengkap dengan level asli dan antrian bangunan (share string dari City planner juga diterima). Ada **🧠 Rekomendasi** (optimizer yang menyusun bangunan produksi, pengolahan & Cottage di sekitar node alam untuk produksi terbesar: kayu/batu/besi/makanan maksimal, seimbang, atau rasio kustom; opsional boleh menghapus node alam bila tiap node menambah produksi di atas ambang), heatmap "petak terbaik", perbandingan rencana vs kota (apa yang perlu dibangun/dibongkar), level per bangunan, **📋 langkah pembangunan** (apa yang dibongkar/dibangun/di-upgrade, berurutan, dengan biaya & waktu), **🧩 template** (kota militer dengan recruit speed maksimal untuk satu kelompok unit dan target troop space, hub gudang/dagang, ekonomi), **⚖️ perbandingan berdampingan** dua rencana, undo/redo, dan ekspor share string yang bisa langsung di-*Import* di game.
3. **Pergerakan**: semua pasukan yang bergerak (raid/return/attack/support…, muatan, hitung mundur), ⚠️ serangan masuk (notifikasi desktop), konvoi dagang/Market (keluar, kembali, kiriman masuk), dan antrian pelatihan pasukan + pasukan di tiap kota.
4. **Dungeon & Boss**: semua dungeon/boss yang dimuat peta Region tersimpan otomatis (level & explored %); guardians/max loot terisi saat panelnya dibuka. Ada filter, jarak ke kota terdekat, kalkulator raid (unit angkut, waktu tempuh, loot per jam), dan catatan/statistik raid. **🎯 Raid Planner**: pilih kota, lalu dapatkan dungeon terdekat yang cocok dengan pasukannya, jumlah pasukan per dungeon (rumus Revival), loot per jam, dan berapa raid sampai explored 100% — pasukan dibagi otomatis. Daftar dungeon menandai yang sedang diraid, perkiraan explored % terkini, dan skor ⭐ prioritas.
5. **📈 Statistik**: loot raid per hari & per kota, produksi total, skor, dan pasukan per kota dari waktu ke waktu (dicatat tiap jam).
6. **👥 Pemain**: pemain & aliansi yang terlihat di peta, status hubungan & catatan, serta riwayat serangan masuk per pemain.
7. **📜 Cheat Sheet**: tab *Dungeons*, *Bosses*, *Recruit %*, *Troops Stats*, dan *Layouts* (layout kota militer Land & Sea/Water). Isinya jumlah pasukan minimum/rekomendasi untuk tiap tipe & level dungeon dan boss (dihitung dari rumus game Revival, termasuk Explored %), kalkulator raid & boss (kerugian, loot, peluang kill), kecepatan rekrut per unit (recruit speed % kota terisi otomatis dari layout yang tersinkron), dan statistik semua unit. **🧱 Buildings** (biaya & waktu bangun tiap level dengan kecepatan bangun kotamu) dan **⚔️ Battle** (simulator serangan/pertahanan dengan aturan game). Tabel cheat sheet komunitas (LoU klasik) juga tersedia sebagai referensi.
8. **🎯 Operasi**: perencana serangan (jam kirim supaya gelombang tiba bersamaan, cek benua/Frigate) dan asisten bertahan (kota yang masih sempat membantu, perkiraan pertempuran). **🎩 Set Ministers**: setelan Build, Defense, War & Trade minister semua kota di satu layar, dengan rekomendasi dan tombol *Terapkan ke game*.

## Pratinjau

**Ringkasan Kota — tabel list**

![Ringkasan Kota — tabel list](docs/screenshots/city-overview.png)

**Perencana Layout — layout kota tersinkron dari game dengan level asli**

![Perencana Layout — layout kota tersinkron dari game dengan level asli](docs/screenshots/layout-planner.png)

**Pergerakan & Pelatihan**

![Pergerakan & Pelatihan](docs/screenshots/movements.png)

## Cara pasang

Tiap browser punya paket sendiri (semuanya dibangun dari kode sumber yang sama, lihat *Pengembangan*):

| Browser | File | Versi minimal |
|---|---|---|
| Google Chrome (juga Brave, Opera, Vivaldi) | `lou-helper-<versi>-chrome.zip` | Chrome 111 |
| Microsoft Edge | `lou-helper-<versi>-edge.zip` | Edge 111 |
| Mozilla Firefox | `lou-helper-<versi>-firefox.xpi` | Firefox 128 |
| Apple Safari (macOS) | `lou-helper-<versi>-safari.zip` | Safari 17 + Xcode |

Setelah terpasang di browser mana pun: pin ikon kastil di toolbar, lalu buka (atau refresh) tab game. Dashboard dibuka lewat popup extension.

### Google Chrome
1. Ekstrak `lou-helper-<versi>-chrome.zip` ke sebuah folder.
2. Buka `chrome://extensions`, lalu nyalakan **Developer mode** (pojok kanan atas).
3. Klik **Load unpacked**, lalu pilih folder hasil ekstrak (yang berisi `manifest.json`).
4. Klik ikon puzzle 🧩 → pin **LoU Revival Helper**.

Update: timpa folder dengan versi baru, lalu klik ↻ pada kartu extension.

### Microsoft Edge
1. Ekstrak `lou-helper-<versi>-edge.zip` ke sebuah folder.
2. Buka `edge://extensions`, lalu nyalakan **Developer mode** (sidebar kiri, atau kiri bawah).
3. Klik **Load unpacked**, lalu pilih folder hasil ekstrak.
4. Klik ikon puzzle 🧩 → ikon mata di samping **LoU Revival Helper** supaya tampil di toolbar.

Update: timpa folder, lalu klik **Reload** pada kartu extension. Kalau saat Edge dibuka muncul peringatan "matikan extension mode developer", pilih tetap pakai.

### Mozilla Firefox
Firefox hanya memasang add-on secara permanen bila sudah ditandatangani Mozilla.

**Mencoba (sementara, hilang saat Firefox ditutup)**
1. Buka `about:debugging#/runtime/this-firefox`.
2. Klik **Load Temporary Add-on…**, lalu pilih `lou-helper-<versi>-firefox.xpi` (atau `manifest.json` di dalam folder `firefox` hasil ekstrak).

**Pasang permanen**
- *.xpi bertanda tangan (disarankan):* tanda tangani paketnya sekali sebagai add-on unlisted (distribusi sendiri) di [addons.mozilla.org](https://addons.mozilla.org/developers/) — atau dengan `npx web-ext sign --channel=unlisted --source-dir dist/firefox --api-key … --api-secret …` — lalu seret `.xpi` yang sudah ditandatangani ke jendela Firefox dan klik **Add**.
- *Khusus Firefox Developer Edition / Nightly / ESR:* ubah `xpinstall.signatures.required` menjadi `false` di `about:config`, lalu `about:addons` → ⚙️ → **Install Add-on From File…** → pilih file `.xpi`.

**Izinkan akses ke game (wajib).** Firefox tidak otomatis memberi akses ke website. Klik ikon extension lalu tekan **Izinkan akses ke lordofultima.me**, atau buka `about:addons` → LoU Revival Helper → **Permissions** dan nyalakan *lordofultima.me*. Lalu refresh tab game.

Update: muat/pasang `.xpi` versi baru (add-on sementara: klik **Reload** di `about:debugging`).

### Apple Safari (macOS)
Safari hanya menjalankan extension yang dibungkus dalam app macOS, jadi app itu dibangun sekali dengan Xcode (gratis, dari Mac App Store).

1. Ekstrak `lou-helper-<versi>-safari.zip` ke sebuah folder, mis. `~/lou-helper-safari`.
2. Di Terminal jalankan:
   ```sh
   xcrun safari-web-extension-converter ~/lou-helper-safari --app-name "LoU Revival Helper" --bundle-identifier id.ardhie.louhelper --macos-only
   ```
   Xcode akan membuka proyek yang dibuat.
3. Di Xcode pilih target app → **Signing & Capabilities** → pilih **Team** (*Personal Team* gratis pun bisa), lalu **Product → Run** (⌘R). App kecil pembantunya akan terbuka; boleh ditutup.
4. Di Safari: **Settings → Advanced** → nyalakan **Show features for web developers** (Safari lama: *Show Develop menu in menu bar*), lalu **Develop → Allow Unsigned Extensions** (perlu diulang setiap Safari dibuka ulang, kecuali app ditandatangani dengan akun developer berbayar).
5. **Settings → Extensions** → centang **LoU Revival Helper**, lalu di *Edit Websites* atur **lordofultima.me** menjadi **Allow**.
6. Refresh tab game.

Notifikasi desktop (gudang penuh, serangan masuk) tidak tersedia di Safari — peringatannya tetap tampil di dashboard dan popup. Update: ganti isi folder, jalankan converter lagi (atau cukup **Product → Run** di proyek yang sudah ada setelah menyalin file baru ke dalamnya).

## Cara pakai
- **Data kota:** buka game dan pindah ke tiap kota sekali. Buka juga daftar kota (klik nama kota di kiri atas) supaya semua kota tercatat.
- **Jam selesai antrian:** buka panel *Construction* sekali per kota.
- **Dungeon:** tab *Region*, lalu klik ikon dungeon atau boss. Akan muncul pesan kecil "Disimpan".
- **Layout kota:** otomatis untuk semua kota sekaligus. Layout-nya muncul di Perencana Layout sebagai "🏰 nama kota — kondisi di game" (hanya-baca). Klik *Duplikat* untuk membuat rencana yang bisa diedit.
- **Pencarian & pintasan:** Ctrl+K / ⌘K atau `/` mencari kota, pemain, dungeon, koordinat, layout dan menu; Alt+1…0 untuk pindah tab. Tema (gelap / terang / ikuti sistem): Pengaturan.
- **Stok kota:** game menyimpan stok tiap kota pada satu waktu lalu menambah produksi/jam sendiri; Ringkasan Kota melakukan hal yang sama. *Update* menunjukkan kapan stok terakhir persis (↗ = diproyeksikan sejak itu); ≈ = produksi/jam dihitung dari layout kota karena kota itu belum dibuka di game.
- **To-do & Timeline:** *To-do* berisi yang perlu dikerjakan sekarang di semua kota (serangan, makanan, gudang penuh, antrian kosong, pasukan menganggur, dungeon yang sudah habis); 💤 menyembunyikan item selama 1 atau 8 jam. *Timeline* menampilkan serangan masuk, pasukan sendiri, gerobak/kapal dagang, antrian bangun dan rekrut semua kota dalam satu sumbu waktu.
- **Penyerang tersembunyi:** kalau unit serangan masuk tidak terlihat, Pergerakan dan notifikasi menebak jenis unitnya dari kecepatan pasukan (menit per field).
- **Aktivitas pemain:** tab Pemain menyimpan skor total tiap pemain dari waktu ke waktu (dari peta) dan menandai pemain aktif / tidak aktif; urutkan dengan *Target* untuk melihat pemain tidak aktif terdekat lebih dulu.
- Dashboard bisa dibuka lewat popup ikon extension, atau klik kanan ikon lalu pilih *Options* (Firefox: *Manage Extension* → *Preferences*).

## Bahasa
Pengaturan → 🌐 Bahasa: Bahasa Indonesia, English, Español, Français, Deutsch, Italiano, Magyar, Ελληνικά, atau **Ikuti bahasa game** (otomatis memakai bahasa yang dipilih di game). Nama bangunan & istilah game tetap memakai nama dari game.

## Ikon bangunan
Ikon bangunan di Perencana Layout diambil dari game setiap kali game menampilkannya (tampilan kota, **Build bar**, **Guide → Your city & the grid** untuk node alam, panel bangunan) — dikenali lewat kunci ikon milik game, jadi di bahasa game apa pun. Ikon disimpan lokal di browser (tidak dibundel di extension); sebelum tertangkap, emoji dipakai sebagai cadangan.

## Keamanan
Extension ini **membaca** data yang sudah ada di halaman game (teks di layar dan data kota milik game). Extension tidak mengklik apa pun dan tidak mengotomasi permainan. Ada satu pengecualian, dan hanya terjadi saat kamu klik dan mengonfirmasi: **🎩 Set Ministers → Terapkan ke game** mengirim setelan minister (Build, Defense, War, Trade, serta menyalakan/mematikan minister) memakai perintah yang sama dengan layar Ministers di game. Tidak ada hal lain yang dikirim ke game. Semua data disimpan lokal di penyimpanan extension browser kamu (`chrome.storage` / `browser.storage`).

## Catatan
- Layout dari share string tidak membawa level (dianggap level 10); layout sinkron otomatis memakai level asli. Bonus riset diperkirakan dari produksi nyata kota.
- Daya angkut, kecepatan dasar, dan kekuatan unit di Pengaturan diambil dari data game Revival. Menit/field dikalibrasi otomatis dari pergerakan pasukanmu (bisa dimatikan di Pengaturan).
- Emas di Revival dihitung per akun (setiap kota menampilkan total semua kota), jadi tidak dijumlahkan per kota.
- Data kota dibaca tanpa bergantung bahasa game: resource, antrian, dan pasukan semua kota dari data game; produksi/jam & kapasitas dari resource bar kota aktif.
- Kalau game berubah (update), **ℹ️ Tentang → 🩺 Diagnostik** menunjukkan sumber data mana yang tidak lagi terbaca (state game, data kota, pergerakan, layout, peta, resource bar, panel, ikon, penyimpanan) dan bisa menyalin laporan untuk email bug. Pembacanya ada di dua tempat: `page-hook.js` membaca state game (blok *GAME STATE* di atasnya mendaftar semua field yang dipakai) dan `lib/game-dom.js` membaca halaman (semua selector, beberapa label bahasa Inggris, dan parser), diuji dengan contoh HTML game di `tests/fixtures/`.

## Pengembangan
Node 20+ (`.nvmrc`). Folder sumbernya sendiri sudah berupa extension Chrome/Edge (bisa langsung *Load unpacked*, tanpa build); Firefox dan Safari butuh langkah build kecil.

- `npm install` — sekali saja (esbuild, web-ext, ESLint, TypeScript, linkedom untuk tes).
- `npm run check` — semua yang dijalankan CI: `npm run lint` (ESLint), `npm run typecheck` (TypeScript memeriksa JavaScript di `lib/` dan `background.js` lewat JSDoc, tidak ada yang dikompilasi) dan `npm test`.
- `npm test` — tes rumus game (produksi, kapasitas, troop space, recruit %), template layout, urutan bangun, operasi & minister, notifikasi & riwayat, pembaca halaman game (terhadap HTML di `tests/fixtures/`), data dungeon/boss dan diagnostik, cek terjemahan, dan memastikan semua file hasil generate sudah terbaru.
- `npm run build` — membangun `dist/chrome`, `dist/edge`, `dist/firefox` dan `dist/safari` beserta `dist/lou-helper-<versi>-<browser>.zip` (Firefox: `.xpi`). Satu browser saja: `node tools/build.mjs firefox`.
- `npm run lint:firefox` — mengecek paket Firefox dengan linter Mozilla.

**Terjemahan.** Teks UI ditulis dalam bahasa Indonesia di kode, `t('Teks')`, dan teks itu menjadi key di setiap `lib/i18n/<bahasa>.js`. `npm run i18n -- check` menampilkan terjemahan yang hilang, terjemahan yang `{placeholder}` atau `<tag>`-nya berbeda, dan — bila sebuah teks diubah kata-katanya di kode — key lamanya beserta perintah rename yang tepat. `npm run i18n -- rename "<lama>" "<baru>"` mengganti sebuah teks di semua kamus dan di kode sekaligus (terjemahan tetap); `npm run i18n -- unused` / `prune --yes` menampilkan / menghapus key yang tidak terpakai.

**File hasil generate** (`npm run docs`, juga bagian dari `npm run build`): versi di `manifest.json`, `package.json` dan README diambil dari entri teratas `lib/changelog.js`; `CHANGELOG.md`/`CHANGELOG.id.md`, `_locales/<bahasa>/messages.json` (nama & deskripsi extension di toko sesuai bahasa browser, dari `lib/meta.js`) dan `lib/i18n/content-dict.js` ditulis dari sumbernya. `npm test` gagal bila salah satunya tertinggal.

**Rilis.** 1) Tambahkan versi baru di atas `lib/changelog.js` (teks Indonesia) dan teks Inggrisnya di `lib/i18n/en.js` (+ bahasa lain); 2) `npm run build` dan `npm run check`; 3) commit, `git tag v<versi>`, `git push --tags`. GitHub Actions (`.github/workflows/release.yml`) memastikan tag sama dengan versi, menjalankan semua cek, membangun semua browser, dan menerbitkan GitHub release berisi paket & teks Change Log (`npm run release:notes` menampilkannya). Setiap push/PR menjalankan `ci.yml` (cek yang sama, paket disimpan sebagai artifact).

Yang diubah build per browser: Firefox memakai background *event page* (`background.js` dibundel) dan id `browser_specific_settings.gecko`; Safari memakai background service worker klasik, tanpa izin `notifications`, dan page hook disisipkan oleh `content.js` (bukan content script `world: "MAIN"`). `lib/compat.js` memetakan `chrome.*` ke `browser.*` bila perlu.

## Credit
- Dibuat oleh **ardhie** — ardhie.andro@gmail.com
- Saran, laporan bug, atau ide fitur: kirim email dan sertakan versi extension.
- LoU Revival Helper adalah alat buatan pemain dan tidak berafiliasi dengan pengembang *Lord of Ultima: Revival*. Nama game, ikon, dan aset lainnya milik pemiliknya masing-masing.

## Change Log
Lihat [CHANGELOG.id.md](CHANGELOG.id.md), atau tab **ℹ️ Tentang → 📝 Change Log** di dashboard.
