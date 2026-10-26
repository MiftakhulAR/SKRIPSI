# Patch 13: database PostgreSQL (Supabase) untuk deploy

Pasang **setelah patch 12**. Patch ini sudah ditulis langsung ke folder `careerai`.

## Yang berubah
- Backend bisa memakai **PostgreSQL/Supabase** kalau `DATABASE_URL` di-set. Kalau `DATABASE_URL` kosong, backend tetap memakai SQLite `careerai.db` seperti sebelumnya, jadi pemakaian di laptop tidak berubah.
- SQL ditulis satu kali dan berjalan di kedua database (`?`, `ON CONFLICT`, `RETURNING`). Nama tabel dan kolomnya sama.
- `tools/migrate_sqlite_to_postgres.py` menyalin seluruh isi `careerai.db` ke Supabase, yaitu:
  - akun, profil, asesmen, rating, dan penjelasan AI;
  - daftar basis pengetahuan;
  - katalog beserta perubahan yang dibuat admin.
- Library baru: `psycopg[binary]` dan `psycopg-pool`.
- Uji otomatis hasilnya sama di SQLite dan PostgreSQL 16: 25 lulus, termasuk uji kesamaan peringkat dengan notebook Tahap 13.

## Langkah (±15 menit, sekali saja)
1. Folder `backend`: `py -3.12 -m pip install -r requirements.txt`
2. Buat project di https://supabase.com (gratis). Catat **database password** saat membuat project.
3. Buka Project Settings → Database → Connection string → **URI**, lalu pilih **Session pooler** (port 5432). Salin URI itu dan ganti `[YOUR-PASSWORD]` dengan password database.
4. Tambahkan satu baris ke `backend/.env`. Jangan kirim isinya ke chat atau GitHub.
   ```
   DATABASE_URL=postgresql://postgres.xxxx:PASSWORD@aws-0-xxxx.pooler.supabase.com:5432/postgres
   ```
5. Pindahkan data laptop ke Supabase:
   ```
   py -3.12 tools/migrate_sqlite_to_postgres.py
   ```
   Hasilnya berupa jumlah baris per tabel. Proses ini menolak menimpa Supabase yang sudah berisi akun, kecuali dijalankan dengan `--force`.
6. Jalankan backend seperti biasa. Login dengan akun yang sama, lalu buka riwayat asesmen; datanya harus tetap ada.
   - Kembali ke SQLite: hapus atau beri `#` pada baris `DATABASE_URL`.

## Catatan
- Project Supabase gratis dijeda otomatis jika 7 hari tidak dipakai. Aktifkan lagi lewat dashboard Supabase.
- Folder `uploads/` (dokumen KB yang diunggah admin lewat web) tetap disimpan di server, bukan di database. Ini tidak dipakai dalam evaluasi.
- Untuk Bab III: data aplikasi disimpan di PostgreSQL (Supabase) saat deploy dan di SQLite saat pengembangan, dengan skema tabel yang sama.
