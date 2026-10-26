# Patch 9 — Karier semua bidang (sudah termasuk patch 8)

Patch ini **sudah memuat seluruh isi patch 8**. Jika patch 8 belum dipasang, cukup pasang patch 9.

## Cara pasang
1. Matikan backend dan frontend.
2. Ekstrak zip ini ke folder `CareerAI_P2_NextFastAPI` (folder induk dari `careerai`), sama seperti patch sebelumnya. Pilih **Replace** jika ditanya.
3. Jalankan backend. Saat pertama jalan:
   - tabel katalog diisi dari `backend/artifacts` (15 karier TI dari Colab + 896 okupasi O*NET semua bidang);
   - jika database sudah memakai patch 8, paket O*NET ditambahkan sekali tanpa menghapus perubahan admin;
   - profil lama otomatis dikonversi.
4. Jalankan frontend. Tidak ada paket npm atau pip baru.
5. Cek: `py -3.12 -m pytest -q` di folder backend → 9 lulus (10 jika `SKRIPSI_DIR` di-set).

## Sumber data semua bidang
O*NET 31.0 Database (U.S. Department of Labor, Employment and Training Administration — USDOL/ETA), lisensi CC BY 4.0.
Atribusi sudah ditampilkan di halaman Jelajahi Karier dan detail karier acuan. Data ini publik dan boleh masuk repo.

Dibangun ulang dengan: `py -3.12 tools/build_onet_pack.py "<folder Excel O*NET 31.0>"` (bisa juga di Colab).

| Unsur | Aturan |
|---|---|
| Okupasi | Semua okupasi O*NET yang punya rating skill/pengetahuan (910), dikurangi kode SOC yang sudah diwakili 15 karier TI tervalidasi → 896 |
| Skill wajib R(c) | Skill (*Essential* + *Transferable*) dan *Knowledge* dengan *Importance* ≥ 3,0 (skala 1–5), minimal 20 elemen terpenting; bobot w = (Importance − 1)/4. *Work Styles* (soft skill) dengan *Impact* ≥ 2,0 (skala −3..3); w = Impact/3 |
| Bidang minat | Maks. 3 *Specific Interest Areas* dengan peringkat tampilan terbaik (41 bidang) |
| Jembatan skill TI | Tabel `skill_crosswalk.csv` (dibuat peneliti): skill kamus TI dihitung juga sebagai bukti elemen O*NET, mis. Python → Programming, Komunikasi → Speaking/Active Listening/Writing |
| Jenjang pendidikan | Profil punya jenjang (SMA/SMK, D3, D4/S1, S2). Okupasi dengan O*NET Job Zone di atas jenjang itu disembunyikan (D3 → Job Zone ≥ 3, D4/S1 dan S2 → ≥ 4). Karier TI tervalidasi selalu tampil |
| Label Indonesia | `tools/onet_labels_id.csv`: 89 skill/pengetahuan/gaya kerja, 41 bidang minat, 23 kelompok bidang. **Mohon dicek.** Nama okupasi tetap bahasa Inggris (admin bisa menambah label) |

Rumus skor tetap (Bab III 3.5). Uji otomatis memastikan peringkat 15 karier TI tetap sama dengan notebook Tahap 10.

## Isi patch 8 (masih berlaku)
- FR1: teks persetujuan pemrosesan data pribadi di halaman Daftar (`users.consent_at`).
- FR2: mata kuliah bebas (nama, kelompok, SKS, nilai, skill dipilih manual) + templat MK PNJ TI.
- FR3: soft skill + skill buatan sendiri.
- FR4: tiga contoh pengalaman di halaman Asesmen.
- FR5: minat teks bebas (maks. 3) + 1 target karier.
- Admin → Katalog Karier: tambah/ubah/hapus karier, skill, bidang minat, templat MK; tombol "Kembalikan ke data Colab".
