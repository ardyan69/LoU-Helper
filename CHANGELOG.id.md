# Change Log — LoU Revival Helper

🇮🇩 Bahasa Indonesia · [English](CHANGELOG.md)

Dibuat oleh **ardhie** (ardhie.andro@gmail.com).

## v1.24.2 — 2026-10-31

- 🐞 Perbaikan: tidak ada lagi error "Extension context invalidated" di halaman game setelah extension di-update atau di-reload saat tab game masih terbuka. Salinan lama script di tab itu kini berhenti dengan tenang (semua pembacaan, timer dan observer dimatikan) dan meminta F5 bila salinan baru belum mengambil alih.

## v1.24.1 — 2026-10-31

- 📐 Perencana Layout: halaman lebih lebar di layar besar dan kolom Hasil rencana lebih lebar; kapasitas warehouse, total resource dan sisa resource kini tampil sebagai baris ikon yang rapi (tidak lagi terpotong ke bawah di tengah angka), jumlah gerobak/kapal dagang dengan muatan sekali kirim di baris sendiri.
- 🩺 Diagnostik: tiap sumber data yang belum OK kini punya petunjuk 👉 apa yang perlu dibuka di game supaya statusnya terisi, ditambah penjelasan arti "Belum dipakai" / "Perhatian" / "Masalah". Halaman memeriksa ulang otomatis tiap 5 detik selama terbuka.

## v1.24.0 — 2026-10-31

- ✅ Baru: tab To-do — satu daftar untuk semua kota, paling mendesak di atas: serangan masuk, makanan habis, gudang penuh, antrian bangun kosong/hampir selesai, antrian rekrut kosong, pasukan menganggur, dungeon yang hampir habis dijelajahi; tiap item bisa ditunda 1 atau 8 jam, jumlah yang mendesak tampil di menu dan popup.
- 🔎 Serangan masuk dengan pasukan tak terlihat: jenis unit ditebak dari kecepatannya (pasukan bergerak secepat unit paling lambat) — di Pergerakan dan di notifikasi. 📈 Pemain: skor, perubahan 7 hari, status aktif / tidak aktif dari skor yang teramati di peta, grafik skor, dan urutan "Target: tidak aktif & terdekat".
- 🗓️ Baru: tab Timeline — grafik Gantt per kota dalam satu sumbu waktu: serangan masuk, pasukan pergi & pulang, gerobak/kapal dagang (kirim, kembali, kiriman masuk), antrian bangun dan rekrut; rentang 3–48 jam. Perencana Layout: Hasil rencana menampilkan gerobak dagang (Marketplace) dan kapal dagang (Harbor) beserta muatan sekali kirim, serta total resource semua bangunan (dari kota kosong dan sisa dari kondisi kota sekarang); 🧠 Rekomendasi kini punya peta mini hasil, dan petak di semua peta mini benar-benar persegi.

## v1.23.0 — 2026-10-31

- 🐞 Ringkasan Kota: stok kota yang belum dibuka di game tidak lagi diam di tempat. Game hanya menyimpan stok tiap kota per waktu tertentu (bisa berjam-jam lalu) lalu menambah produksi/jam sendiri; kini extension melakukan hal yang sama — produksi/jam diambil dari layout kota bila belum ada angka asli dari game (tanda ≈). Refresh semua kota tidak lagi menimpa produksi/jam asli dari game dengan perkiraan, tidak menimpa data yang baru masuk, dan kolom Update kini menunjukkan kapan stok terakhir persis (↗ = diproyeksikan), bukan hanya kapan tersinkron.
- ✨ Tampilan: menu dikelompokkan (Kota · Militer · Intel · Alat), pencarian global Ctrl+K / ⌘K / "/" untuk kota, pemain, kota pemain, dungeon, koordinat, layout & menu, pintasan Alt+1…0 untuk pindah tab, jam server di header, tema terang / gelap / ikuti sistem (Pengaturan), dan popup dengan tautan cepat (antrian kosong, gudang hampir penuh, asisten bertahan) — klik kota di popup langsung membukanya di Ringkasan Kota, memakai tab dashboard yang sudah terbuka.

## v1.22.0 — 2026-10-31

- 🌐 Tidak lagi bergantung pada bahasa game: ikon bangunan & node ditangkap lewat kunci ikon milik game sendiri (mis. building:farm), jadi terbaca di bahasa apa pun; grup kota dibaca dari state game; guardians, max loot & kelemahan dungeon/boss dihitung dari tabel data game (sama dengan yang ditampilkan panel game) tanpa perlu membuka panelnya.
- 🐞 Perbaikan: template layout militer/hub tidak lagi gagal bila area yang dipakai masih kosong sama sekali.
- 🧰 Proses pengembangan: ESLint dan pemeriksaan tipe (TypeScript lewat JSDoc) untuk lib/ & background; alat terjemahan (ganti teks di semua bahasa sekaligus di kode, deteksi teks yang diubah kata-katanya, cek placeholder & tag HTML, hapus kunci tak terpakai); versi diambil dari Change Log; CI & rilis otomatis di GitHub (paket semua browser + catatan rilis); nama & deskripsi extension tampil dalam bahasa browser (_locales).

## v1.21.0 — 2026-10-31

- 🩺 Baru: Tentang → Diagnostik — status tiap sumber data game (state game, data kota, pergerakan, layout, peta, resource bar, panel Construction, daftar kota, panel dungeon, ikon, penyimpanan, error) dengan waktu terakhir terbaca dan keterangannya; mendeteksi bila struktur state game berubah setelah update game; tombol Salin laporan & Kirim ke pengembang. Banner "data tidak terupdate" di Ringkasan Kota kini menautkan ke sini.
- 🌐 Lebih tahan terhadap bahasa & update game: skor dan total pasukan tiap kota kini dibaca dari state game (sebelumnya hanya dari daftar kota berbahasa Inggris); daftar kota dan panel dungeon dikenali di bahasa game apa pun (lewat koordinat kota sendiri atau dungeon yang dikenal dari peta); angka dengan pemisah ribuan titik, koma, atau spasi (mis. Prancis) terbaca benar; semua selector & label halaman game dikumpulkan di lib/game-dom.js dan diuji dengan contoh HTML game.

## v1.20.2 — 2026-10-31

- ⚡ Lebih ringan: kamus bahasa dimuat sesuai kebutuhan (hanya bahasa aktif + Inggris, bukan ketujuhnya), jadi popup memuat ±160–330 KB JavaScript, bukan ±920 KB, dan terbuka sekitar 2× lebih cepat; popup juga hanya membaca data kota, pengaturan & pergerakan.
- ⚡ Dashboard memperbarui tampilan langsung dari data yang berubah, tanpa membaca ulang semua data setiap beberapa detik (waktu kerja saat game terbuka turun sekitar setengah), dan tab yang tidak sedang dibuka tidak lagi di-render ulang.
- ⚡ Lebih sedikit kerja saat game terbuka: data semua kota dari satu pembacaan game disimpan dalam satu tulisan (sebelumnya satu per kota — 80 kota: 240 → 2 tulisan per 20 detik), begitu juga layout semua kota (80 → 1); pembaca di halaman game hanya membangun ulang bagian data game yang berubah, membaca tiap 10 detik saat tab game tidak terlihat, dan memperlambat pencarian saat game belum dimuat; background hanya menjalankan kalibrasi kecepatan, log loot & penjadwalan notifikasi saat data yang dipakainya berubah.

## v1.20.1 — 2026-10-31

- 🗄️ Penyimpanan lebih aman: izin unlimitedStorage supaya akun besar tidak terbentur batas 10 MB browser; riwayat statistik diringkas (per jam selama 7 hari, lalu satu titik per hari sampai 60 hari — sekitar 6× lebih kecil); kota pemain lain yang 90 hari tidak terlihat di peta dilupakan (catatan tetap ada). Pengaturan → Penyimpanan menampilkan pemakaian per jenis data dan tombol Rapikan sekarang. Bila menyimpan gagal, pembaca data tidak lagi berhenti diam-diam: muncul pesan di game dan data dicoba lagi.
- ⏰ Notifikasi memakai satu alarm saja (sebelumnya satu per kota × resource, yang bisa melewati batas alarm browser pada akun dengan banyak kota).
- 🔔 Notifikasi dikelompokkan: serangan masuk jadi satu notifikasi per kota target & penyerang yang diperbarui tiap ada gelombang baru (jumlah serangan, jenis misi, rentang jam tiba sesuai jam lokal, tetap tampil sampai ditutup); gudang hampir penuh satu notifikasi per kota dengan semua resource-nya; lebih dari 3 kota sekaligus diringkas jadi satu notifikasi.
- 💾 Impor cadangan kini memulihkan semua data (statistik, pemain & catatan, riwayat serangan, log loot, ikon), bukan hanya kota, dungeon, layout & pengaturan. Versi di README dan CHANGELOG.md kini dibuat otomatis dari Change Log dan dicek oleh tes.

## v1.20.0 — 2026-10-30

- 🌿 Perencana Layout → 🧠 Rekomendasi: tujuan baru Otomatis dari node alam (rasio otomatis). Extension menghitung potensi maksimal kayu, batu, besi dan makanan dari node alam kota, memakai potensi itu sebagai rasio, lalu mencari susunan dengan total produksi terbesar. Hasilnya menampilkan potensi tiap resource, rasio yang dipakai, dan persentase potensi yang tercapai; makanan bisa disertakan atau tidak.

## v1.19.0 — 2026-10-30

- 💰 Perencana Layout → 🧠 Rekomendasi: tujuan baru Emas maksimal. Townhouse, Marketplace dan (di kota air) Harbor disusun supaya total emas/jam sebesar mungkin — tiap Marketplace L10 yang menempel menambah +20% pada Townhouse, Harbor +50%. Bisa menyusun ulang bangunan ekonomi, mengisi petak kosong saja, atau mulai dari nol, dengan opsi hapus node bila tiap node menambah cukup emas. Hasilnya menampilkan emas/jam, rata-rata per Townhouse, gerobak, dan perubahan produksi resource.

## v1.18.1 — 2026-10-30

- 📄 Kebijakan privasi (Privacy policy) untuk Chrome Web Store dan browser lain: data apa saja yang dibaca, disimpan di mana (hanya lokal di browser), apa yang dikirim (hanya setelan minister ke game, saat kamu klik), alasan tiap izin, dan cara menghapus data. Bisa dibuka dari popup (Privasi) dan Tentang → Keamanan & privasi; tersedia juga sebagai PRIVACY.md / PRIVACY.id.md.

## v1.18.0 — 2026-10-30

- 🌐 Kini tersedia untuk Chrome, Edge, Firefox & Safari: satu kode sumber yang dibangun per browser dengan npm run build (Firefox sebagai .xpi, Safari lewat konverter Xcode). Popup menampilkan tombol Izinkan akses bila browser belum memberi izin ke lordofultima.me, notifikasi otomatis dilewati di browser yang tidak mendukungnya, dan README berisi cara pasang untuk tiap browser.

## v1.17.1 — 2026-10-30

- ⚡ Set Ministers → Terapkan ke game jauh lebih cepat: semua setelan dikirim sekaligus (bukan satu per satu), dianggap berhasil begitu game menjawab atau datanya sudah berubah, dan tampilan langsung diperbarui. ⚔️ War: level maks & jumlah raid dipilih supaya hampir semua pasukan raid terpakai (dengan perkiraan loot/jam), pasukan yang sedang raid ikut dihitung, raid dimatikan saat ada serangan masuk, kota garis depan hanya mengirim unit penyerang, radius dari dungeon di sekitar level maks. 🛒 Trade: satu hub per benua (gerobak hanya lewat darat) dipilih dari kapasitas, gerobak & posisi; kota sendirian di benua minta lewat laut bila punya kapal; target makanan kota militer dari makan pasukan saat TS penuh; Moonglow L10 memurnikan kelebihan; kiriman minimum mengikuti jumlah gerobak hub.

## v1.17.0 — 2026-10-30

- 🎩 Menu baru Set Ministers: setelan Build, Defense, War (raid otomatis) & Trade minister semua kota di satu layar — dibaca dari game, bisa diedit per kota, dengan rekomendasi (rencana bangun dari Perencana Layout dalam urutan pintar, tembok, garnisun/troop space, level & radius raid dari kekuatan pasukan, target trade dengan kota hub), tombol Terapkan ke game, dan nyala/mati tiap minister. Ini fitur pertama yang mengirim sesuatu ke game: hanya setelan minister, hanya saat kamu klik dan mengonfirmasi.

## v1.16.1 — 2026-10-30

- 🧰 Perencana Layout: tombol Kosongkan node, daftar rencana dikelompokkan & diurutkan (kondisi di game, rencana, rencana militer, lainnya, layout kosong). Ringkasan Kota: tombol 🔄 Refresh semua kota (minta data terbaru dari game, lalu hitung produksi/jam & kapasitas tiap kota dari layout + riset), kartu ringkasan satu baris (+ pasukan, serangan masuk, kota makanan minus), dan kolom produksi/jam di Tabel list. Operasi: input jam tiba senada dengan input lain.

## v1.16.0 — 2026-10-29

- 🎯 Tab baru Operasi → Perencana serangan: pilih target & kota, jam kirim dihitung supaya semua tiba bersamaan atau bergelombang (jeda detik), dengan cek beda benua/Frigate, Castle, unit paling lambat, hitung mundur, dan teks rencana untuk disalin.
- 🛡️ Operasi → Asisten bertahan: untuk tiap serangan masuk, kota mana yang masih sempat mengirim bantuan (unit, jam kirim terakhir, termasuk naik Frigate), perkiraan pertempuran dengan tembok/menara/jebakan & riset militermu, dan perkiraan pasukan penyerang dari riwayatnya; tombol 🛡️ Bantuan di Pergerakan, plus mode simulasi.
- 🔬 Riset akun dibaca dari game: Hasil rencana memakai riset produksi (kayu/batu/besi/makanan/emas) dan Construction; Town Hall kini dihitung (+300 kayu/jam & kapasitasnya) dan level Town Hall asli ikut tersinkron (langkah pembangunan lebih tepat).
- 🌾 Neraca makanan pasukan: Ringkasan Kota → Makanan pasukan (produksi vs makan pasukan di kota, sisa waktu sampai habis, saat semua pasukan pulang & saat TS penuh) dan baris makanan saat TS penuh di Hasil rencana.

## v1.15.0 — 2026-10-29

- 📋 Langkah pembangunan lebih pintar: Cottage dulu bila waktu yang dihemat lebih besar, Town Hall dinaikkan hanya saat dibutuhkan (syarat level & slot), lalu langkah dengan tambahan terbesar per jam; bangunan lama dibongkar tepat sebelum petaknya dipakai; waktu dihitung dengan kecepatan bangun yang naik selama proses, plus kolom Tambahan dan perbandingan dengan urutan biasa.
- ⚖️ Kartu Perbandingan menampilkan total biaya & waktu bangun dari kota ke rencana; tabel Bandingkan berdampingan menampilkan waktu rekrut tiap unit.
- 🧩 Template: kelompok unit kedua dengan porsi %, slot ekonomi hybrid (Cottage & Warehouse; hub: Cottage), peta mini menandai petak yang berubah, dan perhitungan berjalan di latar belakang dengan progress bar & tombol Batal.
- 🧪 Tes otomatis untuk rumus game, template & urutan bangun (node --test tests/*.test.mjs), dan pengecekan terjemahan (node tests/i18n-check.mjs).

## v1.14.2 — 2026-10-29

- ⚔️ Perencana Layout → Hasil rencana: bila ada bangunan militer, tampil Troop space (TS), kecepatan rekrut % per kelompok bangunan rekrut (termasuk Barracks yang menempel), dan waktu rekrut tiap unit (mis. Training Ground → Berserker, Ranger, Guardian) beserta waktu mengisi TS; unit yang belum terbuka diberi tanda level bangunan yang dibutuhkan.

## v1.14.1 — 2026-10-29

- 🧩 Template militer & hub lebih maksimal: susunan dihitung ulang dengan pencarian yang jauh lebih teliti (recruit % dan kapasitas gudang naik), slot bangunan default 100 (Town Hall L10) — tidak lagi terbatas slot kota saat ini, Barracks ditambah di atas target TS bila menaikkan recruit %, opsi hapus node alam, dan Harbor untuk hub di kota air.

## v1.14.0 — 2026-10-29

- Perbaikan: produksi emas tidak lagi dijumlahkan per kota — di Revival emas sudah total semua kota (akun).
- 🧩 Perencana Layout → Template: kota militer (recruit speed % maksimal untuk satu kelompok unit dengan target troop space), kota hub (kapasitas gudang & gerobak), dan ekonomi (Rekomendasi) — juga langsung dari Cheat Sheet → Layouts.
- ⚖️ Perencana Layout → Bandingkan berdampingan: dua rencana dengan peta mini dan tabel selisih (produksi, kapasitas, recruit %, troop space, gerobak).

## v1.13.0 — 2026-10-29

- 📈 Tab Statistik: grafik loot raid per hari, loot per kota, produksi total, skor, dan pasukan per kota (dicatat otomatis tiap jam).
- 👥 Tab Pemain: pemain & aliansi yang terlihat di peta, status hubungan & catatan, serta riwayat serangan masuk per pemain.
- 🔁 Ringkasan Kota → Transfer: saran kirim resource antar-kota (jumlah, gerobak, waktu tempuh).
- 📋 Perencana Layout → Langkah pembangunan: urutan bongkar/bangun/upgrade dari kota ke rencana, dengan biaya & waktu.
- Cheat Sheet → 🧱 Buildings: biaya & waktu bangun tiap level (data game) dengan kecepatan bangun kotamu; ⚔️ Battle: simulator serangan/pertahanan dengan aturan game.
- Dungeon: tanda dungeon yang sedang diraid, perkiraan explored % terkini, kolom ⭐ Prioritas, dan perkiraan max loot dari rumus game.
- Header dashboard dua baris agar semua tab muat.

## v1.12.0 — 2026-10-29

- 🎯 Raid Planner di tab Dungeon: pilih kota, extension menyarankan dungeon terdekat yang cocok dengan pasukan di kota itu, jumlah pasukan per dungeon (rumus Revival), loot per jam, dan berapa raid sampai explored 100%.
- Cheat Sheet → Recruit %: recruit speed % terisi otomatis dari layout kota (bangunan rekrut + Barracks yang menempel, rumus game).
- Kalibrasi kecepatan otomatis: menit/field tiap unit dihitung dari pergerakan pasukan yang terbaca (bisa dimatikan di Pengaturan).
- Ringkasan Kota tidak lagi bergantung pada bahasa game; resource & antrian semua kota juga terupdate dari data game tanpa perlu membuka tiap kota.
- Waktu persiapan/bongkar raid default menjadi 0 (raid di Revival langsung pulang-pergi).

## v1.11.1 — 2026-10-29

- Pengaturan → Unit memakai data nyata dari game Revival: daya angkut, kecepatan dasar (menit/field), dan kekuatan (serangan ÷ 50); ditambah Sloop, Frigate, War Galleon. Pengaturan lama diperbarui otomatis (kecepatan hasil kalibrasi tetap disimpan).
- README.md dan CHANGELOG.md kini berbahasa Inggris (versi Indonesia: README.id.md, CHANGELOG.id.md).

## v1.11.0 — 2026-10-29

- Cheat Sheet: tab baru 🏗️ Layouts (Land & Sea / Water) berisi layout kota militer komunitas per unit & target waktu rekrut, dengan link cotgopt.com.
- Kolom ⚙️ Revival: perkiraan waktu rekrut per unit & waktu isi penuh TS di Revival untuk tiap layout.

## v1.10.1 — 2026-10-29

- Cheat Sheet → Recruit %: tabel Rumus game dipecah per kelompok unit dengan rentang waktu yang bisa dicapai (seperti tabel komunitas).
- Nama unit di tabel komunitas disamakan dengan nama di game (Vanquisher → Berserker, Triari → Guardian, dst.).

## v1.10.0 — 2026-10-29

- Tab baru 📜 Cheat Sheet: Dungeons, Bosses, Recruit %, dan Troops Stats.
- Jumlah pasukan minimum/rekomendasi untuk tiap tipe & level dungeon dan boss, dihitung dari rumus game Revival (kekuatan, max loot, explored %, kelemahan).
- Kalkulator raid & boss: kerugian, loot, gold, peluang kill, dan tambahan explored.
- Recruit %: waktu rekrut per unit sesuai recruit speed % kotamu, dan % yang dibutuhkan untuk target waktu.
- Tabel cheat sheet komunitas (LoU klasik) tetap tersedia sebagai referensi.
- Daya angkut default Guardian diperbaiki menjadi 20 (sesuai game).

## v1.9.0 — 2026-10-29

- Pilihan bahasa di Pengaturan: Bahasa Indonesia, English, Español, Français, Deutsch, Italiano, Magyar, Ελληνικά, atau ikuti bahasa game.
- Dashboard, popup, notifikasi desktop, dan pesan di game ikut bahasa yang dipilih.

## v1.8.0 — 2026-10-29

- Tab baru ℹ️ Tentang: ReadMe, Credit, dan Change Log.
- Versi extension tampil di header dashboard & popup.

## v1.7.0 — 2026-10-29

- Tab 🚩 Pergerakan: semua pasukan yang bergerak (misi, muatan, hitung mundur), ⚠️ serangan masuk, konvoi dagang/Market, dan antrian pelatihan pasukan.
- Notifikasi desktop: serangan masuk, pelatihan selesai, kiriman dagang tiba.
- Layout semua kota tersinkron sekaligus (tidak perlu pindah kota).
- Semua dungeon & boss di peta Region otomatis masuk ke tab Dungeon.
- Popup: peringatan serangan masuk & ringkasan pergerakan.

## v1.6.1 — 2026-10-29

- Pesan di game saat ikon baru berhasil disimpan.

## v1.6.0 — 2026-10-29

- Ikon bangunan & node alam memakai ikon asli dari game (Build bar, Guide, panel Town Hall), disimpan lokal.
- Nama bangunan & node memakai bahasa Inggris seperti di game (Forest, Rocks, Ore Deposit, Lake).

## v1.5.0 — 2026-10-29

- 🧠 Rekomendasi: opsi hapus node alam bila tiap node menambah produksi di atas ambang.

## v1.4.0 — 2026-10-29

- 🧠 Rekomendasi penempatan otomatis: bangunan produksi, pengolahan & Cottage untuk produksi terbesar (maks per resource, seimbang, atau rasio kustom).
- Perbandingan hasil vs kondisi sekarang pada level yang sama.

## v1.3.0 — 2026-10-29

- Layout kota tersinkron otomatis dari game, lengkap dengan level asli & antrian bangunan.
- Layout "kondisi di game" hanya-baca; Duplikat langsung dibandingkan dengan kota asli.
- Perkiraan bonus riset kota dari produksi nyata.
- Jam selesai antrian bangunan terbaca otomatis di Ringkasan Kota.

## v1.2.1 — 2026-10-29

- Perbaikan tampilan kartu kota di popup.

## v1.2.0 — 2026-10-29

- Ringkasan Kota: pilihan tampilan Kartu, Tabel list, dan Tabel detail (bisa diurutkan per kolom).

## v1.1.1 — 2026-10-29

- Setelah update, pembaca data dipasang ulang otomatis ke tab game (tidak perlu refresh).
- Banner peringatan bila data kota tidak terupdate.

## v1.1.0 — 2026-10-29

- Perencana Layout v2: peta 21×21 sama dengan game (tembok, jalan, Town Hall, kota air).
- Produksi dihitung dengan rumus resmi game; heatmap petak terbaik; bandingkan rencana; undo/redo.
- Impor/ekspor share string (LoU City Planner) — bisa langsung di-Import di game.

## v1.0.0 — 2026-10-29

- Rilis pertama: Ringkasan Kota (resource, kapasitas, kapan gudang penuh, antrian), Perencana Layout, pelacak Dungeon & kalkulator raid.
- Notifikasi desktop gudang penuh / makanan habis / antrian selesai.
