// Single source for the in-app Change Log (CHANGELOG.md mirrors it).
export const CREDIT = { name: 'ardhie', email: 'ardhie.andro@gmail.com' };

export const CHANGELOG = [
  { v: '1.11.0', date: '2026-10-29', items: [
    'Cheat Sheet: tab baru 🏗️ Layouts (Land & Sea / Water) berisi layout kota militer komunitas per unit & target waktu rekrut, dengan link cotgopt.com.',
    'Kolom ⚙️ Revival: perkiraan waktu rekrut per unit & waktu isi penuh TS di Revival untuk tiap layout.'
  ] },
  { v: '1.10.1', date: '2026-10-29', items: [
    'Cheat Sheet → Recruit %: tabel Rumus game dipecah per kelompok unit dengan rentang waktu yang bisa dicapai (seperti tabel komunitas).',
    'Nama unit di tabel komunitas disamakan dengan nama di game (Vanquisher → Berserker, Triari → Guardian, dst.).'
  ] },
  { v: '1.10.0', date: '2026-10-29', items: [
    'Tab baru 📜 Cheat Sheet: Dungeons, Bosses, Recruit %, dan Troops Stats.',
    'Jumlah pasukan minimum/rekomendasi untuk tiap tipe & level dungeon dan boss, dihitung dari rumus game Revival (kekuatan, max loot, explored %, kelemahan).',
    'Kalkulator raid & boss: kerugian, loot, gold, peluang kill, dan tambahan explored.',
    'Recruit %: waktu rekrut per unit sesuai recruit speed % kotamu, dan % yang dibutuhkan untuk target waktu.',
    'Tabel cheat sheet komunitas (LoU klasik) tetap tersedia sebagai referensi.',
    'Daya angkut default Guardian diperbaiki menjadi 20 (sesuai game).'
  ] },
  { v: '1.9.0', date: '2026-10-29', items: [
    'Pilihan bahasa di Pengaturan: Bahasa Indonesia, English, Español, Français, Deutsch, Italiano, Magyar, Ελληνικά, atau ikuti bahasa game.',
    'Dashboard, popup, notifikasi desktop, dan pesan di game ikut bahasa yang dipilih.'
  ] },
  { v: '1.8.0', date: '2026-10-29', items: [
    'Tab baru ℹ️ Tentang: ReadMe, Credit, dan Change Log.',
    'Versi extension tampil di header dashboard & popup.'
  ] },
  { v: '1.7.0', date: '2026-10-29', items: [
    'Tab 🚩 Pergerakan: semua pasukan yang bergerak (misi, muatan, hitung mundur), ⚠️ serangan masuk, konvoi dagang/Market, dan antrian pelatihan pasukan.',
    'Notifikasi desktop: serangan masuk, pelatihan selesai, kiriman dagang tiba.',
    'Layout semua kota tersinkron sekaligus (tidak perlu pindah kota).',
    'Semua dungeon & boss di peta Region otomatis masuk ke tab Dungeon.',
    'Popup: peringatan serangan masuk & ringkasan pergerakan.'
  ] },
  { v: '1.6.1', date: '2026-10-29', items: ['Pesan di game saat ikon baru berhasil disimpan.'] },
  { v: '1.6.0', date: '2026-10-29', items: [
    'Ikon bangunan & node alam memakai ikon asli dari game (Build bar, Guide, panel Town Hall), disimpan lokal.',
    'Nama bangunan & node memakai bahasa Inggris seperti di game (Forest, Rocks, Ore Deposit, Lake).'
  ] },
  { v: '1.5.0', date: '2026-10-29', items: ['🧠 Rekomendasi: opsi hapus node alam bila tiap node menambah produksi di atas ambang.'] },
  { v: '1.4.0', date: '2026-10-29', items: [
    '🧠 Rekomendasi penempatan otomatis: bangunan produksi, pengolahan & Cottage untuk produksi terbesar (maks per resource, seimbang, atau rasio kustom).',
    'Perbandingan hasil vs kondisi sekarang pada level yang sama.'
  ] },
  { v: '1.3.0', date: '2026-10-29', items: [
    'Layout kota tersinkron otomatis dari game, lengkap dengan level asli & antrian bangunan.',
    'Layout "kondisi di game" hanya-baca; Duplikat langsung dibandingkan dengan kota asli.',
    'Perkiraan bonus riset kota dari produksi nyata.',
    'Jam selesai antrian bangunan terbaca otomatis di Ringkasan Kota.'
  ] },
  { v: '1.2.1', date: '2026-10-29', items: ['Perbaikan tampilan kartu kota di popup.'] },
  { v: '1.2.0', date: '2026-10-29', items: ['Ringkasan Kota: pilihan tampilan Kartu, Tabel list, dan Tabel detail (bisa diurutkan per kolom).'] },
  { v: '1.1.1', date: '2026-10-29', items: [
    'Setelah update, pembaca data dipasang ulang otomatis ke tab game (tidak perlu refresh).',
    'Banner peringatan bila data kota tidak terupdate.'
  ] },
  { v: '1.1.0', date: '2026-10-29', items: [
    'Perencana Layout v2: peta 21×21 sama dengan game (tembok, jalan, Town Hall, kota air).',
    'Produksi dihitung dengan rumus resmi game; heatmap petak terbaik; bandingkan rencana; undo/redo.',
    'Impor/ekspor share string (LoU City Planner) — bisa langsung di-Import di game.'
  ] },
  { v: '1.0.0', date: '2026-10-29', items: [
    'Rilis pertama: Ringkasan Kota (resource, kapasitas, kapan gudang penuh, antrian), Perencana Layout, pelacak Dungeon & kalkulator raid.',
    'Notifikasi desktop gudang penuh / makanan habis / antrian selesai.'
  ] }
];
