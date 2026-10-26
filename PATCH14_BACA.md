# Patch 14: deploy (backend → Hugging Face Space, frontend → Vercel)

Pasang setelah patch 13, dengan migrasi ke Supabase sudah berhasil. Waktu yang dibutuhkan ±30 menit. Sebagian besar dipakai untuk menunggu proses *build*.

## A. Backend di Hugging Face Space
1. Login ke https://huggingface.co, lalu klik **New → Space**.
   - Space name: `careerai`
   - SDK: **Docker**, template **Blank**
   - Hardware: **CPU basic (free)**
   - Visibility: **Public**. Kode di Space tidak memuat data internal; semua rahasia disimpan di Secrets.
2. Catat alamat Space. Formatnya `https://USERNAME-careerai.hf.space`, dengan USERNAME dalam huruf kecil.
   Alamat ini juga ada di menu ⋮ → **Embed this Space** → Direct URL.
3. Di laptop, buka folder `backend` lalu jalankan:
   ```
   py -3.12 tools/make_deploy.py https://USERNAME-careerai.hf.space
   ```
   Perintah ini membuat folder `careerai/deploy_hf` (±34 file, ±6 MB, tanpa data internal PNJ). Perintah ini juga membuat `frontend/.env.production`.
4. Di Space, buka **Files → + Add file → Upload files**.
   - Seret **isi** folder `deploy_hf`: `Dockerfile`, `README.md`, `requirements.txt`, folder `app`, dan folder `artifacts`. Jangan seret folder `deploy_hf`-nya sendiri.
   - Klik **Commit**. Kalau ada `README.md` bawaan Space, timpa saja.
   Kalau browser tidak bisa mengunggah folder, pakai terminal (sekali login dengan token *Write* dari huggingface.co → Settings → Access Tokens):
   ```
   hf auth login
   hf upload USERNAME/careerai ../deploy_hf . --repo-type space
   ```
5. Buka **Settings → Variables and secrets → New secret**, lalu isi tiga secret:
   - `DATABASE_URL`: isinya sama dengan baris di `backend/.env` (yang sudah memakai `%40`).
   - `GROQ_API_KEY`: sama dengan `.env`.
   - `FRONTEND_ORIGINS`: isi sementara dengan `http://localhost:3000`, lalu ganti di langkah C.
6. Tunggu status **Building** berubah menjadi **Running** (10–20 menit pada build pertama).
7. Cek alamat-alamat ini:
   - `https://USERNAME-careerai.hf.space/api/health` → `"ok": true`, `"careers": 911`
   - `https://USERNAME-careerai.hf.space/api/rag/status` → `"ready": true`, `"layer": "public"`

## B. Frontend di Vercel (tanpa GitHub)
1. Di folder `frontend`, jalankan:
   ```
   npx vercel login
   npx vercel --prod
   ```
   - Pertanyaan pertama: jawab **Y** untuk setup, pilih akun Anda, lalu **N** untuk link ke project lama.
   - Nama project: `careerai`.
   - Directory: `./`. Pengaturan lainnya biarkan bawaan (Enter).
2. Hasilnya berupa alamat seperti `https://careerai-xxxx.vercel.app`. Alamat API diambil dari `.env.production` yang dibuat di langkah A3. File `.env.local` tidak ikut terunggah karena sudah tercantum di `.vercelignore`.

## C. Sambungkan keduanya
1. Di Space HF, buka Settings → Secrets, lalu ubah `FRONTEND_ORIGINS` menjadi alamat Vercel. Contoh: `https://careerai-xxxx.vercel.app`, tanpa garis miring di akhir.
2. Klik **Restart Space**.
3. Buka alamat Vercel, login dengan akun lama (sudah ada di Supabase), lalu coba satu asesmen dan satu penjelasan AI.

## Catatan
- Uji pengguna:
  - `RAG_COMPARE=0` sudah menjadi nilai bawaan di server, sehingga tombol "Bandingkan tanpa basis pengetahuan" hanya muncul untuk admin.
  - Server memakai lapisan basis pengetahuan **publik** (970 passage). Lapisan internal hanya ada di laptop.
- Space gratis tidur setelah ±48 jam tanpa pengunjung. Saat dibuka lagi, server butuh waktu ±1 menit untuk menyala.
- Setiap ada perubahan kode backend: jalankan lagi `make_deploy.py`, unggah ulang file yang berubah, lalu Space akan *build* otomatis. Untuk perubahan frontend: jalankan lagi `npx vercel --prod`.
- Dokumen KB yang diunggah admin lewat web disimpan di disk Space dan hilang saat Space restart. Fitur ini tidak dipakai dalam evaluasi.
