// ========================================================================
// MUSIC PLAYER — fitur tambahan (file terpisah, tidak mengubah script.js)
//
// PENTING:
// Player ini memakai ULANG elemen <audio id="musikSekolah"> yang sudah ada
// di index.html. Jadi tidak ada audio kedua yang diam-diam ikut nyala.
// - Saat website pertama dibuka, tombol "Masuk" (masukWebsite() di
//   script.js) TETAP yang memutar lagu sekolah secara otomatis, TIDAK
//   diubah sama sekali di sini.
// - Lagu sekolah selalu jadi track index 0 di playlist ini dan tidak boleh
//   dihapus (lihat array playlistLagu di bawah).
// - Halaman "Music Player" di sidebar dibuka lewat sistem navigateTo()
//   yang SUDAH ADA di script.js (tidak ada routing baru yang dibuat).
// ========================================================================

// ---------- DAFTAR PLAYLIST ----------
// Track pertama = lagu sekolah, WAJIB ada, WAJIB tetap default.
// Silakan tambah lagu lain: taruh file mp3 di folder yang sama dengan
// index.html, lalu tambahkan objek baru mengikuti contoh di bawah.
// "cover" boleh dikosongkan (""), nanti otomatis pakai logo sekolah.
const playlistLagu = [
  {
    judul: 'Mars Perguruan Cikini-KIIC',
    artis: 'Lagu Wajib Sekolah',
    src: 'mars-perguruan-cikini.mp3',
    cover: 'logo-sekolah.png',
    isDefault: true
  },

  // ---- Lagu tambahan pilihan kelas (file mp3 sudah ditaruh di folder yang
  //      sama dengan index.html) ----
  {
    judul: 'Sesi Potret',
    artis: 'Ari Lesmana',
    src: 'Sesi potret.mp3',
    cover: 'cover-sesi-potret.jpg'
  },
  {
    judul: 'Shape of My Heart',
    artis: 'Backstreet Boys',
    src: 'Shape of my hart.mp3',
    cover: 'cover-shape-of-my-heart.jpg'
  }

  // Contoh menambah lagu asli kelas:
  // {
  //   judul: 'Judul Lagu',
  //   artis: 'Nama Artis / Penyanyi',
  //   src: 'nama-file-lagu.mp3',
  //   cover: 'cover-lagu.jpg'
  // },
];

const COVER_DEFAULT = 'logo-sekolah.png';

// ---------- STATE ----------
let mpCurrentIndex = 0;
let mpIsSeeking = false;

// ---------- ELEMEN ----------
const mpAudio = document.getElementById('musikSekolah'); // pakai audio yang SAMA

// Halaman Music Player (di sidebar)
const mpPageEl = document.getElementById('page-musicplayer');
const mpCoverBig = document.getElementById('mpCoverBig');
const mpTitleBig = document.getElementById('mpTitleBig');
const mpArtistBig = document.getElementById('mpArtistBig');
const mpStatusEl = document.getElementById('mpStatus');
const mpPlayBtn = document.getElementById('mpPlayBtn');
const mpPlayIcon = document.getElementById('mpPlayIcon');
const mpProgress = document.getElementById('mpProgress');
const mpCurrentTimeEl = document.getElementById('mpCurrentTime');
const mpDurationEl = document.getElementById('mpDuration');
const mpVolume = document.getElementById('mpVolume');
const mpPlaylistEl = document.getElementById('mpPlaylist');
const mpPlaylistCountEl = document.getElementById('mpPlaylistCount');
const mpWaveformEl = document.getElementById('mpWaveform');

// Indikator kecil di menu Sidebar (pengganti mini player yang menempel di bawah layar)
const navMusicItem = document.getElementById('navMusicPlayer');

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';

function mpFormatTime(detik) {
  if (!isFinite(detik) || detik < 0) return '0:00';
  const m = Math.floor(detik / 60);
  const s = Math.floor(detik % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---------- RENDER INFO LAGU ----------
function mpRenderNowPlaying() {
  const lagu = playlistLagu[mpCurrentIndex];
  if (!lagu || !mpAudio) return;

  const cover = lagu.cover && lagu.cover.trim() !== '' ? lagu.cover : COVER_DEFAULT;

  if (mpTitleBig) mpTitleBig.textContent = lagu.judul;
  if (mpArtistBig) mpArtistBig.textContent = lagu.artis;
  if (mpCoverBig) mpCoverBig.src = cover;
}

// Bar-bar waveform dekoratif (dibuat sekali, tinggi acak agar terlihat natural,
// animasi jalan/berhenti mengikuti class .mp-is-playing pada .mp-page)
function mpRenderWaveform() {
  if (!mpWaveformEl || mpWaveformEl.childElementCount > 0) return;
  const jumlahBar = 40;
  let html = '';
  for (let i = 0; i < jumlahBar; i++) {
    const durasi = (0.7 + Math.random() * 0.8).toFixed(2);
    const delay = (Math.random() * -1.2).toFixed(2);
    html += `<span style="animation-duration:${durasi}s;animation-delay:${delay}s"></span>`;
  }
  mpWaveformEl.innerHTML = html;
}

function mpRenderPlaylist() {
  if (!mpPlaylistEl) return;
  mpPlaylistEl.innerHTML = playlistLagu.map((lagu, idx) => {
    const cover = lagu.cover && lagu.cover.trim() !== '' ? lagu.cover : COVER_DEFAULT;
    const aktif = idx === mpCurrentIndex;
    const sedangMain = aktif && mpAudio && !mpAudio.paused;
    return `
      <div class="mp-track ${aktif ? 'active' : ''}" onclick="mpPilihLagu(${idx})">
        <span class="mp-track-num">${idx + 1}</span>
        <img class="mp-track-cover" src="${cover}" alt="${lagu.judul}">
        <div class="mp-track-info">
          <div class="mp-track-title">${lagu.judul}</div>
          <div class="mp-track-artist">${lagu.artis}</div>
        </div>
        ${lagu.isDefault ? '<span class="mp-track-badge">DEFAULT</span>' : ''}
        ${sedangMain ? '<span class="mp-track-eq"><span></span><span></span><span></span></span>' : ''}
      </div>
    `;
  }).join('');
  if (mpPlaylistCountEl) mpPlaylistCountEl.textContent = playlistLagu.length + ' lagu';
}

function mpUpdatePlayIcons() {
  if (!mpAudio) return;
  const playing = !mpAudio.paused;
  const iconSvg = playing ? ICON_PAUSE : ICON_PLAY;

  if (mpPlayIcon) mpPlayIcon.innerHTML = iconSvg;

  if (mpPageEl) mpPageEl.classList.toggle('mp-is-playing', playing);
  if (mpStatusEl) mpStatusEl.textContent = playing ? 'Sedang Diputar' : 'Dijeda';

  // Indikator kecil di menu Sidebar menyala mengikuti status play/pause,
  // aktif di halaman manapun (tidak perlu bar besar di bawah layar).
  if (navMusicItem) navMusicItem.classList.toggle('mp-playing', playing);

  // highlight ulang playlist (indikator equalizer ikut play/pause)
  mpRenderPlaylist();
}

// ---------- GANTI LAGU ----------
function mpLoadTrack(index, autoplay) {
  if (!mpAudio) return;
  if (index < 0) index = playlistLagu.length - 1;
  if (index >= playlistLagu.length) index = 0;

  const lagu = playlistLagu[index];
  mpCurrentIndex = index;

  // Lagu sekolah (index 0 / isDefault) tetap loop seperti perilaku aslinya.
  // Lagu lain di playlist otomatis lanjut ke lagu berikutnya saat selesai.
  mpAudio.loop = !!lagu.isDefault;

  // Hindari reload paksa kalau sumbernya sudah sama persis (mis. saat baru dibuka).
  const srcSekarang = mpAudio.currentSrc || mpAudio.src;
  const isSourceSama = srcSekarang && srcSekarang.indexOf(lagu.src) !== -1;

  if (!isSourceSama) {
    mpAudio.src = lagu.src;
  }

  mpRenderNowPlaying();
  mpRenderPlaylist();

  if (autoplay) {
    const playPromise = mpAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => mpTampilkanError(err, lagu.judul));
    }
  }
}

function mpPilihLagu(index) {
  if (index === mpCurrentIndex) {
    mpTogglePlay();
    return;
  }
  mpLoadTrack(index, true);
}

function mpNext() {
  mpLoadTrack(mpCurrentIndex + 1, true);
}

function mpPrev() {
  mpLoadTrack(mpCurrentIndex - 1, true);
}

function mpTogglePlay(e) {
  if (e) e.stopPropagation();
  if (!mpAudio) return;
  if (mpAudio.paused) {
    const playPromise = mpAudio.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => mpTampilkanError(err, playlistLagu[mpCurrentIndex].judul));
    }
  } else {
    mpAudio.pause();
  }
}

function mpTampilkanError(err, judulLagu) {
  const notice = document.getElementById('musicNotice');
  if (!notice) return;
  console.error('Gagal memutar lagu:', err);
  notice.innerText = `Lagu "${judulLagu}" gagal diputar. Coba tap tombol play sekali lagi.`;
  notice.classList.add('show');
  setTimeout(() => notice.classList.remove('show'), 6000);
}

// ---------- EVENT AUDIO (addEventListener = tidak menimpa listener lama) ----------
if (mpAudio) {
  mpAudio.addEventListener('play', mpUpdatePlayIcons);
  mpAudio.addEventListener('pause', mpUpdatePlayIcons);

  mpAudio.addEventListener('loadedmetadata', () => {
    if (mpDurationEl) mpDurationEl.textContent = mpFormatTime(mpAudio.duration);
  });

  mpAudio.addEventListener('timeupdate', () => {
    if (!mpAudio.duration) return;
    const persen = (mpAudio.currentTime / mpAudio.duration) * 100;
    if (!mpIsSeeking && mpProgress) {
      mpProgress.value = persen;
      mpProgress.style.setProperty('--mp-fill', persen + '%');
    }
    if (mpCurrentTimeEl) mpCurrentTimeEl.textContent = mpFormatTime(mpAudio.currentTime);
    if (mpDurationEl) mpDurationEl.textContent = mpFormatTime(mpAudio.duration);
  });

  // Lagu non-default otomatis lanjut ke lagu berikutnya saat selesai.
  // Lagu sekolah (loop = true) tidak pernah memicu event ini.
  mpAudio.addEventListener('ended', () => {
    if (!playlistLagu[mpCurrentIndex].isDefault) {
      mpNext();
    }
  });
}

// ---------- KONTROL PROGRESS BAR ----------
if (mpProgress) {
  mpProgress.addEventListener('input', () => {
    mpIsSeeking = true;
    mpProgress.style.setProperty('--mp-fill', mpProgress.value + '%');
  });
  mpProgress.addEventListener('change', () => {
    if (mpAudio && mpAudio.duration) {
      mpAudio.currentTime = (mpProgress.value / 100) * mpAudio.duration;
    }
    mpIsSeeking = false;
  });
}

// ---------- KONTROL VOLUME ----------
if (mpVolume && mpAudio) {
  mpVolume.style.setProperty('--mp-fill', mpVolume.value + '%');
  mpVolume.addEventListener('input', () => {
    mpAudio.volume = mpVolume.value / 100;
    mpVolume.style.setProperty('--mp-fill', mpVolume.value + '%');
  });
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', function () {
  if (!mpAudio) return; // audio sekolah tidak ditemukan, jangan jalankan player baru

  if (mpVolume) {
    mpVolume.value = Math.round(mpAudio.volume * 100);
    mpVolume.style.setProperty('--mp-fill', mpVolume.value + '%');
  }

  // Saat load, track aktif mengikuti apa yang sudah otomatis diputar
  // sistem lama (lagu sekolah) — TIDAK memaksa reload src-nya.
  mpCurrentIndex = 0;
  mpAudio.loop = true; // pastikan perilaku default lagu sekolah tetap sama

  mpRenderWaveform();
  mpRenderNowPlaying();
  mpRenderPlaylist();
  mpUpdatePlayIcons();
});
