// ========================================================================
// ADMIN.JS — Panel Admin: "Tambah Akun Siswa"
// ------------------------------------------------------------------------
// Kenapa perlu "secondary app"?
// createUserWithEmailAndPassword() di Firebase, begitu berhasil, otomatis
// login SEBAGAI akun yang baru dibuat. Kalau kita pakai koneksi utama
// (authFirebase), admin yang sedang login akan ke-logout dan malah masuk
// sebagai akun siswa yang baru dibuat. Makanya kita buka "jalur kedua" ke
// Firebase (secondaryApp) khusus untuk proses bikin akun, supaya sesi
// login admin di jalur utama tidak terganggu.
// ========================================================================

const secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = secondaryApp.auth();

const formTambahSiswa = document.getElementById('formTambahSiswa');
const inputAdminNama = document.getElementById('inputAdminNama');
const adminNamaOptions = document.getElementById('adminNamaOptions');
const inputAdminEmail = document.getElementById('inputAdminEmail');
const inputAdminPassword = document.getElementById('inputAdminPassword');
const selectAdminRole = document.getElementById('selectAdminRole');
const adminTambahBtn = document.getElementById('adminTambahBtn');
const adminTambahStatus = document.getElementById('adminTambahStatus');
const adminUserList = document.getElementById('adminUserList');
const navAdminPanel = document.getElementById('navAdminPanel');
const adminCredBox = document.getElementById('adminCredBox');
const adminCredEmail = document.getElementById('adminCredEmail');
const adminCredPassword = document.getElementById('adminCredPassword');
const adminCredCopyBtn = document.getElementById('adminCredCopyBtn');

// ---------------------------------------------------------------
// Isi daftar nama di dropdown pencarian, dari array `students`
// (SUMBER DATA YANG SAMA dipakai oleh dropdown di halaman
// "Isi Data Saya" — lihat database.js -> dbIsiDropdownNama()).
// Dipanggil ulang tiap Admin Panel dibuka, supaya kalau daftar
// siswa berubah, pilihannya otomatis ikut ter-update.
// ---------------------------------------------------------------
function adminIsiDaftarNama() {
  if (!adminNamaOptions || typeof students === 'undefined') return;
  adminNamaOptions.innerHTML = students
    .map(s => `<option value="${String(s.nama).replace(/"/g, '&quot;')}"></option>`)
    .join('');
}

// ---------------------------------------------------------------
// Tambah 1 akun siswa/admin baru
// ---------------------------------------------------------------
async function adminTambahAkun(event) {
  event.preventDefault();

  const namaInput = inputAdminNama.value.trim();
  const email = inputAdminEmail.value.trim();
  const password = inputAdminPassword.value;
  const role = selectAdminRole.value;

  if (!namaInput || !email || !password) {
    adminTampilkanStatus('Semua field wajib diisi.', true);
    return;
  }

  // Pastikan nama yang diketik/pilih memang cocok dengan salah satu
  // siswa di data yang sudah ada (mencegah salah ketik atau nama
  // yang tidak terhubung ke siswa manapun). Pencocokan tanpa
  // memandang huruf besar/kecil, lalu dipakai nama versi ASLI
  // (persis seperti di data siswa) supaya konsisten di seluruh web.
  let siswaCocok = null;
  if (typeof students !== 'undefined') {
    siswaCocok = students.find(s => s.nama.trim().toLowerCase() === namaInput.toLowerCase());
  }
  if (!siswaCocok) {
    adminTampilkanStatus('Nama tidak ditemukan di data siswa. Pilih nama dari daftar yang muncul.', true);
    return;
  }
  const nama = siswaCocok.nama;

  if (password.length < 6) {
    adminTampilkanStatus('Password minimal 6 karakter.', true);
    return;
  }

  adminTambahBtn.disabled = true;
  adminTambahBtn.textContent = 'Membuat akun...';
  if (adminCredBox) adminCredBox.style.display = 'none';

  try {
    // 1) Bikin akun login (Firebase Auth) lewat jalur KEDUA, supaya
    //    sesi login admin di jalur utama tidak ikut berubah.
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: nama });

    // 2) Simpan profil (nama, role, status, permissions) ke Firestore.
    //    `studentNo` menyimpan No. Absen siswa yang dipilih, supaya
    //    akun ini tetap terhubung jelas ke data siswa yang sesuai
    //    (dipakai kalau nanti ada fitur yang perlu mencocokkan
    //    akun login <-> data di koleksi "dataSiswa").
    //    Ini pakai `db` dari jalur UTAMA (koneksi admin yang sedang
    //    login), makanya di firestore.rules, aturan "create" untuk
    //    collection users mengizinkan admin membuat dokumen untuk
    //    UID siapa saja (tidak hanya UID diri sendiri).
    await db.collection('users').doc(cred.user.uid).set({
      name: nama,
      studentNo: siswaCocok.no,
      email: email,
      role: role,
      status: 'aktif',
      permissions: {
        view_public: true,
        view_class_data: true,
        view_member_data: true,
        view_gallery: true,
        view_private_data: role === 'admin',
        manage_profile: true,
        admin_access: role === 'admin',
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    // 3) Keluar dari sesi jalur KEDUA (yang otomatis login sebagai akun
    //    baru tadi) supaya bersih, tidak numpuk sesi tak terpakai.
    await secondaryAuth.signOut();

    adminTampilkanStatus(`Akun untuk "${nama}" berhasil dibuat.`, false);
    adminTampilkanKredensial(email, password);
    formTambahSiswa.reset();
    selectAdminRole.value = 'siswa';
    adminMuatDaftarUser();
  } catch (err) {
    adminTampilkanStatus(authFriendlyError(err), true);
  } finally {
    adminTambahBtn.disabled = false;
    adminTambahBtn.textContent = 'Tambah Akun';
  }
}

function adminTampilkanStatus(pesan, isError) {
  if (!adminTambahStatus) return;
  adminTambahStatus.textContent = pesan;
  adminTambahStatus.classList.toggle('isi-data-status-error', isError);
  adminTambahStatus.classList.add('show');
  setTimeout(() => adminTambahStatus.classList.remove('show'), 6000);
}

// ---------------------------------------------------------------
// Tampilkan email + password akun yang BARU SAJA dibuat, SATU KALI.
// Ini bukan disimpan di database — cuma ditaruh sebentar di layar
// (variabel JS), karena Firebase TIDAK PERNAH menyimpan password
// dalam bentuk yang bisa dibaca ulang (di-hash demi keamanan, sama
// seperti sistem login mana pun yang benar). Jadi satu-satunya
// momen admin bisa "melihat" passwordnya ya cuma sesaat setelah
// akun ini dibuat.
// ---------------------------------------------------------------
function adminTampilkanKredensial(email, password) {
  if (!adminCredBox) return;
  adminCredEmail.textContent = email;
  adminCredPassword.textContent = password;
  adminCredBox.style.display = 'block';
  if (adminCredCopyBtn) {
    adminCredCopyBtn.textContent = 'Salin Email & Password';
    adminCredCopyBtn.classList.remove('copied');
  }
}

async function adminSalinKredensial() {
  const teks = `Email: ${adminCredEmail.textContent}\nPassword: ${adminCredPassword.textContent}`;
  try {
    await navigator.clipboard.writeText(teks);
  } catch (err) {
    // Fallback untuk browser/webview lama yang tidak dukung clipboard API
    const textarea = document.createElement('textarea');
    textarea.value = teks;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
  adminCredCopyBtn.textContent = 'Tersalin!';
  adminCredCopyBtn.classList.add('copied');
  setTimeout(() => {
    adminCredCopyBtn.textContent = 'Salin Email & Password';
    adminCredCopyBtn.classList.remove('copied');
  }, 2500);
}

// ---------------------------------------------------------------
// Link WhatsApp untuk permintaan reset password.
// CATATAN JUJUR: tidak ada cara aman untuk mengubah password akun
// ORANG LAIN langsung dari browser (itu butuh server/Admin SDK yang
// tidak dipakai di website statis ini). Jalan keluarnya: siswa
// hubungi admin lewat WhatsApp, lalu admin PROSES MANUAL (hapus akun
// lama di Admin Panel ini, lalu buat ulang dengan password baru).
// (WA_NOMOR_ADMIN didefinisikan di firebase-config.js, dipakai bareng
// dengan link "Lupa password?" di halaman Login — lihat auth.js)
// ---------------------------------------------------------------
function adminBuatLinkResetWA(nama, email) {
  const pesan = `Halo Admin, saya *${nama}* (${email}) ingin reset password akun Portal Kelas TM-1.`;
  return `https://wa.me/${WA_NOMOR_ADMIN}?text=${encodeURIComponent(pesan)}`;
}

// ---------------------------------------------------------------
// Tampilkan daftar akun yang sudah terdaftar (dari Firestore)
// ---------------------------------------------------------------
async function adminMuatDaftarUser() {
  if (!adminUserList) return;
  adminUserList.innerHTML = '<p class="admin-list-empty">Memuat daftar akun...</p>';
  try {
    // CATATAN: sengaja TIDAK pakai orderBy('createdAt') di query
    // Firestore-nya. Query orderBy() otomatis MENYEMBUNYIKAN dokumen
    // yang tidak punya field itu — misalnya akun admin pertama yang
    // dibuat manual lewat Firebase Console (tidak ada field createdAt
    // sama sekali). Supaya SEMUA akun pasti muncul, kita ambil semua
    // dokumen dulu, baru diurutkan di sisi browser (JS) di bawah.
    const snapshot = await db.collection('users').get();
    if (snapshot.empty) {
      adminUserList.innerHTML = '<p class="admin-list-empty">Belum ada akun.</p>';
      return;
    }

    const daftarUser = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Urutkan: yang punya createdAt (paling baru dibuat) di atas;
    // yang tidak punya createdAt (misal akun admin manual) di bawah.
    daftarUser.sort((a, b) => {
      const waktuA = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
      const waktuB = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
      return waktuB - waktuA;
    });

    adminUserList.innerHTML = daftarUser.map(u => {
      const namaAman = (u.name || '(tanpa nama)').replace(/</g, '&lt;');
      const emailAman = (u.email || '-').replace(/</g, '&lt;');
      const noAbsen = u.studentNo ? `No. Absen ${u.studentNo} • ` : '';
      const linkWA = adminBuatLinkResetWA(u.name || '-', u.email || '-');
      return `
        <div class="admin-user-row">
          <div class="admin-user-avatar">${namaAman.charAt(0).toUpperCase()}</div>
          <div class="admin-user-info">
            <div class="admin-user-name">${namaAman}</div>
            <div class="admin-user-email">${noAbsen}${emailAman}</div>
          </div>
          <div class="admin-user-actions">
            <a class="admin-user-reset-btn" href="${linkWA}" target="_blank" rel="noopener">Reset via WA</a>
            <span class="admin-user-role admin-user-role-${u.role === 'admin' ? 'admin' : 'siswa'}">${u.role || '-'}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    adminUserList.innerHTML = '<p class="admin-list-empty">Gagal memuat daftar akun.</p>';
    console.error('Gagal memuat daftar user:', err);
  }
}

// ---------------------------------------------------------------
// Tampilkan/sembunyikan menu "Admin Panel" sesuai role yang login
// ---------------------------------------------------------------
function adminUpdateNavVisibility() {
  if (!navAdminPanel) return;
  const isAdmin = !!(AUTH.profile && AUTH.profile.role === 'admin');
  navAdminPanel.style.display = isAdmin ? 'flex' : 'none';
  if (isAdmin) {
    adminIsiDaftarNama();
    adminMuatDaftarUser();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (formTambahSiswa) formTambahSiswa.addEventListener('submit', adminTambahAkun);
  if (adminCredCopyBtn) adminCredCopyBtn.addEventListener('click', adminSalinKredensial);
  adminIsiDaftarNama();

  // authInit() sudah dipanggil di auth.js dan akan memicu callback-nya
  // sendiri; di sini kita "numpang" dengan mengecek AUTH secara berkala
  // sesaat setelah halaman siap, lalu setiap kali status auth berubah.
  authFirebase.onAuthStateChanged(() => {
    // beri jeda singkat supaya AUTH.profile di auth.js sempat terisi
    setTimeout(adminUpdateNavVisibility, 300);
  });
});
