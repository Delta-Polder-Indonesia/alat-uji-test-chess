# Chess.com Assistant Pro - Update & Fix Documentation

Dokumen ini menjelaskan secara lengkap semua peningkatan (upgrade), perbaikan bug (fix), dan cara kerja fitur utama yang sudah diperbarui pada file:

- `Chess.com Assistant Pro.js`

Tujuan update ini adalah membuat script lebih stabil, lebih aman untuk sesi panjang, dan lebih konsisten untuk mode Main, Analysis, dan Premove.

## Ringkasan Perubahan Besar

Area yang sudah ditingkatkan:

1. Stabilitas premove (khusus mode every move dibuat lebih agresif)
2. Keamanan eksekusi move (premove pakai click move, bukan drag)
3. Validasi timer delay dan clock sync
4. Perbaikan naming opening book
5. Pengurangan risiko memory leak (cache/listener/loop guard)
6. Hardening setting (sanitasi nilai setting)
7. Runtime watchdog + self-heal engine worker
8. Peningkatan mode Analysis (stability gate + blunder guard)
9. Peningkatan mode Main (consensus best move)
10. Peningkatan evaluation bar (smoothing + delta cp)

---

## Daftar Bug yang Sudah Diperbaiki

### 1) Premove Engine Error Handler Conflict
Masalah:

- Callback `premove.onerror` memakai parameter bernama `err` dan memanggil `err(...)`.
- Ini menimpa logger global `err()` dan bisa memicu `TypeError`.

Perbaikan:

- Nama parameter callback diperbaiki agar tidak menimpa logger.
- Error sekarang tercatat normal dan state lock tetap dibersihkan.

### 2) Lock Premove Tidak Terlepas
Masalah:

- `_premoveProcessing` bisa tetap `true` saat jalur Promise tertentu selesai.
- Akibatnya premove bisa macet untuk posisi berikutnya.

Perbaikan:

- Release lock dipastikan terjadi pada jalur sukses dan gagal.

### 3) Drag Panel Pakai `event` Global (Strict Mode)
Masalah:

- `startDrag()` mengakses `event` global.
- Pada strict mode/browsers tertentu bisa `ReferenceError`.

Perbaikan:

- Handler drag memakai event parameter yang benar.

### 4) Referensi State Tidak Ada (`currentPVLine`)
Masalah:

- Ada akses ke properti state yang tidak didefinisikan.

Perbaikan:

- Diganti ke alur PV yang benar (`mainPVLine` / `analysisPVLine`) sesuai konteks.

### 5) Salah Satuan Evaluasi pada Fallback Premove Chance
Masalah:

- Nilai centipawn diperlakukan sebagai pawn unit pada jalur fallback.
- Chance premove jadi terlalu meleset.

Perbaikan:

- Konversi cp ke pawn dibuat benar saat dipakai untuk kalkulasi chance.

### 6) Comma Operator pada Status Info
Masalah:

- Ada assignment model `("text", value)`.
- Nilai yang tersimpan hanya bagian terakhir.

Perbaikan:

- Semua status info diperbaiki menjadi string yang benar dan informatif.

### 7) Fallback Stockfish Source Sinkronisasi
Masalah:

- Saat `GM_getResourceText` gagal, worker fallback bisa tidak dapat source yang benar.

Perbaikan:

- Source fallback disinkronkan agar jalur manual tetap bisa membuat worker.

---

## Upgrade Premove

### A) Mode Every Move Dibuat Lebih Agresif
Perubahan inti:

- `minConfidence` diturunkan (lebih mudah lolos)
- `riskTolerance` dinaikkan (lebih berani)
- `tacticalBonus` dinaikkan
- Blokir risk threshold dibuat lebih longgar untuk mode every
- Pattern-break humanization diperlunak pada mode every
- Probability roll dibuat lebih permisif pada mode every

Dampak:

- Mode `every` lebih aktif melakukan premove.
- Mode `capture` dan `filter` tidak diubah perilaku dasarnya.

### B) Eksekusi Premove Dipaksa Pakai Click Move
Perubahan:

- Jalur `_clickMove(...)` untuk premove diarahkan ke `_clickMoveClassic(...)`.
- Tidak lagi memakai drag humanized untuk premove.

Dampak:

- Eksekusi premove lebih cepat dan lebih konsisten.

---

## Upgrade Opening Book

Masalah sebelumnya:

- Fallback nama opening mencoba mencocokkan UCI move ke value nama opening dengan `includes`, logikanya tidak valid.

Perbaikan:

- Ditambahkan resolver nama opening yang lebih aman dan terstruktur.
- Prioritas nama:
  1. direct key dari `OPENING_NAMES[move]`
  2. fallback nama first move pada posisi awal
  3. fallback berdasarkan history awal
  4. default `Book Move`

Dampak:

- Label opening lebih akurat dan tidak misleading.

---

## Upgrade Timer Delay & Clock Sync

Perbaikan:

1. `isTimePressure` sekarang di-reset setiap kalkulasi delay
2. Validasi rentang delay (`min <= max`) ditambahkan
3. Validasi rentang clock sync (`clockSyncMinDelay <= clockSyncMaxDelay`) ditambahkan
4. Input quick threshold/quick delay disinkronkan lebih konsisten ke display

Dampak:

- Delay lebih stabil, tidak nyangkut pada kondisi low-time lama.

---

## Hardening Setting (Safe Persistence)

Yang ditambahkan:

- Peta default setting persisted
- Batas angka per key (range clamp)
- Sanitizer value per tipe (boolean/number/string/object)
- Normalisasi setting saat startup

Efek:

- Setting korup atau out-of-range tidak merusak runtime.
- Setting enum yang invalid di-fallback ke default aman.

---

## Memory Safety & Leak Prevention

### 1) Event Listener Guard
- Listener global yang sebelumnya berisiko terpasang berulang kini diberi guard binding.

### 2) Cache Pruning
- Cache CCT dan cache lain dipangkas saat melebihi batas.
- Entry lama/expired dibersihkan otomatis.

### 3) Loop Safety
- Loop utama tetap mengikuti flag `_allLoopsActive`.
- Pembersihan saat unload menjaga loop/interval tidak terus berjalan.

### 4) Worker Lifecycle
- Worker terminate + revoke blob URL dijaga lebih ketat.

Catatan:

- Ini menurunkan risiko leak secara signifikan, tapi validasi final tetap perlu soak test runtime.

---

## Runtime Guard, Watchdog, dan Self-Heal

Ditambahkan sistem pengawas runtime:

1. Cache pressure checker
2. Premove stuck watchdog
3. Engine watchdog
4. Soak summary logger periodik

Self-heal yang tersedia:

- `selfHealMain(...)`
- `selfHealAnalysis(...)`
- `selfHealPremove(...)`

Cara kerja:

- Jika worker dianggap stuck/no response melewati ambang timeout,
- worker di-restart otomatis pada domain terkait,
- state penting dibersihkan seperlunya agar alur lanjut normal.

---

## Upgrade Mode Analysis

### 1) Stability Gate
Auto-play analysis tidak langsung jalan hanya karena ada bestmove.
Syarat tambahan:

- bestmove stabil minimal beberapa update berurutan
- kandidat move harus sama dengan move stabil terakhir

### 2) Blunder Guard
Jika evaluasi turun tajam (contoh >120 cp loss), auto-play diblokir sementara.

Efek:

- Mengurangi auto-play pada posisi yang masih sangat volatile.

---

## Upgrade Mode Main

Ditambahkan konsensus best move dari history snapshot depth:

- Bukan hanya pakai 1 sinyal bestmove terakhir
- Mengambil mayoritas dari snapshot recent depth yang layak

Efek:

- Mengurangi flip-flop move ketika engine belum stabil.

---

## Upgrade Evaluation Bar

Perubahan:

1. Smoothing EMA untuk nilai cp
2. Delta cp ditampilkan (`D+/-x.xx`)
3. Saat mode mate, smoothing cp di-reset agar tidak carry nilai lama

Efek:

- Bar lebih halus (tidak jitter berlebihan)
- Perubahan evaluasi antar update lebih mudah dibaca.

---

## Perubahan pada Komentar Section

- Penamaan section sudah dirapikan agar lebih profesional dan konsisten.
- Struktur logika tidak diubah, hanya style naming section.

---

## Cara Kerja Fitur Upgrade (Ringkas)

### A) Premove Aggressive Every Mode
1. Engine premove membaca PV lawan + respon kita.
2. Sistem menghitung confidence dari eval, taktik, safety.
3. Untuk mode `every`, threshold dibuat lebih permisif.
4. Jika lolos gate, premove dieksekusi via click method.

### B) Analysis Stability + Blunder Guard
1. Tiap update info dari engine analysis dicatat.
2. Jika bestmove konsisten beberapa kali, `stableCount` naik.
3. Auto-play baru boleh jalan jika stabil dan tidak kena blunder guard.

### C) Main Consensus
1. Snapshot bestmove disimpan dari update depth.
2. Move final dipilih dari suara mayoritas snapshot valid.
3. Jika mayoritas kuat, consensus dipakai; jika tidak, fallback standar.

### D) Runtime Watchdog
1. Loop watchdog cek cache pressure, stuck flags, dan health worker.
2. Jika ada gejala stuck, trigger self-heal modul terkait.
3. Soak summary dicetak periodik untuk pemantauan.

---

## Verifikasi yang Sudah Dilakukan

Sudah diverifikasi:

- Konsistensi patch secara statis pada script
- Error pattern kritis lama sudah dibersihkan
- Integrasi fungsi baru terhadap alur lama

Belum diverifikasi:

- Soak test runtime live 1-2 jam di Chess.com

---

## Rekomendasi Uji Final

1. Jalankan game 1-2 jam (multi game)
2. Aktifkan fitur berat (Auto Run, Premove every, PV arrows)
3. Pantau:
- Heap trend
- CPU trend
- Error console berulang
- Respons panel dan worker recovery

Jika hasil stabil, script dapat dianggap release-ready untuk penggunaan rutin.
