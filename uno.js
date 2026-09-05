// ========================================================================
// UNO.JS — TM UNO, ROMBAK TOTAL jadi ONLINE MULTIPLAYER SUNGGUHAN.
// ------------------------------------------------------------------------
// TIDAK ADA LAGI mode "Vs Bot" atau "Multiplayer Lokal / gantian 1 HP".
// Setiap pemain bermain dari perangkatnya sendiri, state game hidup di
// Firestore ("unoRooms/{roomId}"), disinkronkan real-time lewat onSnapshot
// ke SEMUA pemain di room yang sama.
//
// ARSITEKTUR SINGKAT:
// - unoRooms/{roomId}           -> state PUBLIK (giliran, kartu teratas,
//                                   JUMLAH kartu tiap pemain — bukan isinya)
// - unoRooms/{roomId}/hands/{uid} -> kartu ASLI tiap pemain, HANYA bisa
//                                   dibaca/ditulis oleh pemilik uid itu
//                                   sendiri (lihat firestore.rules)
// - unoRooms/{roomId}/deck/state  -> sisa kartu yang belum dibagikan
//
// Tidak ada "dealer" tunggal yang membagikan kartu ke semua orang (itu
// TIDAK MUNGKIN dilakukan tanpa server, karena tangan tiap pemain hanya
// boleh ditulis oleh pemiliknya sendiri). Sebagai gantinya: begitu host
// menekan "Mulai", host menaruh 1 dek 108 kartu teracak ke dokumen "deck".
// Lalu SETIAP client (termasuk host) mengambil 7 kartu PERTAMA yang
// tersisa di dek untuk dirinya sendiri lewat Firestore Transaction — ini
// aman dari tabrakan (dua pemain kebagian kartu yang sama) karena
// Firestore transaction otomatis mengulang jika ada pembaruan bersamaan.
//
// CATATAN JUJUR SOAL KEAMANAN (baca sebelum menganggap ini sekelas game
// komersial): Project ini TIDAK memakai Cloud Functions/server sendiri.
// Artinya:
// - Legalitas kartu yang dimainkan (apakah benar-benar giliran dia, warna/
//   angkanya nyambung) divalidasi di KODE CLIENT (di file ini) dan sebagian
//   di firestore.rules (kepemilikan giliran). TAPI rules TIDAK mengecek
//   ulang "apakah kartu ini benar-benar cocok dengan kartu teratas" secara
//   detail — itu butuh Cloud Functions untuk benar-benar tidak bisa
//   dicurangi lewat client yang dimodifikasi.
// - Sisa dek (deck/state) harus bisa dibaca semua pemain di room supaya
//   proses menarik kartu berjalan tanpa server — artinya urutan kartu
//   secara teknis bisa dilihat lewat console browser oleh pemain yang niat.
// - TIDAK ADA stacking +2/+4 berantai (disederhanakan: begitu +2/+4
//   dimainkan, korban otomatis menarik kartu di background & giliran
//   lanjut ke pemain berikutnya, tanpa opsi "counter").
// - Tombol UNO murni pengingat/perayaan (sistem "denda karena lupa bilang
//   UNO" TIDAK diterapkan di versi ini).
// Untuk keperluan kelas, ini levelnya "cukup" — tapi bukan anti-cheat kelas
// kompetisi. Kalau butuh itu, wajib Cloud Functions (lihat catatan yang
// sama pernah disampaikan untuk Chess).
// ========================================================================

const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
const UNO_CARD_TYPES = {
  NUMBER: 'number', SKIP: 'skip', REVERSE: 'reverse',
  DRAW_TWO: 'draw2', WILD: 'wild', WILD_DRAW_FOUR: 'wild4'
};
const UNO_ICON_SKIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
const UNO_ICON_REVERSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>';

// ---------------------------------------------------------------
// KARTU: deck builder, nama, aturan legal-play — LOGIKA MURNI, dipakai
// SAMA PERSIS oleh semua client supaya semua orang menghitung hal yang
// sama dari state yang sama.
// ---------------------------------------------------------------
function unoCreateDeck() {
  const deck = [];
  for (const color of UNO_COLORS) {
    deck.push({ color, type: UNO_CARD_TYPES.NUMBER, value: 0, id: `n-${color}-0-${Math.random().toString(36).slice(2,7)}` });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, type: UNO_CARD_TYPES.NUMBER, value: i, id: `n-${color}-${i}-1-${Math.random().toString(36).slice(2,7)}` });
      deck.push({ color, type: UNO_CARD_TYPES.NUMBER, value: i, id: `n-${color}-${i}-2-${Math.random().toString(36).slice(2,7)}` });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ color, type: UNO_CARD_TYPES.SKIP, value: 'skip', id: `s-${color}-${i}-${Math.random().toString(36).slice(2,7)}` });
      deck.push({ color, type: UNO_CARD_TYPES.REVERSE, value: 'reverse', id: `r-${color}-${i}-${Math.random().toString(36).slice(2,7)}` });
      deck.push({ color, type: UNO_CARD_TYPES.DRAW_TWO, value: 'draw2', id: `d2-${color}-${i}-${Math.random().toString(36).slice(2,7)}` });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: UNO_CARD_TYPES.WILD, value: 'wild', id: `w-${i}-${Math.random().toString(36).slice(2,7)}` });
    deck.push({ color: 'wild', type: UNO_CARD_TYPES.WILD_DRAW_FOUR, value: 'wild4', id: `w4-${i}-${Math.random().toString(36).slice(2,7)}` });
  }
  return unoShuffle(deck);
}

function unoShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function unoCardName(card) {
  if (!card) return '';
  const colorNames = { red: 'Merah', yellow: 'Kuning', green: 'Hijau', blue: 'Biru', wild: 'Wild' };
  if (card.type === UNO_CARD_TYPES.WILD) return 'Wild';
  if (card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) return 'Wild +4';
  if (card.type === UNO_CARD_TYPES.SKIP) return `${colorNames[card.color]} Skip`;
  if (card.type === UNO_CARD_TYPES.REVERSE) return `${colorNames[card.color]} Reverse`;
  if (card.type === UNO_CARD_TYPES.DRAW_TWO) return `${colorNames[card.color]} +2`;
  return `${colorNames[card.color]} ${card.value}`;
}

function unoCanPlayCard(card, topCard, activeColor) {
  if (card.type === UNO_CARD_TYPES.WILD || card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) return true;
  if (card.color === activeColor) return true;
  if (card.type === UNO_CARD_TYPES.NUMBER && topCard.type === UNO_CARD_TYPES.NUMBER && card.value === topCard.value) return true;
  if (card.type !== UNO_CARD_TYPES.NUMBER && card.type === topCard.type) return true;
  return false;
}

function unoCardSymbolHtml(card) {
  if (card.type === 'wild') return '<span class="uno-card-wild-sym">W</span>';
  if (card.type === 'wild4') return '<span class="uno-card-wild-sym">+4</span>';
  if (card.type === 'skip') return UNO_ICON_SKIP;
  if (card.type === 'reverse') return UNO_ICON_REVERSE;
  if (card.type === 'draw2') return '+2';
  return card.value;
}

function unoCardColorClass(card) {
  return 'uno-c-' + (card.color === 'wild' ? 'wild' : card.color);
}

function unoRenderCardEl(card, { size = 'md', disabled = false, onClick = null } = {}) {
  const div = document.createElement('div');
  div.className = `uno-card uno-card-${size} ${unoCardColorClass(card)} ${disabled ? 'disabled' : ''}`;
  div.innerHTML = `<div class="uno-card-inner">${unoCardSymbolHtml(card)}</div>`;
  if (onClick && !disabled) div.addEventListener('click', onClick);
  return div;
}

// ---------------------------------------------------------------
// SUARA (sama pola dengan TM Chess — noise + nada berlapis, Web Audio API)
// ---------------------------------------------------------------
let unoAudioCtx = null;
let unoNoiseBuffer = null;
function unoGetNoiseBuffer(ctx) {
  if (unoNoiseBuffer) return unoNoiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  unoNoiseBuffer = buf;
  return buf;
}
function unoNoiseHit(ctx, t, { duration = 0.05, freq = 1500, q = 0.8, gain = 0.16 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = unoGetNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = freq; filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter); filter.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + duration + 0.02);
}
function unoTone(ctx, t, { freq = 440, duration = 0.12, gain = 0.12, wave = 'sine' } = {}) {
  const osc = ctx.createOscillator();
  osc.type = wave; osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + duration + 0.02);
}
function unoPlaySound(kind) {
  if (!UNOG.soundOn) return;
  try {
    if (!unoAudioCtx) unoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = unoAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    switch (kind) {
      case 'play': unoNoiseHit(ctx, t, { duration: 0.06, freq: 1300, gain: 0.16 }); unoTone(ctx, t, { freq: 480, duration: 0.08, gain: 0.06 }); break;
      case 'draw': unoNoiseHit(ctx, t, { duration: 0.08, freq: 800, q: 0.7, gain: 0.18 }); break;
      case 'uno': [700, 900, 1150].forEach((f, i) => unoTone(ctx, t + i * 0.11, { freq: f, duration: 0.16, gain: 0.12, wave: 'triangle' })); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => unoTone(ctx, t + i * 0.13, { freq: f, duration: 0.22, gain: 0.12, wave: 'triangle' })); break;
      case 'lose': [400, 350, 300, 250].forEach((f, i) => unoTone(ctx, t + i * 0.13, { freq: f, duration: 0.22, gain: 0.10 })); break;
      case 'error': unoTone(ctx, t, { freq: 200, duration: 0.14, gain: 0.10, wave: 'triangle' }); break;
      case 'click': unoNoiseHit(ctx, t, { duration: 0.02, freq: 2000, q: 0.6, gain: 0.08 }); break;
      default: unoNoiseHit(ctx, t, { duration: 0.05, freq: 1300, gain: 0.14 });
    }
  } catch (e) { /* audio tidak tersedia, abaikan */ }
}
function unoToggleSound(el) {
  UNOG.soundOn = !UNOG.soundOn;
  el.classList.toggle('tmc-muted', !UNOG.soundOn);
  if (UNOG.soundOn) unoPlaySound('click');
}
function unoShowToast(msg) {
  const el = document.getElementById('unoToast');
  if (!el) return;
  el.innerText = msg;
  el.classList.add('show');
  if (UNOG.toastTimer) clearTimeout(UNOG.toastTimer);
  UNOG.toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
function unoToggleFullscreen() {
  const shell = document.getElementById('unoShell');
  const nowFullscreen = !shell.classList.contains('uno-fullscreen-active');
  shell.classList.toggle('uno-fullscreen-active', nowFullscreen);
  document.body.classList.toggle('uno-fullscreen-lock', nowFullscreen);
  unoPlaySound('click');
  try {
    if (nowFullscreen) {
      const req = shell.requestFullscreen || shell.webkitRequestFullscreen;
      if (req) req.call(shell).catch(() => {});
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  } catch (err) { /* Fullscreen API tidak didukung — CSS fallback tetap jalan */ }
}

// ---------------------------------------------------------------
// STATE GLOBAL CLIENT INI
// ---------------------------------------------------------------
const UNOG = {
  roomId: null,
  roomCode: null,
  unsubRoom: null,
  unsubHand: null,
  myUid: null,
  myName: null,
  room: null,        // salinan terakhir dokumen room
  myHand: [],         // salinan terakhir tangan sendiri
  soundOn: true,
  selectedMaxPlayers: 4,
  pendingWildCard: null,
  toastTimer: null,
  dealingInProgress: false,
  resolvingForceDraw: false,
  finishHandled: false,
};

// ---------------------------------------------------------------
// SETUP: identitas, buat room, gabung room
// ---------------------------------------------------------------
function unoSelectMaxPlayers(n, el) {
  UNOG.selectedMaxPlayers = n;
  document.querySelectorAll('.uno-maxplayers-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

async function unoRefreshIdentity() {
  const box = document.getElementById('unoIdentityBox');
  const id = gdGetIdentity();
  if (!id) {
    box.innerText = 'Kamu belum login. Silakan login dulu untuk main UNO.';
    return;
  }
  UNOG.myUid = id.uid;
  UNOG.myName = id.name;
  box.innerText = id.name;
}

function unoShowSetupNotice(msg, isError) {
  const el = document.getElementById('unoSetupNotice');
  el.style.display = '';
  el.innerText = msg;
  el.classList.toggle('error', !!isError);
}

function unoRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function unoCreateRoom() {
  const id = gdGetIdentity();
  if (!id) { unoShowSetupNotice('Login dulu untuk membuat room.', true); return; }
  const code = unoRoomCode();
  const ref = db.collection('unoRooms').doc();
  try {
    await ref.set({
      hostUid: id.uid,
      roomCode: code,
      status: 'lobby',
      maxPlayers: UNOG.selectedMaxPlayers,
      playerIds: [id.uid],
      playerNames: { [id.uid]: id.name },
      currentTurnUid: null,
      direction: 1,
      discardTop: null,
      activeColor: null,
      handCounts: {},
      drawPileCount: 0,
      pendingForceDraw: null,
      lastAction: null,
      winnerOrder: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    unoEnterRoom(ref.id);
  } catch (err) {
    console.error('Gagal membuat room UNO:', err);
    unoShowSetupNotice('Gagal membuat room: ' + err.message, true);
  }
}

async function unoJoinRoom() {
  const id = gdGetIdentity();
  if (!id) { unoShowSetupNotice('Login dulu untuk gabung room.', true); return; }
  const code = (document.getElementById('unoJoinCodeInput').value || '').trim().toUpperCase();
  if (code.length < 4) { unoShowSetupNotice('Masukkan kode room yang valid.', true); return; }
  try {
    const snap = await db.collection('unoRooms')
      .where('roomCode', '==', code)
      .where('status', '==', 'lobby')
      .limit(1)
      .get();
    if (snap.empty) { unoShowSetupNotice('Room tidak ditemukan (kode salah atau game sudah dimulai).', true); return; }
    const doc = snap.docs[0];
    const room = doc.data();
    if (room.playerIds.includes(id.uid)) { unoEnterRoom(doc.id); return; }
    if (room.playerIds.length >= room.maxPlayers) { unoShowSetupNotice('Room sudah penuh.', true); return; }
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      const d = fresh.data();
      if (d.status !== 'lobby' || d.playerIds.length >= d.maxPlayers) throw new Error('Room sudah penuh/mulai.');
      tx.update(doc.ref, {
        playerIds: [...d.playerIds, id.uid],
        playerNames: { ...d.playerNames, [id.uid]: id.name },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    unoEnterRoom(doc.id);
  } catch (err) {
    console.error('Gagal gabung room UNO:', err);
    unoShowSetupNotice('Gagal gabung room: ' + err.message, true);
  }
}

function unoEnterRoom(roomId) {
  UNOG.roomId = roomId;
  document.getElementById('unoSetupCard').style.display = 'none';
  document.getElementById('unoLobbyCard').style.display = '';
  unoListenRoom(roomId);
}

// Dipanggil saat membuka halaman UNO — kalau ternyata kamu masih ada di
// room aktif (lobby/playing), langsung sambung lagi (RECONNECT), tidak
// perlu buat/gabung room dari nol lagi.
async function unoTryAutoRejoin() {
  const id = gdGetIdentity();
  if (!id) return;
  try {
    const snap = await db.collection('unoRooms')
      .where('playerIds', 'array-contains', id.uid)
      .where('status', 'in', ['lobby', 'playing'])
      .limit(1)
      .get();
    if (!snap.empty) {
      unoShowToast('Menyambung kembali ke room yang sedang berjalan...');
      unoEnterRoom(snap.docs[0].id);
    }
  } catch (err) {
    // Query gabungan (array-contains + where status) mungkin butuh index
    // komposit Firestore — kalau belum dibuat, Firebase akan menolak query
    // ini dan memberi LINK di error console untuk membuat index-nya sekali klik.
    console.warn('Auto-rejoin UNO belum bisa jalan (mungkin perlu index Firestore):', err);
  }
}

// ---------------------------------------------------------------
// LOBBY
// ---------------------------------------------------------------
function unoRenderLobby(room) {
  document.getElementById('unoLobbyCode').innerText = room.roomCode;
  const wrap = document.getElementById('unoLobbyPlayers');
  const colors = ['#e8323a', '#ffc93c', '#2fb350', '#2563eb'];
  let html = '';
  room.playerIds.forEach((uid, i) => {
    const isHost = uid === room.hostUid;
    const isMe = uid === UNOG.myUid;
    html += `<div class="uno-lobby-player">
      <div class="uno-lobby-avatar" style="background:${colors[i % colors.length]}">${(room.playerNames[uid] || '?').charAt(0).toUpperCase()}</div>
      <div class="uno-lobby-player-name">${room.playerNames[uid] || 'Pemain'}</div>
      ${isHost ? '<span class="uno-lobby-host-badge">Host</span>' : ''}
      ${isMe ? '<span class="uno-lobby-you-badge">Kamu</span>' : ''}
    </div>`;
  });
  for (let i = room.playerIds.length; i < room.maxPlayers; i++) {
    html += `<div class="uno-lobby-player uno-lobby-empty-slot">Menunggu pemain...</div>`;
  }
  wrap.innerHTML = html;

  const startBtn = document.getElementById('unoLobbyStartBtn');
  const isHost = room.hostUid === UNOG.myUid;
  const canStart = room.playerIds.length >= 2;
  startBtn.style.display = isHost ? '' : 'none';
  startBtn.disabled = !canStart;
  document.getElementById('unoLobbyStatus').innerText = isHost
    ? (canStart ? 'Siap dimulai — tekan Mulai Permainan kapan saja.' : 'Menunggu minimal 2 pemain untuk mulai...')
    : 'Menunggu host memulai permainan...';
}

async function unoLeaveLobby() {
  if (!UNOG.roomId) { unoBackToSetup(); return; }
  try {
    const ref = db.collection('unoRooms').doc(UNOG.roomId);
    const doc = await ref.get();
    const room = doc.data();
    if (room.hostUid === UNOG.myUid) {
      if (room.status === 'lobby') await ref.delete();
    } else if (room.status === 'lobby') {
      await ref.update({
        playerIds: room.playerIds.filter(u => u !== UNOG.myUid),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }
  } catch (err) {
    console.error('Gagal keluar lobby:', err);
  }
  unoBackToSetup();
}

async function unoStartGame() {
  const ref = db.collection('unoRooms').doc(UNOG.roomId);
  const doc = await ref.get();
  const room = doc.data();
  if (room.hostUid !== UNOG.myUid || room.playerIds.length < 2) return;

  let deck = unoCreateDeck();
  // Kartu pembuka tidak boleh Wild/Wild+4 (biar tidak perlu pilih warna
  // sebelum ada yang jalan) — reshuffle sampai dapat kartu biasa.
  let top = deck.shift();
  while (top.color === 'wild') { deck.push(top); deck = unoShuffle(deck); top = deck.shift(); }

  await db.collection('unoRooms').doc(UNOG.roomId).collection('deck').doc('state').set({ cards: deck });
  await ref.update({
    status: 'playing',
    discardTop: top,
    activeColor: top.color,
    direction: 1,
    currentTurnUid: room.playerIds[0],
    handCounts: {},
    drawPileCount: deck.length,
    pendingForceDraw: null,
    winnerOrder: [],
    lastAction: { type: 'start', byUid: UNOG.myUid, byName: UNOG.myName, ts: Date.now() },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------------------------
// LISTENER UTAMA — jantung sinkronisasi real-time
// ---------------------------------------------------------------
function unoListenRoom(roomId) {
  if (UNOG.unsubRoom) UNOG.unsubRoom();
  UNOG.unsubRoom = db.collection('unoRooms').doc(roomId).onSnapshot(async (doc) => {
    if (!doc.exists) { unoShowToast('Room sudah tidak ada.'); unoBackToSetup(); return; }
    const room = doc.data();
    const prevRoom = UNOG.room;
    UNOG.room = room;

    if (room.status === 'lobby') {
      unoRenderLobby(room);
      return;
    }

    // Transisi lobby -> playing: sembunyikan lobby, tampilkan arena.
    if (room.status === 'playing' || room.status === 'finished') {
      document.getElementById('unoLobbyCard').style.display = 'none';
      document.getElementById('unoGameArea').classList.add('active');
      if (!UNOG.unsubHand) unoListenMyHand(roomId);

      // Belum pernah dapat kartu awal? Bagikan diri sendiri dari dek bersama.
      if (room.status === 'playing' && !(UNOG.myUid in room.handCounts) && !UNOG.dealingInProgress) {
        UNOG.dealingInProgress = true;
        try { await unoDealSelf(roomId); } catch (e) { console.error('Gagal deal diri sendiri:', e); }
        UNOG.dealingInProgress = false;
      }

      // Kena efek +2/+4 dan belum resolve? Tarik kartu di background.
      if (room.status === 'playing' && room.pendingForceDraw && room.pendingForceDraw.uid === UNOG.myUid && !UNOG.resolvingForceDraw) {
        UNOG.resolvingForceDraw = true;
        try { await unoResolveForceDraw(roomId, room.pendingForceDraw.count); } catch (e) { console.error('Gagal resolve force draw:', e); }
        UNOG.resolvingForceDraw = false;
      }

      // Toast aksi terakhir (kalau berubah dari sebelumnya)
      if (room.lastAction && (!prevRoom || !prevRoom.lastAction || prevRoom.lastAction.ts !== room.lastAction.ts)) {
        unoAnnounceAction(room.lastAction, room);
      }

      unoRenderArena(room);

      if (room.status === 'finished' && !UNOG.finishHandled) {
        UNOG.finishHandled = true;
        unoHandleGameFinished(room);
      }
    }
  }, (err) => console.error('Listener room UNO error:', err));
}

function unoListenMyHand(roomId) {
  UNOG.unsubHand = db.collection('unoRooms').doc(roomId).collection('hands').doc(UNOG.myUid)
    .onSnapshot((doc) => {
      UNOG.myHand = doc.exists ? (doc.data().cards || []) : [];
      if (UNOG.room) unoRenderHandArea(UNOG.room);
    }, (err) => console.error('Listener tangan UNO error:', err));
}

async function unoDealSelf(roomId) {
  const roomRef = db.collection('unoRooms').doc(roomId);
  const deckRef = roomRef.collection('deck').doc('state');
  const handRef = roomRef.collection('hands').doc(UNOG.myUid);
  await db.runTransaction(async (tx) => {
    const deckDoc = await tx.get(deckRef);
    const cards = deckDoc.data().cards;
    const myCards = cards.slice(0, 7);
    const rest = cards.slice(7);
    tx.set(handRef, { cards: myCards });
    tx.update(deckRef, { cards: rest });
  });
  // Update jumlah kartu di room doc (transisi khusus "deal diri sendiri" —
  // lihat unoDealSelfValid() di firestore.rules).
  const roomDoc = await roomRef.get();
  const room = roomDoc.data();
  await roomRef.update({
    ['handCounts.' + UNOG.myUid]: 7,
    drawPileCount: firebase.firestore.FieldValue.increment(-7),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function unoResolveForceDraw(roomId, count) {
  const roomRef = db.collection('unoRooms').doc(roomId);
  const deckRef = roomRef.collection('deck').doc('state');
  const handRef = roomRef.collection('hands').doc(UNOG.myUid);
  await db.runTransaction(async (tx) => {
    const deckDoc = await tx.get(deckRef);
    const handDoc = await tx.get(handRef);
    const deckCards = deckDoc.data().cards;
    const drawn = deckCards.slice(0, count);
    const rest = deckCards.slice(count);
    const myCards = [...(handDoc.data().cards || []), ...drawn];
    tx.set(handRef, { cards: myCards });
    tx.update(deckRef, { cards: rest });
  });
  const roomDoc = await roomRef.get();
  const room = roomDoc.data();
  await roomRef.update({
    pendingForceDraw: null,
    ['handCounts.' + UNOG.myUid]: (room.handCounts[UNOG.myUid] || 0) + count,
    drawPileCount: firebase.firestore.FieldValue.increment(-count),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  unoPlaySound('draw');
  unoShowToast(`Kamu menarik ${count} kartu.`);
}

// ---------------------------------------------------------------
// GILIRAN — hitung pemain aktif berikutnya (lewati yang sudah menang)
// ---------------------------------------------------------------
function unoNextActiveUid(room, fromUid, dir, skipCount) {
  const ids = room.playerIds;
  const active = ids.filter(u => !room.winnerOrder.includes(u));
  if (active.length <= 1) return null;
  let idx = ids.indexOf(fromUid);
  let steps = skipCount;
  while (steps > 0) {
    do { idx = (idx + dir + ids.length) % ids.length; } while (room.winnerOrder.includes(ids[idx]));
    steps--;
  }
  return ids[idx];
}

// ---------------------------------------------------------------
// RENDER ARENA
// ---------------------------------------------------------------
function unoRenderArena(room) {
  document.getElementById('unoHeaderMode').innerText = room.roomCode;
  document.getElementById('unoHeaderRound').innerText = room.playerIds.length + '/' + room.maxPlayers;

  const dirIcon = document.getElementById('unoDirIcon');
  if (dirIcon) dirIcon.closest('#unoDirRing').style.transform = room.direction === -1 ? 'scaleX(-1)' : '';

  // Kartu teratas + info dek
  const tableWrap = document.getElementById('unoTableTop');
  if (tableWrap && room.discardTop) {
    tableWrap.innerHTML = '';
    tableWrap.appendChild(unoRenderCardEl(room.discardTop, { size: 'lg' }));
    if (room.discardTop.color === 'wild' && room.activeColor) {
      const ring = document.createElement('div');
      ring.style.cssText = `width:14px;height:14px;border-radius:50%;background:${({red:'#e8323a',yellow:'#ffc93c',green:'#2fb350',blue:'#2563eb'})[room.activeColor]};margin:6px auto 0;box-shadow:0 0 8px rgba(255,255,255,.4)`;
      tableWrap.appendChild(ring);
    }
  }
  const deckCountEl = document.getElementById('unoDeckCount');
  if (deckCountEl) deckCountEl.innerText = room.drawPileCount;

  // Lawan (semua pemain selain diri sendiri) — cuma nama + jumlah kartu
  const others = room.playerIds.filter(u => u !== UNOG.myUid);
  const slotIds = ['unoSlotTop', 'unoSlotLeft', 'unoSlotRight'];
  slotIds.forEach((sid, i) => {
    const el = document.getElementById(sid);
    if (!el) return;
    const uid = others[i];
    if (!uid) { el.innerHTML = ''; return; }
    const isTurn = room.currentTurnUid === uid;
    const isOut = room.winnerOrder.includes(uid);
    const count = room.handCounts[uid] || 0;
    const rankIdx = room.winnerOrder.indexOf(uid);
    el.innerHTML = `
      <div class="uno-opp-avatar-ring" style="width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#2a1412;font-weight:800;font-size:14px;${isTurn ? 'box-shadow:0 0 0 3px var(--u-cyan),0 0 16px var(--u-glow);' : ''}">${(room.playerNames[uid] || '?').charAt(0).toUpperCase()}</div>
      <div style="font-size:12px;font-weight:700;text-align:center">${room.playerNames[uid] || 'Pemain'}${isOut ? ' (#' + (rankIdx + 1) + ')' : ''}</div>
      <div style="font-size:11px;color:var(--u-muted)">${isOut ? 'Selesai' : count + ' kartu'}</div>
    `;
  });

  unoRenderHandArea(room);
  unoRenderControls(room);
}

function unoRenderHandArea(room) {
  const scroll = document.getElementById('unoHandScroll');
  const nameEl = document.getElementById('unoHandName');
  const avatarEl = document.getElementById('unoHandAvatar');
  const statusEl = document.getElementById('unoTurnStatus');
  const countEl = document.getElementById('unoHandCount');
  const callBtn = document.getElementById('unoCallBtn');
  if (!scroll) return;

  const isMyTurn = room.currentTurnUid === UNOG.myUid;
  const iAmOut = room.winnerOrder.includes(UNOG.myUid);

  if (nameEl) nameEl.innerText = UNOG.myName || 'Kamu';
  if (avatarEl) avatarEl.innerText = (UNOG.myName || '?').charAt(0).toUpperCase();
  if (statusEl) {
    statusEl.innerText = iAmOut ? 'Kamu sudah selesai bermain' : (isMyTurn ? 'Giliranmu!' : 'Menunggu giliran...');
    statusEl.classList.toggle('waiting', !isMyTurn);
  }
  if (countEl) countEl.innerText = UNOG.myHand.length + ' kartu di tangan';
  if (callBtn) callBtn.style.display = (UNOG.myHand.length === 1 && !iAmOut) ? '' : 'none';

  scroll.innerHTML = '';
  if (UNOG.myHand.length === 0) {
    scroll.innerHTML = '<div class="uno-hand-empty">Tidak ada kartu.</div>';
    return;
  }
  UNOG.myHand.forEach((card, idx) => {
    const canPlay = isMyTurn && !iAmOut && !room.pendingForceDraw && room.discardTop && unoCanPlayCard(card, room.discardTop, room.activeColor);
    const el = unoRenderCardEl(card, {
      size: 'lg',
      disabled: !canPlay,
      onClick: () => unoHandleCardClick(idx),
    });
    scroll.appendChild(el);
  });
}

function unoRenderControls(room) {
  const isMyTurn = room.currentTurnUid === UNOG.myUid;
  const iAmOut = room.winnerOrder.includes(UNOG.myUid);
  const drawBtn = document.getElementById('unoDrawPileBtn');
  if (drawBtn) drawBtn.disabled = !isMyTurn || iAmOut || !!room.pendingForceDraw;
}

function unoAnnounceAction(action, room) {
  if (!action || !action.byUid) return;
  const name = action.byName || room.playerNames[action.byUid] || 'Pemain';
  if (action.type === 'start') { unoShowToast('Permainan dimulai!'); return; }
  if (action.type === 'play') { unoShowToast(`${name} memainkan ${unoCardName(action.card)}`); unoPlaySound(action.byUid === UNOG.myUid ? 'play' : 'click'); return; }
  if (action.type === 'draw') { unoShowToast(`${name} menarik kartu`); return; }
}

// ---------------------------------------------------------------
// AKSI PEMAIN: mainkan kartu
// ---------------------------------------------------------------
function unoHandleCardClick(index) {
  const room = UNOG.room;
  if (!room || room.currentTurnUid !== UNOG.myUid || room.winnerOrder.includes(UNOG.myUid) || room.pendingForceDraw) return;
  const card = UNOG.myHand[index];
  if (!unoCanPlayCard(card, room.discardTop, room.activeColor)) { unoPlaySound('error'); unoShowToast('Kartu tidak bisa dimainkan sekarang.'); return; }
  if (card.color === 'wild') {
    UNOG.pendingWildCard = { card, index };
    document.getElementById('unoColorPicker').classList.add('active');
    return;
  }
  unoSubmitPlay(card, index, null);
}

function unoHandleColorPick(color) {
  document.getElementById('unoColorPicker').classList.remove('active');
  if (!UNOG.pendingWildCard) return;
  const { card, index } = UNOG.pendingWildCard;
  UNOG.pendingWildCard = null;
  unoSubmitPlay(card, index, color);
}

async function unoSubmitPlay(card, index, chosenColor) {
  const room = UNOG.room;
  const roomId = UNOG.roomId;
  const nextColor = chosenColor || card.color;
  const newHand = [...UNOG.myHand];
  newHand.splice(index, 1);
  const isWinner = newHand.length === 0;

  let dir = room.direction;
  let skipCount = 1;
  let victimUid = null;
  let forceDrawCount = 0;

  const activePlayerCount = room.playerIds.filter(u => !room.winnerOrder.includes(u) || u === UNOG.myUid).length;

  if (card.type === UNO_CARD_TYPES.REVERSE) {
    dir = -dir;
    if (activePlayerCount <= 2) skipCount = 2; // 2 pemain: reverse = skip
  } else if (card.type === UNO_CARD_TYPES.SKIP) {
    skipCount = 2;
  } else if (card.type === UNO_CARD_TYPES.DRAW_TWO) {
    victimUid = unoNextActiveUid(room, UNOG.myUid, dir, 1);
    forceDrawCount = 2;
    skipCount = 2;
  } else if (card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) {
    victimUid = unoNextActiveUid(room, UNOG.myUid, dir, 1);
    forceDrawCount = 4;
    skipCount = 2;
  }

  const winnerOrderUpdate = isWinner ? [...room.winnerOrder, UNOG.myUid] : room.winnerOrder;
  const remainingActive = room.playerIds.filter(u => !winnerOrderUpdate.includes(u));
  const gameFinished = remainingActive.length <= 1;
  const nextTurnUid = gameFinished ? null : unoNextActiveUid({ ...room, winnerOrder: winnerOrderUpdate }, UNOG.myUid, dir, skipCount);

  try {
    const roomRef = db.collection('unoRooms').doc(roomId);
    const handRef = roomRef.collection('hands').doc(UNOG.myUid);
    await db.runTransaction(async (tx) => {
      const freshRoomDoc = await tx.get(roomRef);
      const freshRoom = freshRoomDoc.data();
      if (freshRoom.status !== 'playing' || freshRoom.currentTurnUid !== UNOG.myUid) {
        throw new Error('Giliran sudah berubah, coba lagi.');
      }
      tx.set(handRef, { cards: newHand });
      tx.update(roomRef, {
        discardTop: card,
        activeColor: nextColor,
        direction: dir,
        currentTurnUid: nextTurnUid,
        ['handCounts.' + UNOG.myUid]: newHand.length,
        pendingForceDraw: forceDrawCount > 0 ? { uid: victimUid, count: forceDrawCount } : null,
        winnerOrder: winnerOrderUpdate,
        status: gameFinished ? 'finished' : 'playing',
        lastAction: { type: 'play', byUid: UNOG.myUid, byName: UNOG.myName, card, ts: Date.now() },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    unoPlaySound(isWinner ? 'win' : 'play');
    if (UNOG.myHand.length === 1 && !isWinner) unoPlaySound('uno');
  } catch (err) {
    console.error('Gagal main kartu:', err);
    unoShowToast('Gagal main kartu: ' + err.message);
  }
}

async function unoHandleDrawClick() {
  const room = UNOG.room;
  if (!room || room.currentTurnUid !== UNOG.myUid || room.winnerOrder.includes(UNOG.myUid) || room.pendingForceDraw) return;
  const roomId = UNOG.roomId;
  const roomRef = db.collection('unoRooms').doc(roomId);
  const deckRef = roomRef.collection('deck').doc('state');
  const handRef = roomRef.collection('hands').doc(UNOG.myUid);
  try {
    let drawnCard = null;
    await db.runTransaction(async (tx) => {
      const freshRoomDoc = await tx.get(roomRef);
      const freshRoom = freshRoomDoc.data();
      if (freshRoom.status !== 'playing' || freshRoom.currentTurnUid !== UNOG.myUid) throw new Error('Giliran sudah berubah.');
      const deckDoc = await tx.get(deckRef);
      const cards = deckDoc.data().cards;
      drawnCard = cards[0];
      const rest = cards.slice(1);
      const myNewHand = [...UNOG.myHand, drawnCard];
      const nextTurnUid = unoNextActiveUid(freshRoom, UNOG.myUid, freshRoom.direction, 1);
      tx.set(handRef, { cards: myNewHand });
      tx.update(deckRef, { cards: rest });
      tx.update(roomRef, {
        currentTurnUid: nextTurnUid,
        ['handCounts.' + UNOG.myUid]: myNewHand.length,
        drawPileCount: rest.length,
        lastAction: { type: 'draw', byUid: UNOG.myUid, byName: UNOG.myName, ts: Date.now() },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    unoPlaySound('draw');
  } catch (err) {
    console.error('Gagal menarik kartu:', err);
    unoShowToast('Gagal menarik kartu: ' + err.message);
  }
}

function unoHandleCallUno() {
  unoPlaySound('uno');
  unoShowToast('UNO!');
}

// ---------------------------------------------------------------
// AKHIR GAME — simpan poin & riwayat (SEMUA client melakukan ini untuk
// dirinya sendiri masing-masing begitu status room jadi 'finished')
// ---------------------------------------------------------------
async function unoHandleGameFinished(room) {
  const order = [...room.winnerOrder];
  // Satu pemain yang tersisa (tidak masuk winnerOrder) otomatis peringkat terakhir.
  const lastPlaceUid = room.playerIds.find(u => !order.includes(u));
  if (lastPlaceUid) order.push(lastPlaceUid);
  const myPlacement = order.indexOf(UNOG.myUid) + 1;

  try {
    await gdRecordUnoResult({ myUid: UNOG.myUid, placement: myPlacement });
  } catch (err) {
    console.error('Gagal menyimpan poin UNO:', err);
  }

  // Catat 1 baris riwayat match — idempoten (doc id = roomId), penulis
  // kedua dst akan ditolak rules (create-only) dan itu memang disengaja.
  const pointsChange = {};
  order.forEach((uid, i) => { pointsChange[uid] = gdUnoPointsForPlacement(i + 1); });
  gdLogUnoMatch({
    matchId: UNOG.roomId,
    playerIds: room.playerIds,
    players: room.playerNames,
    placements: order,
    pointsChange,
    winnerId: order[0],
  });

  const won = myPlacement === 1;
  unoShowResultModal(won, myPlacement, order.length);
}

function unoShowResultModal(won, placement, totalPlayers) {
  const icon = document.getElementById('unoResultIcon') || document.getElementById('tmcResultIcon');
  const modal = document.getElementById('unoResultModal');
  if (!modal) { unoShowToast(won ? 'Kamu menang!' : `Game selesai — peringkat #${placement}`); return; }
  document.getElementById('unoResultIcon').className = 'uno-result-icon ' + (won ? 'win' : 'lose');
  document.getElementById('unoResultTitle').innerText = won ? 'Kamu Menang!' : 'Game Selesai';
  document.getElementById('unoResultSub').innerText = `Peringkat #${placement} dari ${totalPlayers} pemain.`;
  modal.classList.add('active');
}

function unoCloseResultModal() {
  const modal = document.getElementById('unoResultModal');
  if (modal) modal.classList.remove('active');
}

// ---------------------------------------------------------------
// KEMBALI KE MENU / KELUAR ROOM
// ---------------------------------------------------------------
function unoBackToSetup() {
  unoCloseResultModal();
  if (UNOG.unsubRoom) { UNOG.unsubRoom(); UNOG.unsubRoom = null; }
  if (UNOG.unsubHand) { UNOG.unsubHand(); UNOG.unsubHand = null; }
  UNOG.roomId = null; UNOG.room = null; UNOG.myHand = [];
  UNOG.dealingInProgress = false; UNOG.resolvingForceDraw = false; UNOG.finishHandled = false;
  document.getElementById('unoGameArea').classList.remove('active');
  document.getElementById('unoLobbyCard').style.display = 'none';
  document.getElementById('unoSetupCard').style.display = '';
  document.getElementById('unoSetupNotice').style.display = 'none';
  document.getElementById('unoHeaderMode').innerText = '—';
  document.getElementById('unoHeaderRound').innerText = '—';
  unoRefreshIdentity();
}

// ---------------------------------------------------------------
// INIT — begitu halaman UNO dibuka
// ---------------------------------------------------------------
function unoOnPageOpen() {
  unoRefreshIdentity().then(() => unoTryAutoRejoin());
}
