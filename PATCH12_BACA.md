# Patch 12: bobot final Tahap 13 (v2b), label O*NET, dan FR4 (skill dari cerita pengalaman)

Pasang **setelah patch 11**. Patch ini sudah ditulis langsung ke folder `careerai`; tidak perlu ekstrak zip.

## Yang berubah
1. **Bobot dan kamus = hasil final Tahap 13 (v2b, 20 Okt).**
   - `artifacts/bobot_skill_karier.csv` (293 baris) dan `kamus_skill_v4.csv` (29 soft skill, termasuk Social Perceptiveness) kini identik dengan Drive `05_artifacts/web`.
   - Saat backend jalan, database lama diperbarui otomatis (`pipeline_version` menjadi `tahap13_v2b`). Perubahan admin tetap disimpan.
2. **Label O*NET** sesuai hasil cek AR (20 Okt):
   - Writing → jenis `soft`.
   - English Language → label "Bahasa Inggris".
   - Database lama ikut diperbarui sekali (`onet_labels_version`).
3. **FR4: saran skill dari cerita pengalaman.**
   - Di halaman Asesmen, mahasiswa menulis cerita, lalu menekan **"Cari skill dari ceritaku"**.
   - Sistem menampilkan skill yang ditemukan beserta potongan kalimat sumbernya. Mahasiswa mencentang skill yang benar, lalu menekan **Tambahkan**. Hanya skill yang dicentang yang dihitung (bukti pengalaman = 1).
   - Metodenya tanpa AI:
     - Soft skill dan Bahasa Inggris: pola kamus v4, sama persis dengan Tahap 13.
     - Skill teknis: pola kamus v4, diterapkan pada teks asli.
     - Skill O*NET lain: dicocokkan dari nama atau label Indonesianya.
   - Daftar saran disimpan bersama asesmen. Halaman Admin → Umpan balik menampilkan persentase saran yang dicentang (bahan Bab IV).
   - Endpoint baru: `POST /api/experience/extract`.
4. **Contoh di halaman Asesmen diperbaiki.** Chip Komunikasi, Kerja tim, dan Problem solving dulu tidak ikut terpilih karena namanya diganti di Tahap 13. Sekarang chip itu memakai Speaking, Cooperation, dan Complex Problem Solving.

## Langkah pasang
1. Hentikan backend dan frontend, lalu jalankan lagi seperti biasa. Tidak ada library baru.
   - Folder `backend`: `uvicorn app.main:app --reload --port 8000`
   - Folder `frontend`: `npm run dev`
2. Uji otomatis di folder `backend`: `py -3.12 -m pytest -q` → 22 lulus, 3 dilewati.
3. Uji kesamaan dengan notebook (ganti path dengan folder Drive `Skripsi_RAG`):
   ```
   set SKRIPSI_DIR=G:/My Drive/Skripsi_RAG
   py -3.12 -m pytest -q
   ```
   Hasil yang diharapkan: **25 lulus**. Tes `test_metrics_and_fr4_equal_notebook_tahap13` membuktikan dua hal pada 1.766 iklan hold-out:
   - Peringkat web memberi Hit@1, Hit@3, dan MRR makro yang sama persis dengan `tahap13_log.json`:

     | Profil | Hit@1 | Hit@3 | MRR |
     |---|---|---|---|
     | Teknis | 0,672 | 0,915 | 0,798 |
     | Lengkap | 0,664 | 0,917 | 0,793 |

   - FR4 menemukan soft skill yang sama persis dengan Tahap 13.

## Untuk Bab III/IV
- FR4 hanya memberi **saran**; keputusan tetap di tangan mahasiswa.
- Skill yang tidak ada di katalog tidak disarankan. Mahasiswa tetap bisa menambahkannya manual.
- Frasa yang tidak tercakup pola kamus (mis. "memimpin 12 orang") tidak terdeteksi.
- Indikator untuk Bab IV: persentase saran yang dicentang (Admin → Umpan balik).
