// ========================================================================
// AUTH.JS — Sistem login/signup ASLI pakai Firebase Authentication.
// Password TIDAK PERNAH disimpan/di-hash sendiri di sini — semua proses
// hashing password dikerjakan oleh server Firebase (aman, standar industri).
// Data profil (nama, role, status) disimpan di Firestore collection "users",
// terpisah dari data password (yang memang tidak pernah bisa diakses
// siapapun, termasuk kita, lewat Firebase Auth).
// ========================================================================

const AUTH = {
  user: null,          // objek user dari Firebase Auth (punya uid, email, dst)
  profile: null,       // dokumen dari Firestore users/{uid} — berisi name, role, status, permissions
  ready: false,        // true setelah pengecekan status login awal selesai
};

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/user-not-found': 'Email atau password salah.',
  'auth/wrong-password': 'Email atau password salah.',
  'auth/invalid-credential': 'Email atau password salah.',
  'auth/user-disabled': 'Akun ini dinonaktifkan. Hubungi admin.',
  'auth/too-many-requests': 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.',
  'auth/network-request-failed': 'Gagal terhubung ke server. Cek koneksi internet.',
  // dua di bawah ini dipakai nanti oleh fitur "Tambah User" di Admin Panel:
  'auth/email-already-in-use': 'Email ini sudah terdaftar.',
  'auth/weak-password': 'Password terlalu pendek, minimal 6 karakter.',
};

function authFriendlyError(error) {
  return AUTH_ERROR_MESSAGES[error.code] || ('Terjadi kesalahan: ' + error.message);
}

// ---------------------------------------------------------------
// SIGNUP — bikin akun baru (role default: siswa, harus dinaikkan
// manual jadi admin lewat Firestore Console untuk akun pertama)
// ---------------------------------------------------------------
async function authSignUp(name, email, password) {
  const cred = await authFirebase.createUserWithEmailAndPassword(email, password);
  await cred.user.updateProfile({ displayName: name });

  await db.collection('users').doc(cred.user.uid).set({
    name: name,
    email: email,
    role: 'siswa',
    status: 'aktif',
    permissions: {
      view_public: true,
      view_class_data: true,
      view_member_data: true,
      view_gallery: true,
      view_private_data: false,
      manage_profile: true,
      admin_access: false,
    },
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  return cred.user;
}

// ---------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------
async function authLogIn(email, password) {
  const cred = await authFirebase.signInWithEmailAndPassword(email, password);
  return cred.user;
}

// ---------------------------------------------------------------
// LOGOUT
// ---------------------------------------------------------------
async function authLogOut() {
  await authFirebase.signOut();
  AUTH.user = null;
  AUTH.profile = null;
}

// ---------------------------------------------------------------
// Ambil profil (role, status, permissions) dari Firestore
// ---------------------------------------------------------------
async function authFetchProfile(uid) {
  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

// ---------------------------------------------------------------
// Pantau status login secara real-time. Dipanggil sekali saat halaman
// dimuat — inilah yang membuat sesi tetap tersambung walau di-refresh.
// ---------------------------------------------------------------
function authInit(onChange) {
  authFirebase.onAuthStateChanged(async (user) => {
    AUTH.user = user;
    if (user) {
      try {
        AUTH.profile = await authFetchProfile(user.uid);
      } catch (e) {
        AUTH.profile = null;
      }
    } else {
      AUTH.profile = null;
    }
    AUTH.ready = true;
    if (onChange) onChange(AUTH.user, AUTH.profile);
  });
}

// ========================================================================
// LAPISAN UI — hubungkan form Login/Signup & kotak identitas sidebar
// ke fungsi-fungsi auth di atas.
// ========================================================================

function authShowErr(elId, message) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerText = message;
  el.classList.add('show');
}
function authClearErr(elId) {
  const el = document.getElementById(elId);
  if (el) { el.classList.remove('show'); el.innerText = ''; }
}

async function authHandleLogin(event) {
  event.preventDefault();
  authClearErr('authLoginError');
  const email = document.getElementById('authLoginEmail').value.trim();
  const password = document.getElementById('authLoginPassword').value;
  const btn = document.getElementById('authLoginBtn');
  btn.disabled = true; btn.innerText = 'Memproses...';
  try {
    await authLogIn(email, password);
    authHideScreen();
  } catch (err) {
    authShowErr('authLoginError', authFriendlyError(err));
  } finally {
    btn.disabled = false; btn.innerText = 'Masuk';
  }
  return false;
}

// Catatan: tidak ada lagi form Daftar publik (sesuai permintaan — akun
// dibuat admin, bukan self-registration). Fungsi inti authSignUp() di atas
// tetap disimpan karena akan dipakai fitur "Tambah User" di Admin Panel
// (admin yang membuatkan akun, bukan orang mendaftar sendiri).

async function authIdentityBtnClick() {
  if (AUTH.user) {
    await authLogOut();
    authUpdateIdentityBox();
    authShowScreenIfNeeded();
  } else {
    authShowScreenIfNeeded(true);
  }
}

function authContinueAsGuest() {
  authHideScreen();
}

function authShowScreenIfNeeded(force) {
  const welcomeScreen = document.getElementById('welcomeScreen');
  const isWelcomeGone = !welcomeScreen || welcomeScreen.classList.contains('hide');
  if (!isWelcomeGone && !force) return; // masih di welcome screen, belum saatnya
  if (AUTH.user && !force) return; // sudah login, tidak perlu tampilkan layar auth
  const screen = document.getElementById('authScreen');
  if (screen) screen.classList.remove('hide');
}

function authHideScreen() {
  const screen = document.getElementById('authScreen');
  if (screen) screen.classList.add('hide');
  authUpdateIdentityBox();
}

function authUpdateIdentityBox() {
  const textEl = document.getElementById('authIdentityText');
  const btnEl = document.getElementById('authIdentityBtn');
  if (!textEl || !btnEl) return;
  if (AUTH.user) {
    const name = (AUTH.profile && AUTH.profile.name) || AUTH.user.email;
    const role = AUTH.profile ? AUTH.profile.role : '...';
    textEl.innerText = `${name} · ${role}`;
    btnEl.innerText = 'Keluar';
  } else {
    textEl.innerText = 'Tamu';
    btnEl.innerText = 'Masuk';
  }
}

// Mulai pantau status login begitu halaman siap
document.addEventListener('DOMContentLoaded', () => {
  authInit((user, profile) => {
    authUpdateIdentityBox();
    // Kalau ternyata user sudah login (sesi sebelumnya) DAN layar auth sedang
    // tampil, otomatis tutup — tidak perlu login ulang tiap buka website.
    if (user) {
      const screen = document.getElementById('authScreen');
      if (screen && !screen.classList.contains('hide')) authHideScreen();
    }
  });
});
