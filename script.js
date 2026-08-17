// ========================================================================
// DATA SISWA (dari WEB B — 36 siswa, database asli kelas TM-1)
// Placeholder "Nama Siswa N" berarti data siswa itu belum diisi.
// Silakan edit satu per satu sesuai data asli siswa TM-1.
// ========================================================================
const students = [];
for (let i = 1; i <= 36; i++) {
  students.push({
    no: i,
    nama: `Nama Siswa ${i}`,
    jk: 'L',
    ttl: '-',
    telp: '-',
    ig: '-'
  });
}
// Data siswa yang sudah diisi (diurutkan alfabetis berdasarkan nama, No. Absen 1-36 — sudah lengkap semua)
const namaSiswaAsli = [
  'Abdullah Musthofa Zaki Habibi',
  'Adelardio Azhaire Raiyansha',
  'Adji Marwanto',
  'Andika Farhan Naufal',
  'Arthur Deka Nio Deputra',
  'Atha Rasyid Suntara',
  'Azzam Naufal Karim',
  'Bagus Muhamad Ramdhani Syam',
  'Dean Nurachman',
  'Dimas Prasyetio',
  'Fadhlan Fathurrahman Sutisna',
  'Fadil Abdul Rasyid',
  'Farid Irfan Nur Hakim',
  'Fathi Ikhsan Firdaus',
  'Hafidz Misbahudin',
  'Kaisar Amir Hasan',
  'Moch Nylo Kholid Defyro',
  'Muhamad Hikmal Nursyah',
  'Muhammad Adachi Ramadhan',
  'Muhammad Ain Nun Naim',
  'Muhammad Alwi Alfadhilah',
  'Muhammad Dzikrulloh',
  'Muhammad Fadlan Hadiansyah',
  'Muhammad Fajri Annyda',
  'Muhammad Farhan Widianto',
  'Muhammad Frananda Kurniawan',
  'Muhammad Luthfi Hermansyah',
  'Muhammad Raisya Adyanova',
  'Muhammad Tohaery Tirta',
  'Nandi Esa Ferdian',
  'Pramudia Dwi Ikhsan',
  'Rafka Raditya',
  'Reza Sigi Mastiar',
  'Riski Reyaldi',
  'Sendy Faisal Nugraha',
  'Zaidan Refaldi',
];
namaSiswaAsli.forEach((nama, idx) => { students[idx].nama = nama; });
// No. telepon yang sudah tercatat sebelumnya
students.find(s => s.nama === 'Riski Reyaldi').telp = '081219525933';

// ========================================================================
// PIKET HARIAN (dari WEB B — silakan edit nama sesuai jadwal piket asli)
// ========================================================================
const piketData = [
  { hari: 'Senin', nama: 'Nama 1, Nama 2, Nama 3, Nama 4' },
  { hari: 'Selasa', nama: 'Nama 1, Nama 2, Nama 3, Nama 4' },
  { hari: 'Rabu', nama: 'Nama 1, Nama 2, Nama 3, Nama 4' },
  { hari: 'Kamis', nama: 'Nama 1, Nama 2, Nama 3, Nama 4' },
  { hari: 'Jumat', nama: 'Nama 1, Nama 2, Nama 3, Nama 4' },
];

// ========================================================================
// STRUKTUR / PENGURUS KELAS (dari WEB B)
// ========================================================================
const strukturData = [
  { nama: 'Nandi Esa Ferdian', jabatan: 'Ketua Kelas' },
  { nama: 'Arthur Deka', jabatan: 'Wakil Ketua' },
  { nama: 'Kaisar Amil.H, M.Fadhil', jabatan: 'Sekertaris' },
  { nama: 'Kaisar, M.Fadhil', jabatan: 'Bendahara' },
];

// ========================================================================
// MEDIA SOSIAL KELAS (dari WEB B)
// ========================================================================
const sosmedData = [
  { nama: 'Instagram', sub: '@tm1_official', url: 'https://instagram.com', icon: '📷' },
  { nama: 'TikTok', sub: '@tm1_story', url: 'https://tiktok.com', icon: '🎵' },
  { nama: 'Grup WhatsApp', sub: 'Komunitas Kelas TM-1', url: 'https://whatsapp.com', icon: '💬' },
];

// ========================================================================
// PENGUMUMAN (dari WEB B — silakan tambah pengumuman baru di sini)
// ========================================================================
const announcements = [
  {
    id: 1,
    title: 'Pengumuman Kelas',
    date: null,
    category: 'Umum',
    desc: 'Selamat datang di website resmi kelas TM-1! Harap selalu mengecek jadwal piket dan kegiatan harian di sini.'
  }
];

// ========================================================================
// KEGIATAN KELAS (belum ada data dari WEB B — silakan isi agenda kelas di sini)
// ========================================================================
const activities = [];

// ========================================================================
// JADWAL MATA PELAJARAN (dari WEB B — silakan edit nama mapel / warna / kode)
// ========================================================================
const warnaJadwal = {
  'M':   { mapel: 'Permesinan',                  warna: '#f7c9b6' },
  '32A': { mapel: 'Agama',                        warna: '#dbe6cd' },
  '34D': { mapel: 'Olahraga',                     warna: '#c9920b' },
  '39K': { mapel: 'Fisika',                       warna: '#7f7a00' },
  '39H': { mapel: 'Matematika',                   warna: '#a2a1fe' },
  '29J': { mapel: 'Informatika',                  warna: '#ea98e0' },
  '21B': { mapel: 'PPKn',                         warna: '#cfe6f5' },
  '38F': { mapel: 'SBDP',                         warna: '#9a33ed' },
  '16M': { mapel: 'Belum diberi nama (kode 16M)', warna: '#f7c9b6' },
  '23I': { mapel: 'Bahasa Inggris',               warna: '#18c3f2' },
  '35E': { mapel: 'Sejarah',                      warna: '#3796fa' },
  '7L':  { mapel: 'Kimia',                        warna: '#d7ffff' },
  '33S': { mapel: 'Bimbingan Konseling',          warna: '#94a3b8' },
  '37G': { mapel: 'Bahasa Jepang',                warna: '#ffeb3b' },
  '38C': { mapel: 'Bahasa Indonesia',             warna: '#f6e4c4' }
};

const jamPelajaran = [
  '07.00 - 07.20', '07.20 - 08.05', '08.05 - 08.50', '08.50 - 09.35',
  '09.35 - 10.20', '10.20 - 10.35', '10.35 - 11.20', '11.20 - 12.05',
  '12.05 - 12.30', '12.30 - 13.15', '13.15 - 14.00', '14.00 - 14.45', '14.45 - 15.30'
];

const jadwal = {
  Senin:  [null, 'M', 'M', 'M', 'M', null, 'M', 'M', null, 'M', 'M', 'M', 'M'],
  Selasa: [null, '32A', '32A', '34D', '34D', null, '39K', '39K', null, '39H', '39H', '39H', '39H'],
  Rabu:   [null, '29J', '29J', '29J', '29J', null, '21B', '21B', null, '38F', '38F', '16M', '16M'],
  Kamis:  [null, '23I', '23I', '23I', '23I', null, '35E', '35E', null, '7L', '7L', '7L', null],
  Jumat:  [null, null, '33S', '37G', '37G', null, '37G', '37G', null, '38C', '38C', '38C', '38C']
};

// ========== NAVIGATION (WEB A) ==========
function navigateTo(page, element) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  if (element) element.classList.add('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  if (window.innerWidth <= 1024) {
    document.getElementById('sidebar').classList.remove('open');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ========== JAM DIGITAL (dari WEB B) ==========
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const el = document.getElementById('clock');
  if (el) el.innerText = `${h}:${m}:${s} WIB`;
}

// ========== STUDENTS (data WEB B, tampilan card WEB A) ==========
function renderStudents(data) {
  const grid = document.getElementById('student-grid');
  const empty = document.getElementById('student-empty');
  if (data.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';
  grid.innerHTML = data.map(s => `
    <div class="student-card" onclick="openStudentModal(${s.no})">
      <div class="student-avatar">${s.nama.charAt(0)}</div>
      <div class="student-name">${s.nama}</div>
      <div class="student-info">No. Absen ${s.no} • ${s.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</div>
      <div class="student-tags">
        <span class="tag">TM1-${String(s.no).padStart(4, '0')}</span>
      </div>
    </div>
  `).join('');
}

function filterStudents() {
  const search = document.getElementById('student-search').value.toLowerCase();
  const filtered = students.filter(s => s.nama.toLowerCase().includes(search));
  renderStudents(filtered);
}

function openStudentModal(no) {
  const s = students.find(st => st.no === no);
  if (!s) return;
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-avatar">${s.nama.charAt(0)}</div>
    <h3 style="text-align:center;margin-bottom:20px">${s.nama}</h3>
    <div class="detail-row">
      <span class="detail-label">Nomor Absen</span>
      <span class="detail-value">${s.no}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Jenis Kelamin</span>
      <span class="detail-value">${s.jk === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">TTL</span>
      <span class="detail-value">${s.ttl}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">No. Telepon</span>
      <span class="detail-value">${s.telp}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Instagram</span>
      <span class="detail-value">${s.ig}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Kode Kartu</span>
      <span class="detail-value" style="color:var(--accent-cyan)">TM1-${String(s.no).padStart(4, '0')}</span>
    </div>
  `;
  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (!e || e.target.id === 'modal-overlay') {
    document.getElementById('modal-overlay').classList.remove('active');
    document.body.style.overflow = '';
  }
}

// ========== PIKET (dari WEB B) ==========
function renderPiket() {
  const list = document.getElementById('piket-list');
  if (!list) return;
  list.innerHTML = piketData.map(p => `
    <div class="info-item">
      <span class="info-item-label">${p.hari}</span>
      <span class="info-item-value">${p.nama}</span>
    </div>
  `).join('');
}

// ========== STRUKTUR KELAS (dari WEB B) ==========
function renderStruktur() {
  const list = document.getElementById('struktur-list');
  if (!list) return;
  list.innerHTML = strukturData.map(p => `
    <div class="info-item">
      <span class="info-item-value">${p.nama}</span>
      <span class="role-badge">${p.jabatan}</span>
    </div>
  `).join('');
}

// ========== SOSMED (dari WEB B) ==========
function renderSosmed() {
  const list = document.getElementById('sosmed-list');
  if (!list) return;
  list.innerHTML = sosmedData.map(s => `
    <a href="${s.url}" target="_blank" class="sosmed-link">
      <div class="sosmed-icon">${s.icon}</div>
      <div>
        <strong>${s.nama}</strong>
        <p>${s.sub}</p>
      </div>
    </a>
  `).join('');
}

// ========== JADWAL PER-JAM (logic WEB B, tampilan card WEB A) ==========
let hariJadwalAktif = 'Senin';

function jamKeMenit(teksJam) {
  const [jam, menit] = teksJam.split('.').map(Number);
  return (jam * 60) + menit;
}

function updateJadwalNow() {
  const el = document.getElementById('jadwalNow');
  if (!el) return;
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  el.innerText = `Jam sekarang: ${h}:${m} WIB`;
}

function renderJadwal(hari) {
  const container = document.getElementById('schedule-content');
  if (!container) return;

  updateJadwalNow();

  const kodeHariIni = jadwal[hari] || [];
  const now = new Date();
  const namaHariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][now.getDay()];
  const menitSekarang = (now.getHours() * 60) + now.getMinutes();

  container.innerHTML = `<div class="schedule-grid">` + jamPelajaran.map((jam, i) => {
    const kode = kodeHariIni[i];
    const info = kode ? warnaJadwal[kode] : null;
    const [jamMulai, jamSelesai] = jam.split(' - ');
    const sedangBerlangsung = hari === namaHariIni &&
      menitSekarang >= jamKeMenit(jamMulai) &&
      menitSekarang < jamKeMenit(jamSelesai);

    if (!info) {
      return `
        <div class="jadwal-row jadwal-kosong ${sedangBerlangsung ? 'jadwal-aktif' : ''}">
          <div class="jadwal-jam">${jam}</div>
          <div class="jadwal-mapel-box">
            <span class="jadwal-mapel-kosong">Istirahat / Kosong</span>
          </div>
          ${sedangBerlangsung ? '<span class="jadwal-live-badge">Sekarang</span>' : ''}
        </div>`;
    }

    return `
      <div class="jadwal-row ${sedangBerlangsung ? 'jadwal-aktif' : ''}" style="--mapel-color: ${info.warna}">
        <div class="jadwal-jam">${jam}</div>
        <div class="jadwal-mapel-box">
          <span class="jadwal-mapel-nama">${info.mapel}</span>
        </div>
        <span class="jadwal-kode-badge" style="--mapel-color: ${info.warna}">${kode}</span>
        ${sedangBerlangsung ? '<span class="jadwal-live-badge">Sedang Berlangsung</span>' : ''}
      </div>`;
  }).join('') + `</div>`;
}

function pilihHariJadwal(hari, element) {
  hariJadwalAktif = hari;
  document.querySelectorAll('#hariPills .tab-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  renderJadwal(hari);
}

// ========== ANNOUNCEMENTS (struktur WEB A, isi data WEB B) ==========
function renderAnnouncements() {
  const list = document.getElementById('announcement-list');
  const homeList = document.getElementById('home-announcements');
  const statEl = document.getElementById('stat-pengumuman');
  if (statEl) statEl.innerText = announcements.length;

  const template = a => `
    <div class="announcement-item">
      <div class="announcement-meta">
        ${a.date ? `<span class="announcement-date">${formatDate(a.date)}</span>` : ''}
        <span class="announcement-category">${a.category}</span>
      </div>
      <div class="announcement-title">${a.title}</div>
      <div class="announcement-desc">${a.desc}</div>
    </div>
  `;

  if (list) list.innerHTML = announcements.map(template).join('');
  if (homeList) homeList.innerHTML = announcements.slice(0, 3).map(template).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ========== ACTIVITIES (struktur WEB A — silakan isi agenda kelas) ==========
function renderActivities() {
  const timeline = document.getElementById('activity-timeline');
  const statEl = document.getElementById('stat-kegiatan');
  if (statEl) statEl.innerText = activities.length;
  if (!timeline) return;

  if (activities.length === 0) {
    timeline.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎯</div>
        <h4>Belum ada kegiatan</h4>
        <p>Agenda kegiatan kelas akan tampil di sini.</p>
      </div>`;
    return;
  }

  timeline.innerHTML = activities.map(a => `
    <div class="activity-item">
      <div class="activity-card">
        <div class="activity-date">${formatDate(a.date)}</div>
        <div class="activity-title">${a.title}</div>
        <div class="activity-desc">${a.desc}</div>
      </div>
    </div>
  `).join('');
}

// ========== MUSIK MARS SEKOLAH (dari WEB B) ==========
const musikSekolah = document.getElementById('musikSekolah');
const musicToggleBtn = document.getElementById('musicToggle');
const musicIcon = document.getElementById('musicIcon');

function updateMusicIcon(playing) {
  if (!musicIcon || !musicToggleBtn) return;
  musicIcon.innerText = playing ? '⏸️' : '🎵';
  musicToggleBtn.classList.toggle('playing', playing);
}

function toggleMusik() {
  if (!musikSekolah) return;
  if (musikSekolah.paused) {
    musikSekolah.play().catch(err => tampilkanErrorMusik(err));
  } else {
    musikSekolah.pause();
  }
}

function tampilkanErrorMusik(err) {
  const notice = document.getElementById('musicNotice');
  if (!notice) return;
  console.error('Gagal memutar musik:', err);
  notice.innerText = 'Musik gagal diputar. Pastikan file "mars-perguruan-cikini.mp3" ada di folder yang sama dengan index.html, lalu tap tombol musik.';
  notice.classList.add('show');
  setTimeout(() => notice.classList.remove('show'), 6000);
}

if (musikSekolah) {
  musikSekolah.addEventListener('play', () => updateMusicIcon(true));
  musikSekolah.addEventListener('pause', () => updateMusicIcon(false));
  musikSekolah.addEventListener('error', () => tampilkanErrorMusik(musikSekolah.error));
}

// ========== WELCOME SCREEN (dari WEB B) ==========
function masukWebsite() {
  const welcomeScreen = document.getElementById('welcomeScreen');
  if (welcomeScreen) welcomeScreen.classList.add('hide');
  if (musikSekolah) {
    const playPromise = musikSekolah.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => tampilkanErrorMusik(err));
    }
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', function() {
  updateClock();
  setInterval(updateClock, 1000);

  renderStudents(students);
  renderPiket();
  renderStruktur();
  renderSosmed();
  renderAnnouncements();
  renderActivities();

  const namaHariIni = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date().getDay()];
  const hariAwal = jadwal[namaHariIni] ? namaHariIni : 'Senin';
  const pillAwal = Array.from(document.querySelectorAll('#hariPills .tab-btn'))
    .find(pill => pill.textContent.trim() === hariAwal);
  pilihHariJadwal(hariAwal, pillAwal);
  setInterval(() => renderJadwal(hariJadwalAktif), 60000);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });
});
