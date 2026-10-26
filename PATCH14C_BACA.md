# Patch 14c: backend ke Railway (atau Render), cadangan ngrok, kuesioner Google Form

## Yang berubah
- `backend/tools/make_deploy.py`:
  - Alamat backend sekarang opsional.
  - Dockerfile membaca `$PORT`, jadi folder `deploy_hf/` yang sama bisa dipakai di Railway, Render, atau HF.
- `kuesioner/buat_form.gs` adalah Apps Script untuk mengisi Google Form (SUS + kualitas rekomendasi).

## A. Railway (disarankan, tanpa GitHub)
1. Daftar di https://railway.com → **Login with GitHub** (atau email).
   - Pilih paket **Hobby**: biaya langganan $5 sudah termasuk kredit pemakaian $5.
   - Server ini butuh RAM ±1,5–2 GB, jadi perkirakan tagihan ±$15–40 per bulan jika menyala terus.
   - Matikan service setelah uji pengguna selesai.
2. Di CMD (sekali saja): `npm i -g @railway/cli`, lalu `railway login` (browser terbuka, klik setuju).
3. Siapkan folder deploy dari folder `backend`: `py -3.12 tools\make_deploy.py`
4. Masuk ke folder deploy: `cd ..\deploy_hf`
5. Buat proyek: `railway init` → pilih **Empty Project**, beri nama `careerai`.
6. Unggah dan build: `railway up`. Build pertama ±10–15 menit karena mengunduh torch dan model e5.
   - Jika ditanya service, pilih yang baru dibuat.
7. Isi variabel di dashboard Railway → proyek → service → **Variables** → **New Variable**:
   - `DATABASE_URL`: salin dari `backend\.env` (URI Supabase yang sudah jalan).
   - `GROQ_API_KEY`: salin dari `backend\.env`.
   - `FRONTEND_ORIGINS` = `https://project-mn7ok.vercel.app`
   - Setelah disimpan, Railway otomatis deploy ulang.
8. Buat alamat publik: **Settings → Networking → Generate Domain**.
   - Jika ditanya port, isi `7860`.
   - Hasilnya berbentuk `https://xxxx.up.railway.app`.
9. Cek di browser: `https://xxxx.up.railway.app/api/health` harus memunculkan JSON.
10. Arahkan frontend ke backend dari folder `backend`: `py -3.12 tools\make_deploy.py https://xxxx.up.railway.app`
    - Perintah ini juga menulis `frontend\.env.production`.
    - Setelah itu dari folder `frontend`: `npx vercel --prod`

## B. Render (perlu GitHub + paket berbayar 2 GB)
- Paket Free dan Starter hanya 512 MB RAM. Model e5 + torch butuh ±1,5 GB, jadi server akan mati karena kehabisan memori.
- Pakai **Standard (1 CPU / 2 GB), $25/bulan**. Perlu kartu.
1. Buat repo GitHub **Private** bernama `careerai-api` (github.com → New repository → Private → Create).
2. Isi repo dengan **isi** folder `deploy_hf\` (bukan foldernya). Folder ini dibuat oleh `py -3.12 tools\make_deploy.py` dan sudah dicek tidak berisi data internal.
   - Cara web: di repo kosong klik **uploading an existing file**. Seret semua isi `deploy_hf` (Dockerfile, README.md, requirements.txt, folder app, folder artifacts). Lalu **Commit changes**.
   - Cara git, dari dalam `deploy_hf`:
     ```
     git init
     git add .
     git commit -m "deploy"
     git branch -M main
     git remote add origin https://github.com/<user>/careerai-api.git
     git push -u origin main
     ```
3. Daftar di https://render.com → **Sign in with GitHub**. Izinkan akses ke repo `careerai-api` saja.
4. **New + → Web Service**. Pilih repo `careerai-api` dan isi:
   - Language: **Docker**
   - Branch: main
   - Region: **Singapore**
   - Instance Type: **Standard**
5. **Environment Variables**: `DATABASE_URL`, `GROQ_API_KEY` (salin dari `backend\.env`), dan `FRONTEND_ORIGINS` = `https://project-mn7ok.vercel.app`.
6. Di **Advanced**, isi Health Check Path: `/api/health`.
7. Klik **Deploy Web Service**. Build pertama ±10–15 menit. Port tidak perlu diatur karena Dockerfile membaca `$PORT` dari Render.
8. Setelah status **Live**, buka `https://careerai-api-xxxx.onrender.com/api/health`.
9. Arahkan frontend:
   - Dari folder `backend`: `py -3.12 tools\make_deploy.py https://careerai-api-xxxx.onrender.com`
   - Dari folder `frontend`: `npx vercel --prod`
- Kalau kode backend diubah, jalankan `make_deploy.py` lagi, lalu unggah ulang isinya ke repo. Render otomatis build ulang.
- Setelah uji pengguna: Settings → **Suspend Web Service** agar tagihan berhenti.

## C. Cadangan ngrok (backend dari laptop)
1. Perbaiki token (ERR_NGROK_105):
   - Buka https://dashboard.ngrok.com/get-started/your-authtoken → **Copy**.
   - Jalankan `ngrok config add-authtoken <tempel-token>`.
2. Isi `backend\.env` (Notepad), tambah atau ubah:
   ```
   FRONTEND_ORIGINS=https://project-mn7ok.vercel.app
   RAG_COMPARE=0
   ```
3. Jalankan backend dari folder `backend`: `py -3.12 -m uvicorn app.main:app --port 8000`
4. Di jendela CMD kedua: `ngrok http --url=frostily-monotone-slush.ngrok-free.dev 8000`
5. Arahkan frontend dari folder `backend`: `py -3.12 tools\make_deploy.py https://frostily-monotone-slush.ngrok-free.dev`
   - Setelah itu dari folder `frontend`: `npx vercel --prod`
6. Matikan proteksi Vercel:
   - Buka vercel.com → proyek **careerai** → **Settings → Deployment Protection**.
   - Set **Vercel Authentication** ke **Disabled** → **Save**.
   - Tanpa langkah ini, responden diminta login Vercel.
7. Uji dari HP (data seluler): buka `https://project-mn7ok.vercel.app`, daftar akun, lalu jalankan asesmen.

Catatan: web hanya hidup selama laptop, backend, dan ngrok menyala.

## D. Kuesioner Google Form
1. Buka form → ikon titik tiga (⋮) kanan atas → **Apps Script**.
2. Hapus isi `Code.gs`, lalu tempel seluruh isi `kuesioner/buat_form.gs` → **Simpan** (ikon disket).
3. Pastikan pilihan fungsi di atas = `buatKuesioner` → **Run** → **Review permissions** → pilih akun Anda → **Allow**.
   - Jika muncul "Google hasn't verified this app": **Advanced → Go to ... (unsafe)**. Script ini milik Anda sendiri.
4. Buka form lagi (refresh). Hasilnya 6 data responden, 10 butir SUS, 7 butir rekomendasi, dan 2 isian terbuka.
5. Jika form masih berisi pertanyaan lama: ubah `HAPUS_ISI_LAMA` menjadi `true`, lalu Run lagi.
   - Run dua kali tanpa langkah ini membuat pertanyaan dobel.
