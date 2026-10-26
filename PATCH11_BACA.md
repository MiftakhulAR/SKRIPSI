# Patch 11 — RAG di web (knowledge base Tahap 11 + prompt v1 Tahap 12)

Pasang **setelah patch 10**. Patch ini sudah ditulis langsung ke folder `careerai` (tidak perlu ekstrak zip).

## Yang berubah
- **Penjelasan AI karier TI tervalidasi (15)** sekarang memakai **prompt v1 Tahap 12 persis** (`artifacts/prompts_v1.json`),
  model terkunci `openai/gpt-oss-120b` (suhu 0, seed 42), data sistem dengan field yang sama dengan notebook,
  dan **passage hasil retrieval** (e5 + kemiripan kosinus, top-5, τ = 0,8401, judul duplikat dibuang) — sama dengan `ambil()` Tahap 12.
- Setiap pernyataan menampilkan nomor passage [1]–[5]; daftar passage (jenis, judul, sumber, skor kemiripan, kutipan) di bawahnya.
  Dokumen internal PNJ hanya tampil judulnya.
- **Pemeriksa klaim otomatis** (port Cell 9 versi koreksi) dijalankan pada setiap penjelasan; klaim yang tidak didukung ditandai kuning.
- Tombol **"Bandingkan tanpa basis pengetahuan"**: prompt dan model sama, tanpa passage = kondisi non-RAG Tahap 12.
  `RAG_COMPARE=0` menyembunyikannya untuk mahasiswa (admin tetap bisa) — pakai saat uji pengguna.
- **Karier acuan O*NET**: tidak ada passage untuknya di KB, jadi tetap "hanya data sistem" (ditulis di kartu).
- **Tanya AI** (mahasiswa & admin): pertanyaan ikut dipakai sebagai kueri retrieval; passage jadi blok sumber tambahan berlabel *basis pengetahuan*.
  Ini **tidak** termasuk evaluasi Tahap 12.
- Admin → Pengaturan: status basis pengetahuan (lapisan, jumlah passage, τ, model).
- Penjelasan lama (sebelum patch 11) tidak dipakai ulang; dibuat baru saat dibuka.

## Langkah pasang (Windows, folder `backend`)
1. Pasang library baru (sentence-transformers + torch CPU, ±1 GB, sekali saja):
   ```
   py -3.12 -m pip install -r requirements.txt
   ```
2. Tambahkan dua baris ini ke `backend/.env` (key yang sudah ada jangan dihapus):
   ```
   KB_LAYER=internal
   RAG_COMPARE=1
   ```
   `internal` = sama dengan kondisi evaluasi Tahap 12 (termasuk RPS/MK PNJ). **Hanya untuk laptop.**
   Saat deploy nanti pakai `KB_LAYER=public` (file internal sudah di-.gitignore dan .dockerignore).
3. Salin embedding asli dari Colab (disarankan, supaya skor kemiripan sama persis dengan notebook):
   ```
   py -3.12 tools/build_kb_artifacts.py "G:/My Drive/Skripsi_RAG"
   ```
   Ganti path dengan lokasi folder Drive `Skripsi_RAG` (yang berisi `03_kb`). Kalau Drive tidak tersinkron di laptop,
   unduh folder `03_kb` dari Drive lalu beri path ke folder itu.
   Kalau langkah ini dilewati, backend membuat embedding sendiri saat pertama jalan (beberapa menit, hasil hampir sama).
4. Jalankan backend seperti biasa: `uvicorn app.main:app --reload --port 8000`.
   Pertama kali, model e5 (±1 GB) diunduh. Terminal menampilkan `[RAG] layer=internal passages=1346 tau=0.8401` lalu `[RAG] ready`.
5. Cek: http://localhost:8000/api/rag/status → `"ready": true`, `"layer": "internal"`, `"passages": 1346`.
6. Uji otomatis: `py -3.12 -m pytest -q` → 16 lulus (memakai embedding tiruan, tidak mengunduh model).
7. **Uji kesamaan dengan Tahap 12** (model asli):
   ```
   set KB_LAYER=internal
   py -3.12 tools/check_rag_tahap12.py "G:/My Drive/Skripsi_RAG"
   ```
   Hasil yang diharapkan: `same passages as Tahap 12: 60/60`. Hasil tersimpan di `logs/cek_rag_web_tahap12.json` (Drive).

## Untuk Bab III/IV
- Web memakai retriever, τ, prompt v1, dan model yang sama dengan evaluasi Tahap 12; bukti kesamaan = `cek_rag_web_tahap12.json`.
- Perbedaan yang ditulis apa adanya: (1) di web bukti skill bernilai 0–1 (nilai MK/self-rating/pengalaman), skill dengan bukti
  sebagian muncul di daftar "dimiliki" dan "perlu ditingkatkan"; di notebook bukti 0/1 dari iklan; (2) pemeriksa klaim di web memakai
  pola kamus v4 (Tahap 13), notebook memakai v3; (3) deploy publik memakai lapisan publik (970 passage), evaluasi memakai lapisan internal (1.346);
  (4) Tanya AI dengan RAG belum dievaluasi; (5) passage "profil karier" dibuat pada Tahap 8–9, jadi belum memuat soft skill Tahap 13.
