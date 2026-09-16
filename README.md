# Pajak Desa Pematang Ganjang

PWA untuk melihat dan mencari daftar objek pajak melalui HP. Pencarian menjangkau semua dusun; filter hanya membatasi daftar ketika kolom pencarian kosong. Data disimpan di perangkat setelah persiapan offline selesai. Tidak ada fungsi mengubah data bagi kadus.

## Jalankan di komputer ini

```powershell
python scripts/serve.py
```

Buka **http://localhost:8787** di Chrome. Tunggu tulisan **Data siap digunakan offline**. Aplikasi tetap dapat dibuka ulang dan dicari saat koneksi putus. Jangan membuka `index.html` langsung dengan klik ganda, karena penyimpanan PWA memerlukan server.

## Data

- 428 objek Pematang Ganjang dari `P Ganjang.xlsx`, sheet `206`, baris 4115–4542.
- Kunci data adalah gabungan NOP dan tahun. NOP disimpan sebagai teks.
- Nama wajib pajak tidak digunakan untuk menggabungkan objek.
- Dusun diturunkan dari **alamat objek**. Salah tulis `DIUSUN` dan `DUUSN` dinormalisasi hanya untuk pengelompokan, alamat asli dipertahankan.
- 3 objek belum memiliki petunjuk dusun. Semua pengelompokan masih perlu pemeriksaan admin lapangan.
- Cakupan file adalah daftar tunggakan PBB Rp100–500 ribu. Status pembayaran berasal dari sumber, bukan status pembayaran langsung. Tanggal impor bukan tanggal status resmi.

## Perbarui data sebagai pengelola

```powershell
python scripts/import_data.py "P Ganjang.xlsx"
```

Jika pemasok menyertakan tanggal resmi status, gunakan `--source-date YYYY-MM-DD`. Jangan memakai tanggal impor sebagai tanggal status resmi. Impor membaca sumber tanpa mengubahnya, memvalidasi NOP dan duplikat NOP+tahun, lalu mengganti `app/data/pajak.json` setelah seluruh proses berhasil. Sumber dengan kolom wajib yang hilang akan ditolak.

Setelah berkas baru tersedia di server yang sama, kadus menekan **Perbarui daftar**. Unduhan divalidasi sebelum mengganti salinan offline. Pembaruan gagal mempertahankan salinan sebelumnya. Untuk perubahan kode aplikasi, naikkan versi `SHELL_CACHE` di `app/sw.js` sebelum menerbitkan semua berkas shell bersama.

## Pemakaian di HP

Folder `app` perlu disajikan melalui **HTTPS** sebelum dipakai di HP kadus. Server localhost hanya untuk mencoba di komputer ini; alamat HTTP LAN biasa tidak mengaktifkan service worker. Setelah membuka alamat HTTPS, tunggu indikator siap offline, lalu gunakan tombol **Pasang** jika browser menyediakannya, atau menu browser **Tambahkan ke layar utama**. Data offline dapat hilang jika penyimpanan browser dihapus; buka kembali saat online untuk mengunduh ulang.

Aplikasi ini belum diterbitkan dan belum memiliki autentikasi. Untuk distribusi internal, tempatkan seluruh folder termasuk data di belakang akses yang dibatasi bagi perangkat desa. Hak semua kadus melihat semua dusun tidak berarti data boleh diakses publik. Jangan mengunggah sumber Excel atau folder proyek ke hosting; direktori web hanya `app`.

Panduan platform: [service worker dan secure context](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [manifest PWA](https://web.dev/learn/pwa/web-app-manifest).
