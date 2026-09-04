// ========================================================================
// GAMEDATA.JS — Fondasi sistem akun game (Chess + UNO), Portal Kelas TM-1
// ------------------------------------------------------------------------
// File ini TERPISAH dari script.js/auth.js/database.js (pola yang sama
// dengan musicplayer.js/database.js) supaya file-file lama tidak perlu
// diubah/dirusak.
//
// Tanggung jawab file ini:
// 1. Identitas otomatis: chess.js & uno.js TIDAK BOLEH lagi minta orang
//    ketik nama pemain — selalu ambil dari akun yang sedang login (AUTH,
//    lihat auth.js). Kalau belum login, game tidak bisa dimulai.
// 2. Inisialisasi field "chess" dan "uno" di dokumen users/{uid} kalau
//    akun itu belum pernah punya field ini (akun lama tetap aman, tidak
//    ada data yang ditimpa/hilang — pakai { merge: true }).
// 3. Rumus ELO standar (dipakai chess.com dkk) untuk hitung rating baru.
// 4. Fungsi simpan hasil pertandingan (match doc + update rating/poin di
//    users/{uid} milik SENDIRI SAJA — tidak pernah menulis dokumen user
//    orang lain, sesuai firestore.rules yang membatasi self-write).
// 5. Query leaderboard Chess & UNO (terpisah, sesuai permintaan) + statistik
//    ringkas untuk halaman profil.
//
// CATATAN JUJUR soal keamanan (baca ini sebelum lanjut ke fase berikutnya):
// Project ini adalah web statis TANPA Cloud Functions/server sendiri.
// Artinya validasi "benar-benar dari server" untuk ELO/poin TIDAK bisa
// 100% seperti platform besar. Yang dilakukan di sini: setiap client
// menghitung ELO dengan rumus yang SAMA PERSIS dari rating SEBELUM game
// (dibekukan saat room dibuat, lihat chessRooms/unoRooms di fase
// berikutnya), lalu firestore.rules MEMBATASI seberapa besar rating/poin
// boleh berubah sekali simpan (lihat isValidChessStatUpdate/
// isValidUnoStatUpdate di firestore.rules). Ini "cukup aman untuk kelas",
// BUKAN anti-cheat tingkat kompetisi — itu butuh Cloud Functions.
// ========================================================================

const GAMEDATA_ELO_K = 32;           // K-factor ELO standar (dibatasi rules maksimal ±40)
const GAMEDATA_CHESS_START = 1200;   // rating awal akun baru
const GAMEDATA_UNO_START = { points: 0, games: 0, wins: 0, podium: 0 };

// ---------------------------------------------------------------
// 1. IDENTITAS OTOMATIS
// ---------------------------------------------------------------
// Dipanggil oleh chess.js / uno.js pengganti form "Nama Pemain".
// Return null kalau belum login (pemanggil WAJIB cek ini dan tampilkan
// pesan "silakan login dulu" — JANGAN lempar ke form nama manual lagi).
function gdGetIdentity() {
  if (!AUTH.user || !AUTH.profile) return null;
  return {
    uid: AUTH.user.uid,
    name: AUTH.profile.name || AUTH.user.email || 'Pemain',
  };
}

// ---------------------------------------------------------------
// 2. INISIALISASI FIELD GAME DI users/{uid} (aman untuk akun lama)
// ---------------------------------------------------------------
// merge:true memastikan field lain di dokumen user (nama, role, status,
// permissions, dst dari auth.js) TIDAK TERSENTUH SAMA SEKALI.
async function gdEnsureGameFields(uid) {
  const ref = db.collection('users').doc(uid);
  const doc = await ref.get();
  const data = doc.exists ? doc.data() : {};
  const patch = {};
  if (!data.chess) {
    patch.chess = { rating: GAMEDATA_CHESS_START, games: 0, wins: 0, draws: 0, losses: 0 };
  }
  if (!data.uno) {
    patch.uno = { ...GAMEDATA_UNO_START };
  }
  if (Object.keys(patch).length > 0) {
    await ref.set(patch, { merge: true });
  }
  return { ...data, ...patch };
}

// ---------------------------------------------------------------
// 3. RUMUS ELO STANDAR
// ---------------------------------------------------------------
// scoreA: 1 = A menang, 0.5 = seri, 0 = A kalah
// Return { newA, newB, deltaA, deltaB } — deltaA + deltaB selalu 0
// (poin yang didapat pemenang persis sama dengan yang hilang dari lawan,
// seperti ELO catur pada umumnya).
function gdCalculateElo(ratingA, ratingB, scoreA) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const rawDeltaA = Math.round(GAMEDATA_ELO_K * (scoreA - expectedA));
  // Dibatasi ke rentang yang sama dengan firestore.rules (±40) supaya
  // tidak pernah ditolak server karena selisih pembulatan.
  const deltaA = Math.max(-40, Math.min(40, rawDeltaA));
  const deltaB = -deltaA;
  return {
    newA: Math.max(100, ratingA + deltaA),
    newB: Math.max(100, ratingB + deltaB),
    deltaA,
    deltaB,
  };
}

// ---------------------------------------------------------------
// 4. SIMPAN HASIL PERTANDINGAN CHESS
// ---------------------------------------------------------------
// Dipanggil oleh KEDUA client (pemenang & lawan) setelah game selesai,
// masing-masing menulis DOKUMEN USER MILIK SENDIRI saja (sesuai rules).
// ratingBefore WAJIB nilai yang dibekukan saat room/game dimulai (bukan
// dibaca ulang saat ini) supaya kedua client menghitung delta yang sama.
//
// myResult: 'win' | 'draw' | 'loss' (dari sudut pandang akun yang login)
async function gdRecordChessResult({ myUid, myRatingBefore, oppRatingBefore, myResult }) {
  const scoreA = myResult === 'win' ? 1 : myResult === 'draw' ? 0.5 : 0;
  const { newA, deltaA } = gdCalculateElo(myRatingBefore, oppRatingBefore, scoreA);

  const ref = db.collection('users').doc(myUid);
  const doc = await ref.get();
  const chess = (doc.data() && doc.data().chess) || { rating: myRatingBefore, games: 0, wins: 0, draws: 0, losses: 0 };

  const updated = {
    rating: newA,
    games: chess.games + 1,
    wins: chess.wins + (myResult === 'win' ? 1 : 0),
    draws: chess.draws + (myResult === 'draw' ? 1 : 0),
    losses: chess.losses + (myResult === 'loss' ? 1 : 0),
  };

  await ref.set({ chess: updated }, { merge: true });
  return { ratingBefore: myRatingBefore, ratingAfter: newA, ratingChange: deltaA };
}

// Simpan satu baris riwayat/audit ke chessMatches (boleh gagal diam-diam —
// ini cuma jejak riwayat, bukan sumber kebenaran rating).
// matchId WAJIB diisi (pakai roomId) supaya kalau KEDUA client sama-sama
// mencoba mencatat match yang sama, penulis kedua otomatis ditolak rules
// (create-only) — bukan malah jadi 2 baris riwayat yang duplikat.
async function gdLogChessMatch({ matchId, player1Id, player1Name, player2Id, player2Name, result, ratingBefore, ratingAfter, ratingChange, timeControl }) {
  try {
    await db.collection('chessMatches').doc(matchId).set({
      player1Id, player1Name, player2Id, player2Name,
      result, // 'player1' | 'player2' | 'draw'
      ratingBefore, ratingAfter, ratingChange, timeControl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Gagal mencatat riwayat match catur:', err);
  }
}

// ---------------------------------------------------------------
// 5. SIMPAN HASIL PERTANDINGAN UNO
// ---------------------------------------------------------------
// placement: 1 = juara 1, 2 = juara 2, 3 = juara 3, lainnya = kalah
function gdUnoPointsForPlacement(placement) {
  if (placement === 1) return 10;
  if (placement === 2 || placement === 3) return 5;
  return -10;
}

async function gdRecordUnoResult({ myUid, placement }) {
  const pointsDelta = gdUnoPointsForPlacement(placement);
  const ref = db.collection('users').doc(myUid);
  const doc = await ref.get();
  const uno = (doc.data() && doc.data().uno) || { ...GAMEDATA_UNO_START };

  const updated = {
    points: uno.points + pointsDelta,
    games: uno.games + 1,
    wins: uno.wins + (placement === 1 ? 1 : 0),
    podium: uno.podium + (placement <= 3 ? 1 : 0),
  };

  await ref.set({ uno: updated }, { merge: true });
  return { pointsDelta, pointsAfter: updated.points };
}

async function gdLogUnoMatch({ matchId, playerIds, players, placements, pointsChange, winnerId }) {
  try {
    await db.collection('unoMatches').doc(matchId).set({
      playerIds, players, placements, pointsChange, winnerId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Gagal mencatat riwayat match UNO:', err);
  }
}

// ---------------------------------------------------------------
// 6. LEADERBOARD (terpisah Chess & UNO, sesuai permintaan)
// ---------------------------------------------------------------
async function gdGetChessLeaderboard(limit = 50) {
  const snap = await db.collection('users')
    .where('chess.games', '>', 0)
    .orderBy('chess.games')
    .get();
  // Diurutkan ulang di client by rating (Firestore butuh index komposit
  // untuk orderBy 2 field berbeda; untuk skala 1 kelas ini cukup ringan).
  const rows = [];
  snap.forEach(doc => {
    const d = doc.data();
    rows.push({ uid: doc.id, name: d.name, ...d.chess });
  });
  rows.sort((a, b) => b.rating - a.rating);
  return rows.slice(0, limit);
}

async function gdGetUnoLeaderboard(limit = 50) {
  const snap = await db.collection('users')
    .where('uno.games', '>', 0)
    .orderBy('uno.games')
    .get();
  const rows = [];
  snap.forEach(doc => {
    const d = doc.data();
    rows.push({ uid: doc.id, name: d.name, ...d.uno });
  });
  rows.sort((a, b) => b.points - a.points);
  return rows.slice(0, limit);
}

// ---------------------------------------------------------------
// 7. STATISTIK RINGKAS UNTUK HALAMAN PROFIL AKUN SENDIRI
// ---------------------------------------------------------------
async function gdGetMyGameStats() {
  const id = gdGetIdentity();
  if (!id) return null;
  const data = await gdEnsureGameFields(id.uid);
  return { chess: data.chess, uno: data.uno };
}

// ---------------------------------------------------------------
// 8. AUTO-INIT saat login
// ---------------------------------------------------------------
// Begitu AUTH mendeteksi user login (lihat authInit di auth.js), langsung
// pastikan field chess/uno ada di dokumennya — supaya begitu masuk ke
// Chess/UNO/Leaderboard, datanya sudah siap tanpa jeda/loading tambahan.
document.addEventListener('DOMContentLoaded', () => {
  authInit((user) => {
    if (user) gdEnsureGameFields(user.uid).catch(err => console.error('Gagal inisialisasi field game:', err));
  });
});
