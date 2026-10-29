# Change Log — LoU Revival Helper

🇮🇩 Bahasa Indonesia · [English](CHANGELOG.md)

Dibuat oleh **ardhie** (ardhie.andro@gmail.com).

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
