# Patch 14b: deploy dengan backend di laptop dan ngrok (pengganti Hugging Face)

Hugging Face Space gratis tidak bisa dijalankan dari akun baru (kuota cpu-basic = 0). Penggantinya:
- **frontend** di Vercel (gratis, menyala 24 jam);
- **backend** di laptop, dibuka ke internet lewat **ngrok** (gratis, alamatnya tetap);
- **database** di Supabase (sudah jalan).

Yang diubah di kode hanya `frontend/lib/api.ts`. File ini sekarang mengirim header `ngrok-skip-browser-warning` supaya halaman peringatan ngrok tidak memblokir panggilan API.

## 1. ngrok (sekali saja, ±10 menit)
1. Daftar di https://dashboard.ngrok.com/signup (gratis).
2. Pasang ngrok. Di PowerShell: `winget install ngrok.ngrok`. Atau unduh zip dari dashboard → Setup & Installation.
3. Daftarkan token: di dashboard → **Your Authtoken** → salin, lalu jalankan
   `ngrok config add-authtoken TOKEN_ANDA`
4. Ambil alamat tetap gratis: dashboard → **Domains** → **+ Create Domain** / **Claim free domain**.
   Hasilnya kira-kira `nama-acak.ngrok-free.app`. Catat alamat ini.

## 2. Frontend ke Vercel (sekali saja)
1. Buat file `frontend/.env.production` berisi satu baris:
   ```
   NEXT_PUBLIC_API_URL=https://nama-acak.ngrok-free.app
   ```
2. Di folder `frontend`, jalankan:
   ```
   npx vercel login
   npx vercel --prod
   ```
   Saat ditanya, jawab: Y (set up) → pilih akun Anda → N (link ke project lama) → nama `careerai` → direktori `./` → sisanya tekan Enter.
3. Catat alamat Vercel yang muncul, misalnya `https://careerai-xxxx.vercel.app`.

## 3. Backend: tambah 2 baris di `backend/.env`
```
FRONTEND_ORIGINS=https://careerai-xxxx.vercel.app
RAG_COMPARE=0
```
`RAG_COMPARE=0` membuat tombol "Bandingkan tanpa basis pengetahuan" hanya muncul untuk admin selama uji pengguna.

## 4. Setiap kali uji pengguna: buka 2 terminal
- Terminal 1, di folder `backend`, nyalakan backend tanpa `--reload`:
  ```
  uvicorn app.main:app --port 8000
  ```
- Terminal 2:
  ```
  ngrok http --url=nama-acak.ngrok-free.app 8000
  ```
- Cek dari HP dengan data seluler: buka alamat Vercel, login, lalu jalankan satu asesmen.
- Biarkan laptop menyala dan terhubung internet. Matikan mode sleep: Settings → Power → Sleep: Never.

## Catatan untuk Bab III/IV
- Uji pengguna memakai frontend di Vercel, backend di server pengembangan (laptop peneliti) yang dibuka lewat *tunnel* ngrok, dan basis data PostgreSQL di Supabase.
- Konfigurasi model, retriever, dan τ sama dengan evaluasi.
- Kalau laptop mati, sistem tidak bisa diakses. Karena itu jadwal uji pengguna perlu ditentukan.
