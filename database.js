// ========================================================================
// DATABASE.JS — Fitur "Isi Data Saya" (Portal Kelas TM-1)
// ------------------------------------------------------------------------
// File ini TERPISAH dari script.js (sama seperti pola musicplayer.js),
// supaya script.js yang sudah ada tidak perlu diubah/dirusak.
//
// Yang dilakukan file ini:
// 1. Mengisi dropdown nama siswa di form "Isi Data Saya"
// 2. Saat form dikirim -> simpan No. Telp, Instagram, dan hari piket
//    ke Firestore (database online gratis dari Google)
// 3. Saat website dibuka -> ambil semua data dari Firestore, lalu
//    "menimpa" data siswa & piket yang tadinya placeholder di script.js
//
// CATATAN JUJUR: karena website ini tidak punya sistem login, siapapun
// yang isi form bisa pilih nama siapa saja dan menimpa datanya. Untuk
// 1 kelas yang saling kenal biasanya tidak masalah, tapi bukan sistem
// yang benar-benar "aman" secara teknis.
// ========================================================================

const KOLEKSI_FIRESTORE = 'dataSiswa'; // nama "tabel" di Firestore
const HARI_PIKET = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

const formIsiData = document.getElementById('formIsiData');
const selectNamaSiswa = document.getElementById('selectNamaSiswa');
const inputTelpSiswa = document.getElementById('inputTelpSiswa');
const inputIgSiswa = document.getElementById('inputIgSiswa');
const isiDataStatus = document.getElementById('isiDataStatus');
const isiDataSubmitBtn = document.getElementById('isiDataSubmitBtn');

// ---------- 1. Isi dropdown nama siswa (memakai ulang variabel `students` dari script.js) ----------
function dbIsiDropdownNama() {
  if (!selectNamaSiswa || typeof students === 'undefined') return;
  selectNamaSiswa.innerHTML = '<option value="">-- Pilih nama kamu --</option>' +
    students.map(s => `<option value="${s.no}">${s.nama}</option>`).join('');
}

// ---------- 2. Saat nama dipilih, tampilkan data yang sudah tersimpan (kalau ada) ----------
async function dbSaatNamaDipilih() {
  const no = selectNamaSiswa.value;
  formIsiData.querySelectorAll('.piket-checkbox').forEach(cb => cb.checked = false);
  inputTelpSiswa.value = '';
  inputIgSiswa.value = '';
  if (!no) return;

  try {
    const doc = await db.collection(KOLEKSI_FIRESTORE).doc(no).get();
    if (doc.exists) {
      const data = doc.data();
      inputTelpSiswa.value = data.telp || '';
      inputIgSiswa.value = data.ig || '';
      (data.piket || []).forEach(hari => {
        const cb = formIsiData.querySelector(`.piket-checkbox[value="${hari}"]`);
        if (cb) cb.checked = true;
      });
    }
  } catch (err) {
    console.error('Gagal mengambil data sebelumnya:', err);
  }
}

// ---------- 3. Kirim/simpan form ----------
async function dbSimpanData(event) {
  event.preventDefault();
  const no = selectNamaSiswa.value;
  if (!no) {
    dbTampilkanStatus('Pilih nama kamu dulu, ya.', true);
    return;
  }

  const hariTerpilih = Array.from(formIsiData.querySelectorAll('.piket-checkbox:checked')).map(cb => cb.value);

  const dataUntukDisimpan = {
    nama: students.find(s => s.no === parseInt(no)).nama,
    telp: inputTelpSiswa.value.trim() || '-',
    ig: inputIgSiswa.value.trim() || '-',
    piket: hariTerpilih,
    diperbaruiPada: firebase.firestore.FieldValue.serverTimestamp()
  };

  isiDataSubmitBtn.disabled = true;
  isiDataSubmitBtn.textContent = 'Menyimpan...';

  try {
    await db.collection(KOLEKSI_FIRESTORE).doc(no).set(dataUntukDisimpan, { merge: true });
    dbTampilkanStatus('Berhasil disimpan! Terima kasih sudah mengisi data.', false);
    await dbMuatSemuaData(); // langsung refresh tampilan Data Siswa & Piket
  } catch (err) {
    console.error('Gagal menyimpan data:', err);
    dbTampilkanStatus('Gagal menyimpan, coba lagi (cek koneksi internet).', true);
  } finally {
    isiDataSubmitBtn.disabled = false;
    isiDataSubmitBtn.textContent = 'Simpan Data';
  }
}

function dbTampilkanStatus(pesan, isError) {
  if (!isiDataStatus) return;
  isiDataStatus.textContent = pesan;
  isiDataStatus.classList.toggle('isi-data-status-error', isError);
  isiDataStatus.classList.add('show');
  setTimeout(() => isiDataStatus.classList.remove('show'), 5000);
}

// ---------- 4. Ambil SEMUA data dari Firestore, timpa data siswa & piket di halaman ----------
async function dbMuatSemuaData() {
  if (typeof students === 'undefined') return;

  try {
    const snapshot = await db.collection(KOLEKSI_FIRESTORE).get();

    // Siapkan penampung nama piket per hari
    const piketPerHari = {};
    HARI_PIKET.forEach(h => piketPerHari[h] = []);

    snapshot.forEach(doc => {
      const no = parseInt(doc.id);
      const data = doc.data();
      const siswa = students.find(s => s.no === no);
      if (!siswa) return;

      if (data.telp) siswa.telp = data.telp;
      if (data.ig) siswa.ig = data.ig;

      (data.piket || []).forEach(hari => {
        if (piketPerHari[hari]) piketPerHari[hari].push(siswa.nama);
      });
    });

    // Timpa piketData (variabel dari script.js) sesuai hasil terbaru
    if (typeof piketData !== 'undefined') {
      piketData.forEach(p => {
        const daftarNama = piketPerHari[p.hari];
        p.nama = (daftarNama && daftarNama.length > 0)
          ? daftarNama.join(', ')
          : 'Belum ada yang mengisi';
      });
    }

    // Refresh tampilan yang sudah ada (fungsi-fungsi ini sudah ada di script.js)
    if (typeof renderPiket === 'function') renderPiket();
    if (typeof filterStudents === 'function') {
      filterStudents(); // ini otomatis panggil renderStudents() dengan data terbaru
    } else if (typeof renderStudents === 'function') {
      renderStudents(students);
    }
  } catch (err) {
    console.error('Gagal memuat data dari Firestore:', err);
  }
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  dbIsiDropdownNama();
  dbMuatSemuaData();

  if (selectNamaSiswa) selectNamaSiswa.addEventListener('change', dbSaatNamaDipilih);
  if (formIsiData) formIsiData.addEventListener('submit', dbSimpanData);
});
