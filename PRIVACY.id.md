# Kebijakan Privasi — LoU Revival Helper

[English](PRIVACY.md) · 🇮🇩 Bahasa Indonesia

**Berlaku sejak:** 30 Oktober 2026 · untuk versi 1.18.1 dan seterusnya

**Pengembang:** ardhie — ardhie.andro@gmail.com

LoU Revival Helper ("extension") adalah extension browser untuk Chrome, Edge, Firefox dan Safari yang membantu pemain game browser **Lord of Ultima: Revival** (`lordofultima.me`). Tujuan tunggalnya adalah menampilkan dan merencanakan data game milikmu sendiri: ringkasan kota, perencana layout, pergerakan pasukan, dungeon, operasi dan setelan minister.

**Singkatnya:** semua yang dibaca extension disimpan **hanya di browser kamu sendiri**. Pengembang tidak punya server, tidak menerima datamu, dan tidak menjual, membagikan, melacak, atau menampilkan iklan. Satu-satunya yang pernah dikirim extension adalah setelan minister yang kamu pilih untuk diterapkan, dan itu dikirim ke game itu sendiri.

## 1. Data yang ditangani extension

### a) Data game yang dibaca dari lordofultima.me
Extension hanya berjalan di halaman `https://lordofultima.me/`. Di sana extension membaca data yang memang sudah ditampilkan atau dimuat oleh game:

- **Kota milikmu:** nama, koordinat, resource, kapasitas gudang, produksi, bangunan dan layout, level bangunan, serta antrian bangun.
- **Pasukan dan kemajuan akun:** pasukan, antrian rekrut, pergerakan pasukan (raid, serangan, bantuan, pulang), konvoi dagang, level riset dan setelan minister.
- **Data peta:** dungeon dan boss (jenis, level, % explored), serta kota pemain lain yang terlihat di peta (nama kota, koordinat, nama pemain di game dan tag aliansi, skor).
- **Serangan masuk:** waktu, target, nama penyerang di game dan pasukan yang terlihat, disimpan sebagai riwayat serangan.
- **Data tampilan game:** ikon dan nama bangunan dari game (untuk menggambar perencana layout), bahasa game dan selisih jam server.

Extension **tidak** membaca atau menyimpan: password atau data login, cookie, token sesi, alamat email, data pembayaran, chat atau pesan di game, maupun halaman apa pun di luar `lordofultima.me`. Extension tidak merekam riwayat browsing kamu.

### b) Data yang kamu isi sendiri
Rencana layout, catatan dan tag relasi untuk pemain, catatan raid, rencana serangan/bertahan, draf minister, pengaturan (bahasa, notifikasi, nilai unit) dan isian alat-alat di dashboard.

### c) Data turunan
Statistik yang dihitung dari data di atas, misalnya catatan per jam untuk skor, pasukan dan produksi (sampai 60 hari), log loot raid dan kalibrasi kecepatan.

## 2. Cara data digunakan
Hanya untuk menjalankan fitur yang kamu lihat di extension: ringkasan, perhitungan, rekomendasi, hitung mundur dan notifikasi desktop (misalnya gudang penuh, serangan masuk, atau pelatihan selesai). Data tidak pernah dipakai untuk iklan, profiling, keputusan kredit/pinjaman, atau tujuan lain di luar fitur tersebut.

## 3. Tempat data disimpan
- Di penyimpanan extension browser kamu (`chrome.storage.local` / `browser.storage.local`), dan untuk beberapa isian alat dashboard, di local storage halaman extension.
- Data **tidak** disinkronkan ke perangkat lain dan **tidak** diunggah ke server milik pengembang maupun pihak lain.
- Tidak ada analytics, telemetri, pelaporan crash, cookie, iklan, atau skrip pihak ketiga.

## 4. Data yang dikirim atau dibagikan
- **Ke pengembang:** tidak ada.
- **Ke pihak ketiga:** tidak ada. Datamu tidak dijual, disewakan, atau dipindahtangankan.
- **Ke game (lordofultima.me):** hanya saat kamu klik **🎩 Set Ministers → Terapkan ke game** dan mengonfirmasi. Extension lalu mengirim setelan minister yang tampil di dialog (setelan Build, Defense, War dan Trade minister, serta menyalakan/mematikan minister) lewat koneksi game itu sendiri, memakai perintah yang sama dengan layar Ministers di game. Tidak ada hal lain yang dikirim ke game.
- **Cadangan:** **Pengaturan → Ekspor cadangan** menyimpan file JSON ke perangkatmu sendiri saat kamu klik. Ke mana file itu dibawa selanjutnya, kamu yang menentukan.
- **Tautan luar:** beberapa tabel referensi menautkan ke situs komunitas (misalnya `cotgopt.com`). Situs itu hanya terbuka saat kamu klik, dan punya kebijakan privasinya sendiri.

## 5. Izin dan alasannya

| Izin | Alasan |
|---|---|
| Akses ke `https://lordofultima.me/*` | Membaca data game di halaman game dan menerapkan setelan minister saat kamu minta. Tidak ada situs lain yang diakses. |
| `storage` | Menyimpan data di atas secara lokal di browser kamu. |
| `alarms` | Menjadwalkan pengingat (gudang penuh, pelatihan selesai, konvoi tiba). |
| `notifications` | Menampilkan pengingat itu sebagai notifikasi desktop (tidak dipakai di Safari). |
| `scripting` | Memasang ulang extension ke tab game yang sudah terbuka setelah install atau update, supaya game tidak perlu dimuat ulang. |

## 6. Penyimpanan dan penghapusan data
Data tetap ada di browser kamu sampai kamu menghapusnya. Kamu bisa:
- menghapus semuanya sekaligus lewat **Pengaturan → Hapus semua data**;
- menghapus statistik raid atau rencana tertentu dari layarnya masing-masing;
- mencopot extension: browser lalu menghapus semua data yang disimpannya.

Karena pengembang tidak pernah menerima datamu, tidak ada data yang tersimpan di tempat lain untuk diminta, dikoreksi, atau dihapus.

## 7. Keamanan
Data tidak pernah keluar dari perangkatmu, kecuali setelan minister di atas, yang dikirim lewat koneksi aman (HTTPS/WSS) milik game. Extension tidak memuat kode dari luar: semua yang dijalankan sudah ada di paket yang terpasang.

## 8. Anak-anak
Extension ini adalah alat untuk pemain Lord of Ultima: Revival. Extension tidak dengan sengaja mengumpulkan informasi pribadi, baik dari anak-anak maupun siapa pun.

## 9. Limited Use Chrome Web Store
Penggunaan informasi yang diterima dari halaman game oleh LoU Revival Helper mematuhi [Kebijakan Data Pengguna Chrome Web Store](https://developer.chrome.com/docs/webstore/program-policies/policies), termasuk persyaratan Limited Use:
- data hanya dipakai untuk tujuan tunggal extension dan fitur-fitur yang terlihat oleh pengguna;
- data tidak dipindahkan ke siapa pun, kecuali setelan minister yang kamu terapkan sendiri ke game;
- data tidak dipakai atau dipindahkan untuk iklan yang dipersonalisasi;
- tidak ada manusia yang membaca datamu, karena pengembang tidak pernah menerimanya.

## 10. Perubahan kebijakan
Bila extension mulai menangani data dengan cara lain, kebijakan ini diperbarui sebelum versi itu dirilis, dan perubahannya dicatat di Change Log (**ℹ️ Tentang → 📝 Change Log**) dengan tanggal berlaku yang baru.

## 11. Kontak
Pertanyaan soal privasi: **ardhie** — ardhie.andro@gmail.com

*LoU Revival Helper adalah alat buatan pemain dan tidak berafiliasi dengan pengembang Lord of Ultima: Revival.*
