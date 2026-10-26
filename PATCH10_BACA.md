# Patch 10 — Bobot Tahap 13 (soft skill O*NET) di web

Pasang **setelah patch 9**. Ekstrak ke folder `CareerAI_P2_NextFastAPI` (induk `careerai`), pilih Replace.
Saat backend pertama jalan, database lama otomatis diperbarui (perubahan admin tetap disimpan):
- kamus skill v4: 105 skill teknis + Bahasa Inggris + 28 soft skill bernama elemen O*NET;
- bobot 15 karier TI tervalidasi diganti hasil Tahap 13 (rata-rata 19,7 skill wajib per karier, sebelumnya 13,3);
- skill lama Komunikasi / Kerja tim / Problem solving otomatis dibaca sebagai Speaking (Berbicara) / Cooperation (Kerja sama) / Complex Problem Solving.

Aturan yang perlu ditulis di Bab III:
- Karier TI tervalidasi hanya memakai bukti langsung (nilai MK, self-rating, pengalaman), sama persis dengan notebook Tahap 10/13
  (uji otomatis memastikan peringkat sama). Jembatan skill TI → elemen O*NET hanya dipakai untuk karier acuan O*NET.
- Cakupan kurikulum tetap dihitung pada skill teknis saja, karena pemetaan MK–skill dari RPS hanya memuat skill teknis;
  nilainya sama dengan Tahap 8.
- Urutan skor memakai nilai skor tanpa pembulatan; seri diurutkan menurut nama karier.

Cek: `py -3.12 -m pytest -q` di folder backend → 9 lulus (10 jika `SKRIPSI_DIR` di-set).
