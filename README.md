# Laporan Pengembangan
## Chess.com Assistant Pro

Dokumen ini disusun dengan format seperti makalah agar mudah dipelajari ulang dan dipakai sebagai referensi pengembangan lanjutan.

## Abstrak
Pengembangan `Chess.com Assistant Pro.js` berfokus pada stabilitas runtime, akurasi keputusan (main/analysis/premove), keamanan penyimpanan setting, serta ketahanan jangka panjang terhadap gejala memory leak. Hasil utama meliputi perbaikan bug kritis premove, peningkatan mode analysis dengan stability gate dan blunder guard, konsensus move pada mode main, smoothing evaluation bar, hardening setting, dan runtime watchdog dengan mekanisme self-heal worker. Dokumen ini menjelaskan perubahan, cara kerja sistem yang di-upgrade, serta tutorial operasional agar penggunaan konsisten dan mudah ditelusuri.

## Kata Kunci
Tampermonkey, Stockfish, Premove, Analysis Mode, Auto Move, Runtime Watchdog, Memory Safety.

## 1. Pendahuluan
### 1.1 Latar Belakang
Script berkembang menjadi sistem kompleks dengan banyak loop, cache, worker, dan mode eksekusi. Kompleksitas ini meningkatkan risiko bug logika, perilaku tidak konsisten, dan degradasi performa jangka panjang.

### 1.2 Tujuan Pengembangan
1. Menstabilkan alur premove, main, dan analysis.
2. Memperbaiki bug yang mempengaruhi eksekusi otomatis.
3. Menurunkan risiko memory leak saat sesi panjang.
4. Membuat konfigurasi lebih aman dan tahan input invalid.
5. Menyediakan panduan penggunaan yang jelas.

### 1.3 Ruang Lingkup
Pengembangan mencakup file:
- `Chess.com Assistant Pro.js`

Dokumen ini menjadi dokumentasi resmi perubahan dan tutorial operasional.

## 2. Metodologi Perbaikan
Pendekatan yang digunakan:
1. Audit statis pada area premove, engine, cache, loop, dan listener.
2. Perbaikan bug kritis terlebih dahulu (error runtime dan deadlock logic).
3. Hardening konfigurasi untuk mencegah state korup.
4. Penambahan guard dan watchdog untuk recovery otomatis.
5. Penyusunan tutorial operasional agar penggunaan konsisten.

## 3. Hasil Perbaikan Bug
### 3.1 Konflik Handler Error Premove
Masalah:
- Callback `premove.onerror` menimpa logger global `err()`.

Perbaikan:
- Parameter callback diperbaiki agar tidak shadow logger global.

### 3.2 Lock Premove Tidak Terlepas
Masalah:
- `_premoveProcessing` bisa tertinggal `true` pada jalur Promise tertentu.

Perbaikan:
- Jalur release lock dipastikan dieksekusi pada kondisi sukses dan gagal.

### 3.3 Referensi Event Global pada Drag
Masalah:
- Penggunaan `event` global pada strict mode berisiko `ReferenceError`.

Perbaikan:
- Seluruh drag flow menggunakan event parameter yang valid.

### 3.4 Referensi State Tidak Ada
Masalah:
- Akses properti state yang tidak didefinisikan (`currentPVLine`).

Perbaikan:
- Dialihkan ke properti yang benar: `mainPVLine`/`analysisPVLine`.

### 3.5 Salah Satuan Evaluasi Fallback Premove
Masalah:
- Nilai cp terbaca sebagai pawn unit pada fallback chance.

Perbaikan:
- Konversi cp ke pawn diperbaiki sebelum kalkulasi chance.

### 3.6 Status String Rusak Karena Comma Operator
Masalah:
- Assignment status model `("teks", nilai)` membuat pesan tidak sesuai.

Perbaikan:
- Semua assignment status diperbaiki menjadi string eksplisit.

### 3.7 Sinkronisasi Source Stockfish Fallback
Masalah:
- Jalur fallback worker gagal saat `GM_getResourceText` tidak tersedia.

Perbaikan:
- Source fallback disinkronkan agar worker tetap dapat dibuat.

## 4. Hasil Upgrade Sistem
### 4.1 Upgrade Premove
Poin utama:
1. Mode `every` dibuat lebih agresif.
2. Eksekusi premove dipaksa menggunakan click move.
3. Mode `capture` dan `filter` dipertahankan karakter aslinya.

Perubahan teknis mode `every`:
- Threshold confidence lebih permisif.
- Risk tolerance lebih longgar.
- Tactical bonus ditingkatkan.
- Humanization gate tertentu diperlunak.

### 4.2 Upgrade Opening Book
Poin utama:
1. Resolver nama opening diperbaiki.
2. Fallback tidak lagi memakai pencocokan value string yang tidak valid.
3. Prioritas naming dibuat berlapis (direct move key, first move, history, default).

### 4.3 Upgrade Timer Delay dan Clock Sync
Poin utama:
1. `isTimePressure` tidak lagi nyangkut.
2. Validasi rentang delay ditambahkan (`min <= max`).
3. Validasi rentang clock sync ditambahkan.
4. Sinkronisasi display quick-threshold/quick-delay diperkuat.

### 4.4 Upgrade Mode Analysis
Poin utama:
1. Stability gate: auto-play menunggu bestmove stabil.
2. Blunder guard: blok auto-play saat eval drop tajam.
3. Monitoring guard status ditampilkan pada panel.

### 4.5 Upgrade Mode Main
Poin utama:
1. Konsensus best move berbasis snapshot history depth.
2. Mengurangi flip-flop saat engine belum stabil.

### 4.6 Upgrade Evaluation Bar
Poin utama:
1. Smoothing EMA untuk cp.
2. Delta cp ditampilkan.
3. Reset smoothing saat mode mate aktif.

### 4.7 Hardening Persistence Setting
Poin utama:
1. Sanitizer value per key.
2. Range clamp numerik.
3. Normalisasi setting saat startup.
4. Pencegahan enum/object invalid merusak runtime.

### 4.8 Runtime Watchdog dan Self-Heal
Poin utama:
1. Cache pressure checker.
2. Premove stuck watchdog.
3. Engine watchdog.
4. Soak summary logger periodik.
5. Self-heal worker: main, analysis, premove.

## 5. Cara Kerja Fitur yang Di-Upgrade
### 5.1 Alur Premove Aggressive (Mode Every)
1. Engine premove membaca PV lawan.
2. Sistem memilih respon kita dari PV.
3. Confidence dihitung dari evaluasi, safety, dan motif taktik.
4. Untuk mode `every`, gate dibuat lebih permisif.
5. Jika lolos, move dieksekusi via click method.

### 5.2 Alur Analysis Stability Gate
1. Tiap update `info pv` mencatat bestmove dan evaluasi.
2. `analysisStableCount` naik bila bestmove berulang konsisten.
3. Auto-move hanya jalan jika:
- color cocok,
- stable count memenuhi batas,
- tidak kena blunder guard.

### 5.3 Alur Main Consensus
1. Snapshot bestmove depth disimpan selama analisis.
2. Sistem menghitung mayoritas move dari snapshot valid.
3. Jika mayoritas cukup kuat, move konsensus dipilih.
4. Jika tidak, fallback ke bestmove normal.

### 5.4 Alur Runtime Self-Heal
1. Watchdog periodik memeriksa health worker dan cache.
2. Jika terdeteksi stuck/no-response, modul terkait di-reset.
3. Worker dibangun ulang tanpa perlu reload total panel.

## 6. Tutorial Operasional
### 6.1 Setup Dasar
1. Buka Chess.com dan tunggu panel `BINTANG TOBA` muncul.
2. Pastikan status `Ready`.
3. Cek tab `Engine` untuk mode kerja awal.

### 6.2 Mode Main (Auto Main)
1. `Engine Mode` = `ENGINE`.
2. Atur `Depth`.
3. Aktifkan `Auto Run` dan `Auto Move`.
4. Opsional: aktifkan `Use Opening Book`.

### 6.3 Mode Analysis (Auto Move Analysis)
1. Aktifkan `Analysis Mode`.
2. Pilih `Auto Play Color` (White/Black, bukan Off).
3. Jalankan analisis dengan tombol `Run` jika perlu.
4. Auto move akan jalan jika stability gate lolos dan blunder guard tidak aktif.

### 6.4 Jika Auto Move Analysis Tidak Bergerak
Checklist cepat:
1. `Auto Play Color` tidak `Off`.
2. Color sesuai side-to-move.
3. `Analysis Stability` sudah memenuhi ambang.
4. `Guard Status` tidak memblokir.
5. Trigger ulang lewat tombol `Run`.

### 6.5 Mode Premove
1. Aktifkan `Premove System`.
2. Pilih mode:
- `Every Move` untuk agresif,
- `Captures Only` untuk aman,
- `Filtered Pieces` untuk selektif.
3. Untuk `Filtered Pieces`, pilih piece yang diizinkan.

### 6.6 Delay dan Clock Sync
1. Tab `Time`: pilih mode delay (Normal/Fast).
2. Gunakan preset Bullet/Blitz/Rapid bila perlu.
3. Tab `More`: aktifkan `Clock Sync` bila ingin sinkron jam.

### 6.7 Opening Book
1. Tab `Book`: aktifkan `Use Opening Book`.
2. Opsional isi `Notation Sequence (UCI)`.

### 6.8 Diagnostik Cepat
1. Gunakan menu Tampermonkey:
- `Sync from npoint`
- `Run health check`
2. Jika gejala macet, tekan `Reload` pada tab `More`.

## 7. Verifikasi dan Pengujian
### 7.1 Sudah Diverifikasi
1. Konsistensi statis code setelah patch.
2. Integrasi antar modul pada level struktur script.

### 7.2 Belum Diverifikasi Penuh
1. Soak test runtime panjang (1-2 jam) di kondisi live.

### 7.3 Protokol Soak Test yang Disarankan
1. Aktifkan fitur berat (Auto Run, Auto Move, Premove, PV Arrow).
2. Pantau heap dan CPU tiap 10 menit.
3. Uji transisi game over/new game/reload engine.
4. Evaluasi trend memory dan error berulang.

## 8. Kesimpulan
Script telah mengalami peningkatan signifikan dalam stabilitas, akurasi keputusan otomatis, dan ketahanan runtime. Perbaikan bug kritis sudah diterapkan, sistem guard dan self-heal sudah aktif, serta dokumentasi operasional sudah lengkap. Untuk menyatakan benar-benar final production-grade, tahap terakhir adalah verifikasi soak test live.

## 9. Lampiran
### 9.1 File Utama
- `Chess.com Assistant Pro.js`

### 9.2 Dokumen Ini
- `README.md`
