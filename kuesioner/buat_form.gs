/**
 * Kuesioner uji pengguna CareerAI (SUS + kualitas rekomendasi) -> Google Form yang sudah ada.
 * Cara pakai: buka form -> menu titik tiga (⋮) -> "Apps Script" -> hapus isi Code.gs -> tempel seluruh file ini ->
 * Simpan -> pilih fungsi buatKuesioner -> Run -> izinkan akses (akun Anda sendiri).
 * HAPUS_ISI_LAMA = true menghapus pertanyaan yang sudah ada di form sebelum membuat yang baru.
 */
const FORM_ID = '15t0T-bqXnGRYYzNe4BI_O1UavoxztrCqeiokuqYXBSM';
const HAPUS_ISI_LAMA = false;   // ubah ke true kalau form masih berisi pertanyaan lama yang ingin dibuang

function buatKuesioner() {
  const f = FormApp.openById(FORM_ID);
  if (HAPUS_ISI_LAMA) f.getItems().forEach(it => f.deleteItem(it));
  f.setTitle('Kuesioner Uji Pengguna CareerAI');
  f.setDescription(
    'Kuesioner ini bagian dari skripsi D4 Teknik Informatika PNJ tentang sistem rekomendasi karier berbasis web ' +
    '(skor kecocokan + penjelasan AI). Isi SETELAH Anda mencoba web CareerAI (daftar akun, isi profil, jalankan 1 asesmen, ' +
    'buka penjelasan AI untuk minimal 1 karier). Waktu pengisian ±5 menit. Jawaban hanya dipakai untuk penelitian dan ' +
    'dilaporkan secara agregat.');
  f.setProgressBar(true);
  f.setCollectEmail(false);

  // --- Bagian 1: persetujuan & data responden ---
  f.addMultipleChoiceItem().setTitle('Saya bersedia jawaban saya digunakan untuk penelitian skripsi ini.')
    .setChoiceValues(['Ya, saya bersedia']).setRequired(true);
  f.addMultipleChoiceItem().setTitle('Apakah Anda sudah mencoba web CareerAI sampai melihat hasil rekomendasi?')
    .setChoiceValues(['Ya', 'Belum']).setRequired(true);
  f.addTextItem().setTitle('Email yang Anda pakai untuk login di web CareerAI')
    .setHelpText('Opsional. Hanya untuk mencocokkan kuesioner dengan rating rekomendasi Anda di web; tidak dipublikasikan.');
  f.addMultipleChoiceItem().setTitle('Program studi').setChoiceValues(['D4 Teknik Informatika PNJ'])
    .showOtherOption(true).setRequired(true);
  f.addMultipleChoiceItem().setTitle('Semester saat ini')
    .setChoiceValues(['1–2', '3–4', '5–6', '7–8', 'Sudah lulus']).setRequired(true);
  f.addMultipleChoiceItem().setTitle('Perangkat yang Anda pakai saat mencoba web')
    .setChoiceValues(['HP', 'Laptop/PC', 'Keduanya']).setRequired(true);

  // --- Bagian 2: SUS (10 butir, skala 1–5) ---
  f.addPageBreakItem().setTitle('Bagian A — Kemudahan penggunaan (System Usability Scale)')
    .setHelpText('Pilih 1 = Sangat tidak setuju sampai 5 = Sangat setuju. Jawab sesuai pengalaman pertama Anda.');
  const SUS = [
    'Saya berpikir akan sering menggunakan sistem ini.',
    'Saya merasa sistem ini terlalu rumit padahal tidak perlu serumit itu.',
    'Saya merasa sistem ini mudah digunakan.',
    'Saya merasa membutuhkan bantuan orang yang paham teknis untuk dapat menggunakan sistem ini.',
    'Saya merasa fitur-fitur dalam sistem ini terintegrasi dengan baik.',
    'Saya merasa ada terlalu banyak hal yang tidak konsisten dalam sistem ini.',
    'Saya membayangkan kebanyakan orang akan cepat belajar menggunakan sistem ini.',
    'Saya merasa sistem ini sangat merepotkan untuk digunakan.',
    'Saya merasa sangat percaya diri saat menggunakan sistem ini.',
    'Saya perlu mempelajari banyak hal sebelum dapat menggunakan sistem ini.'
  ];
  SUS.forEach((t, i) => skala(f, `A${i + 1}. ${t}`));

  // --- Bagian 3: kualitas rekomendasi & penjelasan ---
  f.addPageBreakItem().setTitle('Bagian B — Rekomendasi dan penjelasan AI')
    .setHelpText('Pilih 1 = Sangat tidak setuju sampai 5 = Sangat setuju.');
  [
    'B1. Tiga karier teratas yang direkomendasikan sesuai dengan kemampuan dan minat saya.',
    'B2. Skor kecocokan dan rinciannya (kompetensi dan minat) mudah saya pahami.',
    'B3. Penjelasan AI membantu saya memahami alasan sebuah karier direkomendasikan.',
    'B4. Daftar skill yang perlu ditingkatkan bermanfaat untuk perencanaan karier saya.',
    'B5. Saran pengembangan (mata kuliah atau sumber belajar) dapat saya tindak lanjuti.',
    'B6. Saya percaya pada informasi yang ditampilkan karena ada data lowongan dan sumbernya.'
  ].forEach(t => skala(f, t));
  f.addScaleItem().setTitle('B7. Fitur "Cari skill dari ceritaku" (saran skill dari cerita pengalaman) membantu saya.')
    .setHelpText('Lewati jika tidak memakai fitur ini.').setBounds(1, 5)
    .setLabels('Sangat tidak setuju', 'Sangat setuju');

  // --- Bagian 4: masukan terbuka ---
  f.addPageBreakItem().setTitle('Bagian C — Masukan');
  f.addParagraphTextItem().setTitle('Kendala yang Anda temui saat memakai web (jika ada)');
  f.addParagraphTextItem().setTitle('Saran untuk pengembangan sistem');

  Logger.log('Selesai: ' + f.getItems().length + ' item. Link isi: ' + f.getPublishedUrl());
}

function skala(f, judul) {
  f.addScaleItem().setTitle(judul).setBounds(1, 5)
    .setLabels('Sangat tidak setuju', 'Sangat setuju').setRequired(true);
}
