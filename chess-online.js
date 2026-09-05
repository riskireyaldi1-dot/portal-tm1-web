// ========================================================================
// CHESS-ONLINE.JS — Lapisan multiplayer untuk TM Chess.
// TIDAK mengubah aturan/engine catur di chess.js (tmcPseudoMoves, tmcLegalMoves,
// dst tetap sama persis) — file ini HANYA menambah jalur jaringan di atasnya:
// setiap client menjalankan mesin aturan yang SAMA, dan langkah disinkronkan
// lewat dokumen Firestore "chessRooms/{roomId}" supaya kedua papan selalu identik.
//
// CATATAN JUJUR: ini v1. Belum ada penanganan koneksi terputus/reconnect yang
// canggih (kalau internet putus di tengah game, game itu akan menggantung —
// perlu diuji langsung di Firebase sungguhan sebelum dipakai serius, karena
// saya tidak bisa menjalankan Firestore beneran dari sandbox ini).
// ========================================================================

const TCO = {
  roomId: null,
  unsubscribe: null,
  appliedMoveCount: 0,
  onlineMode: 'quick', // 'quick' | 'code'
};

// ---------------------------------------------------------------
// SETUP UI: pindah tab Lokal <-> Online
// ---------------------------------------------------------------
function tcoSwitchSetupMode(mode) {
  document.getElementById('tmcModeChipLocal').classList.toggle('active', mode === 'local');
  document.getElementById('tmcModeChipOnline').classList.toggle('active', mode === 'online');
  document.getElementById('tmcLocalSetupPanel').style.display = mode === 'local' ? '' : 'none';
  document.getElementById('tmcOnlineSetupPanel').style.display = mode === 'online' ? '' : 'none';
  document.getElementById('tmcLocalStartBtn').style.display = mode === 'local' ? '' : 'none';
  if (mode === 'online') tcoRefreshIdentityBox();
}

async function tcoRefreshIdentityBox() {
  const box = document.getElementById('tmcOnlineMyIdentity');
  const playGroup = document.getElementById('tmcOnlinePlayGroup');
  const id = gdGetIdentity();
  if (!id) {
    box.innerHTML = 'Kamu belum login. Silakan login dulu untuk main Chess online.';
    playGroup.style.display = 'none';
    return;
  }
  playGroup.style.display = '';
  box.innerHTML = `<span>${id.name}</span><span class="tmc-online-identity-rating">Memuat rating...</span>`;
  try {
    const stats = await gdGetMyGameStats();
    box.innerHTML = `<span>${id.name}</span><span class="tmc-online-identity-rating">${stats.chess.rating} Rating</span>`;
  } catch (err) {
    console.error('Gagal memuat rating:', err);
  }
}

function tcoSelectOnlineMode(mode, el) {
  TCO.onlineMode = mode;
  document.querySelectorAll('.tmc-online-mode-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tmcQuickMatchPanel').style.display = mode === 'quick' ? '' : 'none';
  document.getElementById('tmcRoomCodePanel').style.display = mode === 'code' ? '' : 'none';
  document.getElementById('tmcOnlineStatusBox').style.display = 'none';
}

function tcoShowStatus(html) {
  const box = document.getElementById('tmcOnlineStatusBox');
  box.style.display = '';
  box.innerHTML = html;
}

function tcoGetTimeControl() {
  let init, inc;
  if (tmcSelectedTimePreset === 'custom') {
    init = (parseInt(document.getElementById('tmcCustomMin').value, 10) || 0) * 60;
    inc = parseInt(document.getElementById('tmcCustomInc').value, 10) || 0;
  } else {
    [init, inc] = TMC_TIME_PRESETS[tmcSelectedTimePreset];
  }
  return { init, inc };
}

function tcoRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I biar tidak ambigu
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ---------------------------------------------------------------
// QUICK MATCH: cari room 'waiting' punya orang lain, kalau tidak ada, buat sendiri & tunggu
// ---------------------------------------------------------------
async function tcoStartQuickMatch() {
  const id = gdGetIdentity();
  if (!id) return;
  document.getElementById('tmcQuickMatchBtn').disabled = true;
  tcoShowStatus('Mencari lawan...');
  try {
    const snap = await db.collection('chessRooms')
      .where('mode', '==', 'quick')
      .where('status', '==', 'waiting')
      .limit(10)
      .get();
    const candidate = snap.docs.find(d => d.data().playerIds[0] !== id.uid);
    if (candidate) {
      await tcoJoinRoom(candidate.id);
    } else {
      await tcoCreateRoom('quick', null);
    }
  } catch (err) {
    console.error('Quick match gagal:', err);
    tcoShowStatus('Gagal mencari lawan: ' + err.message + ' <span class="tmc-cancel-link" onclick="tcoCancelWaiting()">Batal</span>');
    document.getElementById('tmcQuickMatchBtn').disabled = false;
  }
}

// ---------------------------------------------------------------
// KODE ROOM: buat room dengan kode, atau gabung pakai kode dari teman
// ---------------------------------------------------------------
async function tcoCreateRoomCode() {
  const id = gdGetIdentity();
  if (!id) return;
  const code = tcoRoomCode();
  try {
    await tcoCreateRoom('code', code);
  } catch (err) {
    console.error('Gagal membuat room:', err);
    tcoShowStatus('Gagal membuat room: ' + err.message);
  }
}

async function tcoJoinRoomCode() {
  const id = gdGetIdentity();
  if (!id) return;
  const code = (document.getElementById('tmcJoinCodeInput').value || '').trim().toUpperCase();
  if (code.length < 4) { tcoShowStatus('Masukkan kode room yang valid.'); return; }
  tcoShowStatus('Mencari room dengan kode ' + code + '...');
  try {
    const snap = await db.collection('chessRooms')
      .where('roomCode', '==', code)
      .where('status', '==', 'waiting')
      .limit(1)
      .get();
    if (snap.empty) {
      tcoShowStatus('Room dengan kode itu tidak ditemukan (atau sudah dimulai).');
      return;
    }
    const doc = snap.docs[0];
    if (doc.data().playerIds[0] === id.uid) {
      tcoShowStatus('Itu room buatanmu sendiri — bagikan kodenya ke teman untuk join.');
      return;
    }
    await tcoJoinRoom(doc.id);
  } catch (err) {
    console.error('Gagal join room:', err);
    tcoShowStatus('Gagal join room: ' + err.message);
  }
}

async function tcoCreateRoom(mode, roomCode) {
  const id = gdGetIdentity();
  const stats = await gdGetMyGameStats();
  const timeControl = tcoGetTimeControl();
  const ref = db.collection('chessRooms').doc();
  await ref.set({
    mode,
    roomCode: roomCode || null,
    status: 'waiting',
    playerIds: [id.uid],
    names: { [id.uid]: id.name },
    ratings: { [id.uid]: stats.chess.rating },
    colors: { [id.uid]: 'w' },
    timeControl,
    moves: [],
    result: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  TCO.roomId = ref.id;
  if (mode === 'code') {
    tcoShowStatus('Bagikan kode ini ke temanmu:<span class="tmc-room-code-display">' + roomCode + '</span>Menunggu lawan bergabung... <span class="tmc-cancel-link" onclick="tcoCancelWaiting()">Batal</span>');
  } else {
    tcoShowStatus('Mencari lawan... belum ada yang cocok, menunggu pemain lain masuk antrean. <span class="tmc-cancel-link" onclick="tcoCancelWaiting()">Batal</span>');
  }
  tcoListenRoom(ref.id);
}

async function tcoJoinRoom(roomId) {
  const id = gdGetIdentity();
  const stats = await gdGetMyGameStats();
  const ref = db.collection('chessRooms').doc(roomId);
  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('Room sudah tidak ada.');
      const data = doc.data();
      if (data.status !== 'waiting' || data.playerIds.length !== 1) throw new Error('Room sudah penuh/mulai.');
      if (data.playerIds[0] === id.uid) throw new Error('Tidak bisa join room sendiri.');
      tx.update(ref, {
        playerIds: [...data.playerIds, id.uid],
        names: { ...data.names, [id.uid]: id.name },
        ratings: { ...data.ratings, [id.uid]: stats.chess.rating },
        colors: { ...data.colors, [id.uid]: 'b' },
        status: 'playing',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    TCO.roomId = roomId;
    tcoShowStatus('Lawan ditemukan! Menyiapkan papan...');
    tcoListenRoom(roomId);
  } catch (err) {
    console.error('Join room gagal:', err);
    tcoShowStatus('Gagal join room (' + err.message + '). Coba lagi.');
  }
}

async function tcoCancelWaiting() {
  if (!TCO.roomId) return;
  try {
    await db.collection('chessRooms').doc(TCO.roomId).delete();
  } catch (err) {
    console.error('Gagal membatalkan room:', err);
  }
  tcoCleanupListener();
  document.getElementById('tmcQuickMatchBtn').disabled = false;
  document.getElementById('tmcOnlineStatusBox').style.display = 'none';
}

function tcoCleanupListener() {
  if (TCO.unsubscribe) { TCO.unsubscribe(); TCO.unsubscribe = null; }
  TCO.roomId = null;
  TCO.appliedMoveCount = 0;
}

// ---------------------------------------------------------------
// LISTENER ROOM — jantung sinkronisasi real-time
// ---------------------------------------------------------------
function tcoListenRoom(roomId) {
  if (TCO.unsubscribe) TCO.unsubscribe();
  TCO.roomId = roomId;
  TCO.appliedMoveCount = 0;
  TCO.unsubscribe = db.collection('chessRooms').doc(roomId).onSnapshot((doc) => {
    if (!doc.exists) return;
    const room = doc.data();

    if (room.status === 'playing' && !TMC.started) {
      tcoBeginLocalGameFromRoom(room);
    }

    if (TMC.started && TMC.onlineRoomId === roomId) {
      // Terapkan langkah baru yang belum ada di papan lokal, urut sesuai server.
      const moves = room.moves || [];
      while (TCO.appliedMoveCount < moves.length) {
        const mv = moves[TCO.appliedMoveCount];
        tmcMakeMove(mv);
        TCO.appliedMoveCount++;
      }
      // Hasil yang ditulis pihak lawan (checkmate yang mereka deteksi lebih dulu, atau resign)
      if (room.result && !TMC.gameOver) {
        tmcEndGame(room.result.winnerColor, room.result.reason);
      }
    }
  }, (err) => {
    console.error('Listener room error:', err);
  });
}

function tcoBeginLocalGameFromRoom(room) {
  const id = gdGetIdentity();
  const myColor = room.colors[id.uid];
  const oppUid = room.playerIds.find(u => u !== id.uid);
  const oppColor = myColor === 'w' ? 'b' : 'w';

  tmcResetGameKeepSetup();
  TMC.onlineRoomId = TCO.roomId;
  TMC.onlineMyColor = myColor;
  TMC.onlineUids = { [myColor]: id.uid, [oppColor]: oppUid };
  TMC.onlineRatingBefore = { [myColor]: room.ratings[id.uid], [oppColor]: room.ratings[oppUid] };
  TMC.players = { [myColor]: room.names[id.uid], [oppColor]: room.names[oppUid] };
  TMC.timeControl = room.timeControl;
  TMC.clocks = { w: room.timeControl.init, b: room.timeControl.init };
  TMC.theme = 'ivory';
  TMC.soundOn = document.getElementById('tmcSoundSwitch').classList.contains('on');
  TMC.started = true;
  // Kamu selalu melihat papan dari sisi bidakmu sendiri.
  TMC.boardFlipped = myColor === 'b';

  document.getElementById('tmcSetupCard').style.display = 'none';
  document.getElementById('tmcGameArea').classList.add('active');
  const metaEl = document.getElementById('tmcGameMeta');
  if (metaEl) metaEl.innerText = 'Online vs ' + room.names[oppUid] + ' (' + room.ratings[oppUid] + ')';
  tmcPlaySound('start');
  tmcRender();
  tmcStartClockTick();
}

// ---------------------------------------------------------------
// KIRIM LANGKAH (dipanggil oleh tmcSubmitMove di chess.js)
// ---------------------------------------------------------------
async function tcoSendMove(move) {
  const ref = db.collection('chessRooms').doc(TMC.onlineRoomId);
  const expectedCount = TCO.appliedMoveCount;
  try {
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const data = doc.data();
      if (data.status !== 'playing') throw new Error('Game sudah selesai.');
      if ((data.moves || []).length !== expectedCount) throw new Error('Papan tidak sinkron, muat ulang.');
      tx.update(ref, {
        moves: [...(data.moves || []), move],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    // Papan lokal sendiri akan ikut ter-update lewat listener (konsisten
    // dengan lawan), bukan diterapkan dua kali secara manual di sini.
  } catch (err) {
    console.error('Gagal mengirim langkah:', err);
    alert('Gagal mengirim langkah (koneksi bermasalah). Coba lagi.');
  }
}

// ---------------------------------------------------------------
// AKHIR GAME ONLINE — simpan rating/riwayat
// ---------------------------------------------------------------
async function tcoOnGameEnd(winnerColor, reason) {
  const myColor = TMC.onlineMyColor;
  const oppColor = myColor === 'w' ? 'b' : 'w';
  const myResult = winnerColor === null ? 'draw' : (winnerColor === myColor ? 'win' : 'loss');

  try {
    await gdRecordChessResult({
      myUid: TMC.onlineUids[myColor],
      myRatingBefore: TMC.onlineRatingBefore[myColor],
      oppRatingBefore: TMC.onlineRatingBefore[oppColor],
      myResult,
    });
  } catch (err) {
    console.error('Gagal menyimpan hasil rating:', err);
  }

  // Catat 1 baris riwayat match (idempoten: doc id = roomId, penulis kedua akan
  // ditolak rules karena dokumennya sudah ada — itu memang disengaja).
  const scoreWhite = winnerColor === 'w' ? 1 : winnerColor === 'b' ? 0 : 0.5;
  const elo = gdCalculateElo(TMC.onlineRatingBefore.w, TMC.onlineRatingBefore.b, scoreWhite);
  gdLogChessMatch({
    matchId: TMC.onlineRoomId,
    player1Id: TMC.onlineUids.w, player1Name: TMC.players.w,
    player2Id: TMC.onlineUids.b, player2Name: TMC.players.b,
    result: winnerColor === 'w' ? 'player1' : winnerColor === 'b' ? 'player2' : 'draw',
    ratingBefore: { player1: TMC.onlineRatingBefore.w, player2: TMC.onlineRatingBefore.b },
    ratingAfter: { player1: elo.newA, player2: elo.newB },
    ratingChange: { player1: elo.deltaA, player2: elo.deltaB },
    timeControl: TMC.timeControl,
  });

  // Tandai room selesai supaya lawan (kalau dia yang lebih lambat mendeteksi
  // game-over lokal) ikut berhenti, dan supaya room tidak muncul lagi di quick match.
  try {
    await db.collection('chessRooms').doc(TMC.onlineRoomId).update({
      status: 'finished',
      result: { winnerColor, reason },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // Wajar gagal kalau lawan sudah lebih dulu menulis status 'finished' di update sebelumnya.
  }
}

// ---------------------------------------------------------------
// WRAPPER TOMBOL (dipanggil dari index.html, sadar mode online vs lokal)
// ---------------------------------------------------------------
function tmcResignClick() {
  if (TMC.gameOver || !TMC.started) return;
  if (TMC.onlineRoomId) {
    if (!confirm('Yakin mau resign? Rating kamu akan berkurang.')) return;
    const oppColor = TMC.onlineMyColor === 'w' ? 'b' : 'w';
    tmcEndGame(oppColor, 'resign');
    db.collection('chessRooms').doc(TMC.onlineRoomId).update({
      result: { winnerColor: oppColor, reason: 'resign' },
      status: 'finished',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }).catch(err => console.error('Gagal mengirim resign:', err));
  } else {
    tmcResign(TMC.turn);
  }
}

function tmcRematchClick() {
  if (TMC.onlineRoomId) {
    tmcCloseResultModal();
    tmcBackToSetupClick();
    tcoShowStatus('Cari lawan baru untuk main lagi.');
  } else {
    tmcRematch();
  }
}

function tmcBackToSetupClick() {
  tcoCleanupListener();
  tmcBackToSetup();
  document.getElementById('tmcOnlineStatusBox').style.display = 'none';
  const btn = document.getElementById('tmcQuickMatchBtn');
  if (btn) btn.disabled = false;
}
