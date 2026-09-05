// ========================================================================
// TM CHESS — engine catur lokal (2 pemain, 1 perangkat).
// File berdiri sendiri, tidak menyentuh script.js/database.js yang lama.
// Aturan diimplementasikan asli: legal moves, check, checkmate, stalemate,
// castling, en passant, promotion, 50-move & insufficient-material draw.
// ========================================================================

const TMC = {
  board: null,          // 8x8, board[r][c] = {type,color} | null.  r0=rank8 ... r7=rank1
  turn: 'w',
  castling: { wK: true, wQ: true, bK: true, bQ: true },
  ep: null,             // {r,c} target kotak en passant, atau null
  halfmove: 0,
  fullmove: 1,
  history: [],           // {san, boardSnapshot, castling, ep, halfmove, turn}
  selected: null,
  legalForSelected: [],
  lastMove: null,        // {from:{r,c}, to:{r,c}}
  gameOver: false,
  captured: { w: [], b: [] }, // captured.w = bidak putih yang tertangkap (milik hitam menangkapnya)
  timeControl: { init: 600, inc: 0 },
  clocks: { w: 600, b: 600 },
  clockTimer: null,
  clockRunning: false,
  theme: 'ivory',
  soundOn: true,
  soundVolume: 0.7, // 0..1, dikontrol slider volume di setup & topbar
  players: { w: 'Pemain Putih', b: 'Pemain Hitam' },
  drawOfferBy: null,
  started: false,
  boardFlipped: false,

  // ---- Field khusus MODE ONLINE (diisi/dipakai oleh chess-online.js) ----
  onlineRoomId: null,      // null = permainan lokal biasa
  onlineMyColor: null,     // 'w' | 'b' — warna yang dikendalikan akun yang login
  onlineUids: { w: null, b: null },
  onlineRatingBefore: { w: null, b: null }, // rating dibekukan saat room dimulai, dipakai hitung ELO
};

// ---------------------------------------------------------------
// IKON BIDAK — set visual orisinal TM Chess (bukan aset chess.com)
// ---------------------------------------------------------------
const TMC_PIECE_BASE = '<path d="M18 85h64M23 78h54l-5-8H28l-5 8Zm7-10h40l-4-8H34l-4 8Z"/>';
const TMC_PIECE_PATHS = {
  p: '<circle cx="50" cy="25" r="10"/><path d="M43 35c2 9 0 18-7 25-3 3-4 7 2 9h24c6-2 5-6 2-9-7-7-9-16-7-25Z"/>',
  r: '<path d="M35 22v12h8V22h14v12h8V22h7v19c-2 4-7 5-8 12l-3 17H39l-3-17c-1-7-6-8-8-12V22h7Z"/><path d="M32 47h36M39 65h22" fill="none" stroke-width="1.5"/>',
  n: '<path d="M30 75c3-10 9-16 14-22-8-8-9-18-3-29 3-6 12-11 22-9l-5 9 10 7c-3 8-8 12-15 14 6 4 10 12 11 30H30Z"/>',
  b: '<path d="M50 19c-8 8-11 15-8 22 2 5 8 7 8 13 0 5-5 10-11 15h22c-6-5-11-10-11-15 0-6 6-8 8-13 3-7 0-14-8-22Z"/><path d="m43 29 14 16" fill="none" stroke-width="3"/>',
  q: '<path d="m28 24 10 12 12-17 12 17 10-12-5 36H33l-5-36Z"/><path d="M32 60h36" fill="none" stroke-width="2"/><circle cx="28" cy="23" r="3"/><circle cx="50" cy="18" r="3"/><circle cx="72" cy="23" r="3"/>',
  k: '<path d="M45 29h10M50 24v10" stroke-width="3"/><path d="M39 38c-3 8 2 15 7 20 0 5-5 11-11 14h30c-6-3-11-9-11-14 5-5 10-12 7-20-3-7-19-7-22 0Z"/>'
};
let tmcGradDefsInjected = false;
function tmcEnsurePieceDefs() {
  if (tmcGradDefsInjected) return;
  const svgns = 'http://www.w3.org/2000/svg';
  const holder = document.createElementNS(svgns, 'svg');
  holder.setAttribute('width', '0'); holder.setAttribute('height', '0');
  holder.style.position = 'absolute';
  holder.innerHTML = '<defs>' +
    '<linearGradient id="tmcIvory" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#fff9e8"/><stop offset=".5" stop-color="#e5d2ae"/><stop offset="1" stop-color="#a88d68"/></linearGradient>' +
    '<linearGradient id="tmcEbony" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#687078"/><stop offset=".5" stop-color="#30373c"/><stop offset="1" stop-color="#101417"/></linearGradient>' +
    '</defs>';
  document.body.appendChild(holder);
  tmcGradDefsInjected = true;
}

function tmcPieceSvg(type, color) {
  tmcEnsurePieceDefs();
  const light = color === 'w';
  const fill = light ? 'url(#tmcIvory)' : 'url(#tmcEbony)';
  const stroke = light ? '#a88d68' : '#121518';
  const inner = TMC_PIECE_PATHS[type] + TMC_PIECE_BASE;
  return `<svg class="tmc-piece-art" viewBox="0 0 100 100"><g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round">${inner}</g></svg>`;
}

// ---------------------------------------------------------------
// SETUP PAPAN
// ---------------------------------------------------------------
function tmcInitialBoard() {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: backRank[c], color: 'b' };
    b[1][c] = { type: 'p', color: 'b' };
    b[6][c] = { type: 'p', color: 'w' };
    b[7][c] = { type: backRank[c], color: 'w' };
  }
  return b;
}

function tmcCloneBoard(board) {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function tmcInBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function tmcOpp(color) { return color === 'w' ? 'b' : 'w'; }

// ---------------------------------------------------------------
// GENERASI LANGKAH (pseudo-legal per bidak)
// ---------------------------------------------------------------
function tmcPseudoMoves(state, r, c) {
  const board = state.board;
  const piece = board[r][c];
  if (!piece) return [];
  const moves = [];
  const dir = piece.color === 'w' ? -1 : 1;
  const startRank = piece.color === 'w' ? 6 : 1;
  const lastRank = piece.color === 'w' ? 0 : 7;

  const pushMove = (tr, tc, extra = {}) => moves.push({ from: { r, c }, to: { r: tr, c: tc }, ...extra });

  if (piece.type === 'p') {
    if (tmcInBounds(r + dir, c) && !board[r + dir][c]) {
      if (r + dir === lastRank) ['q', 'r', 'b', 'n'].forEach(pr => pushMove(r + dir, c, { promotion: pr }));
      else pushMove(r + dir, c);
      if (r === startRank && !board[r + 2 * dir][c]) pushMove(r + 2 * dir, c, { doubleStep: true });
    }
    for (const dc of [-1, 1]) {
      const tr = r + dir, tc = c + dc;
      if (!tmcInBounds(tr, tc)) continue;
      const target = board[tr][tc];
      if (target && target.color !== piece.color) {
        if (tr === lastRank) ['q', 'r', 'b', 'n'].forEach(pr => pushMove(tr, tc, { promotion: pr }));
        else pushMove(tr, tc);
      } else if (!target && state.ep && state.ep.r === tr && state.ep.c === tc) {
        pushMove(tr, tc, { enPassant: true });
      }
    }
  } else if (piece.type === 'n') {
    const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of deltas) {
      const tr = r + dr, tc = c + dc;
      if (!tmcInBounds(tr, tc)) continue;
      const target = board[tr][tc];
      if (!target || target.color !== piece.color) pushMove(tr, tc);
    }
  } else if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const tr = r + dr, tc = c + dc;
      if (!tmcInBounds(tr, tc)) continue;
      const target = board[tr][tc];
      if (!target || target.color !== piece.color) pushMove(tr, tc);
    }
    // castling
    const rank = piece.color === 'w' ? 7 : 0;
    if (r === rank && c === 4) {
      const canK = piece.color === 'w' ? state.castling.wK : state.castling.bK;
      const canQ = piece.color === 'w' ? state.castling.wQ : state.castling.bQ;
      if (canK && !board[rank][5] && !board[rank][6] &&
          !tmcSquareAttacked(board, rank, 4, tmcOpp(piece.color)) &&
          !tmcSquareAttacked(board, rank, 5, tmcOpp(piece.color)) &&
          !tmcSquareAttacked(board, rank, 6, tmcOpp(piece.color))) {
        pushMove(rank, 6, { castle: 'K' });
      }
      if (canQ && !board[rank][1] && !board[rank][2] && !board[rank][3] &&
          !tmcSquareAttacked(board, rank, 4, tmcOpp(piece.color)) &&
          !tmcSquareAttacked(board, rank, 3, tmcOpp(piece.color)) &&
          !tmcSquareAttacked(board, rank, 2, tmcOpp(piece.color))) {
        pushMove(rank, 2, { castle: 'Q' });
      }
    }
  } else {
    const dirsMap = {
      b: [[-1,-1],[-1,1],[1,-1],[1,1]],
      r: [[-1,0],[1,0],[0,-1],[0,1]],
      q: [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]
    };
    for (const [dr, dc] of dirsMap[piece.type]) {
      let tr = r + dr, tc = c + dc;
      while (tmcInBounds(tr, tc)) {
        const target = board[tr][tc];
        if (!target) { pushMove(tr, tc); }
        else { if (target.color !== piece.color) pushMove(tr, tc); break; }
        tr += dr; tc += dc;
      }
    }
  }
  return moves;
}

function tmcSquareAttacked(board, r, c, byColor) {
  // pion
  const pawnDir = byColor === 'w' ? 1 : -1; // arah dari kotak target ke pion penyerang
  for (const dc of [-1, 1]) {
    const pr = r + pawnDir, pc = c + dc;
    if (tmcInBounds(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.type === 'p' && p.color === byColor) return true;
    }
  }
  // kuda
  const nMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of nMoves) {
    const nr = r + dr, nc = c + dc;
    if (tmcInBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.type === 'n' && p.color === byColor) return true;
    }
  }
  // raja
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (dr === 0 && dc === 0) continue;
    const nr = r + dr, nc = c + dc;
    if (tmcInBounds(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.type === 'k' && p.color === byColor) return true;
    }
  }
  // sliding: benteng/ratu
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let tr = r + dr, tc = c + dc;
    while (tmcInBounds(tr, tc)) {
      const p = board[tr][tc];
      if (p) { if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true; break; }
      tr += dr; tc += dc;
    }
  }
  // sliding: gajah/ratu
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let tr = r + dr, tc = c + dc;
    while (tmcInBounds(tr, tc)) {
      const p = board[tr][tc];
      if (p) { if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true; break; }
      tr += dr; tc += dc;
    }
  }
  return false;
}

function tmcFindKing(board, color) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.type === 'k' && p.color === color) return { r, c };
  }
  return null;
}

function tmcIsInCheck(board, color) {
  const k = tmcFindKing(board, color);
  if (!k) return false;
  return tmcSquareAttacked(board, k.r, k.c, tmcOpp(color));
}

// Terapkan move ke SALINAN board (dipakai untuk uji legalitas & eksekusi nyata)
function tmcApplyMoveToBoard(board, move) {
  const piece = board[move.from.r][move.from.c];
  const captured = board[move.to.r][move.to.c];
  board[move.to.r][move.to.c] = { ...piece };
  board[move.from.r][move.from.c] = null;

  let epCaptured = null;
  if (move.enPassant) {
    const capR = move.from.r; // baris asal pion penangkap = baris pion lawan yang ditangkap
    epCaptured = board[capR][move.to.c];
    board[capR][move.to.c] = null;
  }
  if (move.promotion) board[move.to.r][move.to.c].type = move.promotion;
  if (move.castle) {
    const rank = move.from.r;
    if (move.castle === 'K') {
      board[rank][5] = board[rank][7];
      board[rank][7] = null;
    } else {
      board[rank][3] = board[rank][0];
      board[rank][0] = null;
    }
  }
  return { captured: captured || epCaptured };
}

function tmcLegalMoves(state, r, c) {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = tmcPseudoMoves(state, r, c);
  const legal = [];
  for (const m of pseudo) {
    const testBoard = tmcCloneBoard(state.board);
    tmcApplyMoveToBoard(testBoard, m);
    if (!tmcIsInCheck(testBoard, piece.color)) legal.push(m);
  }
  return legal;
}

function tmcAllLegalMoves(state, color) {
  const all = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = state.board[r][c];
    if (p && p.color === color) all.push(...tmcLegalMoves(state, r, c));
  }
  return all;
}

function tmcInsufficientMaterial(board) {
  const pieces = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c]) pieces.push(board[r][c]);
  if (pieces.length > 4) return false;
  const nonKing = pieces.filter(p => p.type !== 'k');
  if (nonKing.length === 0) return true; // K vs K
  if (nonKing.length === 1 && (nonKing[0].type === 'b' || nonKing[0].type === 'n')) return true; // K+B/N vs K
  if (nonKing.length === 2 && nonKing.every(p => p.type === 'b')) {
    // K+B vs K+B, hanya draw otomatis jika sesama warna kotak & beda sisi — disederhanakan: anggap cukup
    return false;
  }
  return false;
}

const TMC_FILES = 'abcdefgh';
function tmcSquareName(r, c) { return TMC_FILES[c] + (8 - r); }

function tmcMoveToSAN(state, move, legalMovesAtTime) {
  const piece = state.board[move.from.r][move.from.c];
  if (move.castle === 'K') return 'O-O';
  if (move.castle === 'Q') return 'O-O-O';
  const capture = !!state.board[move.to.r][move.to.c] || move.enPassant;
  let s = '';
  if (piece.type !== 'p') {
    s += piece.type.toUpperCase();
  } else if (capture) {
    s += TMC_FILES[move.from.c];
  }
  if (capture) s += 'x';
  s += tmcSquareName(move.to.r, move.to.c);
  if (move.promotion) s += '=' + move.promotion.toUpperCase();
  return s;
}

// ---------------------------------------------------------------
// EKSEKUSI MOVE (mengubah state permainan sesungguhnya)
// ---------------------------------------------------------------
function tmcMakeMove(move) {
  const state = TMC;
  TMC._animateMove = true;
  const piece = state.board[move.from.r][move.from.c];
  const legalNow = tmcAllLegalMoves(state, state.turn);
  const san = tmcMoveToSAN(state, move, legalNow);

  const isPawnMove = piece.type === 'p';
  const isCaptureFlag = !!state.board[move.to.r][move.to.c] || move.enPassant;

  const { captured } = tmcApplyMoveToBoard(state.board, move);
  if (captured) state.captured[captured.color].push(captured.type);

  // update hak kastling
  if (piece.type === 'k') {
    if (piece.color === 'w') { state.castling.wK = false; state.castling.wQ = false; }
    else { state.castling.bK = false; state.castling.bQ = false; }
  }
  const clearRookRight = (r, c) => {
    if (r === 7 && c === 0) state.castling.wQ = false;
    if (r === 7 && c === 7) state.castling.wK = false;
    if (r === 0 && c === 0) state.castling.bQ = false;
    if (r === 0 && c === 7) state.castling.bK = false;
  };
  clearRookRight(move.from.r, move.from.c);
  clearRookRight(move.to.r, move.to.c);

  // update en passant target
  state.ep = move.doubleStep ? { r: (move.from.r + move.to.r) / 2, c: move.from.c } : null;

  state.halfmove = (isPawnMove || isCaptureFlag) ? 0 : state.halfmove + 1;
  if (state.turn === 'b') state.fullmove++;

  state.lastMove = { from: move.from, to: move.to };
  state.selected = null;
  state.legalForSelected = [];
  state.drawOfferBy = null;

  const opponent = tmcOpp(piece.color);
  const givingCheck = tmcIsInCheck(state.board, opponent);
  state.turn = opponent;
  // Orientasi papan TIDAK ikut giliran (HP diam di meja, 2 pemain duduk
  // berhadapan — kalau papan auto-muter, bidak yang tadi deket satu pemain
  // malah "loncat" ke ujung layar yang jauh tiap ganti giliran). Papan tetap
  // di satu arah sepanjang permainan; tombol putar (tmcFlipBoard) murni
  // opsional buat pemain yang mau ngintip dari sisi lain kapan saja.
  let sanFinal = san;
  if (givingCheck) {
    const oppLegal = tmcAllLegalMoves(state, opponent);
    sanFinal += oppLegal.length === 0 ? '#' : '+';
  }
  state.history.push({ san: sanFinal, color: opponent === 'w' ? 'b' : 'w' });

  tmcPlaySound(isCaptureFlag ? 'capture' : 'move');
  if (givingCheck) setTimeout(() => tmcPlaySound('check'), 120);

  tmcApplyClockIncrement(piece.color);
  tmcCheckGameEnd();
  tmcRender();
}

function tmcCheckGameEnd() {
  const state = TMC;
  const legal = tmcAllLegalMoves(state, state.turn);
  if (legal.length === 0) {
    if (tmcIsInCheck(state.board, state.turn)) {
      tmcEndGame(tmcOpp(state.turn), 'checkmate');
    } else {
      tmcEndGame(null, 'stalemate');
    }
    return;
  }
  if (state.halfmove >= 100) { tmcEndGame(null, '50move'); return; }
  if (tmcInsufficientMaterial(state.board)) { tmcEndGame(null, 'material'); return; }
}

// ---------------------------------------------------------------
// JAM CATUR
// ---------------------------------------------------------------
function tmcApplyClockIncrement(colorThatMoved) {
  TMC.clocks[colorThatMoved] += TMC.timeControl.inc;
}

function tmcStartClockTick() {
  if (TMC.clockTimer) clearInterval(TMC.clockTimer);
  if (TMC.timeControl.init <= 0) return; // waktu unlimited
  TMC.clockRunning = true;
  TMC.clockTimer = setInterval(() => {
    if (TMC.gameOver) { clearInterval(TMC.clockTimer); return; }
    TMC.clocks[TMC.turn] = Math.max(0, TMC.clocks[TMC.turn] - 1);
    if (TMC.clocks[TMC.turn] === 0) {
      clearInterval(TMC.clockTimer);
      tmcEndGame(tmcOpp(TMC.turn), 'timeout');
      tmcRender();
      return;
    }
    tmcRenderClocks();
  }, 1000);
}

function tmcStopClockTick() {
  if (TMC.clockTimer) clearInterval(TMC.clockTimer);
  TMC.clockRunning = false;
}

function tmcFormatClock(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------
// SUARA (Web Audio API — tanpa file eksternal)
// ---------------------------------------------------------------
let tmcAudioCtx = null;
let tmcNoiseBuffer = null;
function tmcGetNoiseBuffer(ctx) {
  if (tmcNoiseBuffer) return tmcNoiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.3);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  tmcNoiseBuffer = buf;
  return buf;
}

// "ketukan" bidak/papan — noise pendek disaring lewat lowpass (lembut,
// seperti kayu tumpul, BUKAN bandpass ber-Q tinggi yang berdenging tajam)
function tmcNoiseHit(ctx, t, { duration = 0.05, freq = 1200, q = 0.7, gain = 0.16, type = 'lowpass' } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = tmcGetNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
  const g = ctx.createGain();
  const vol = gain * TMC.soundVolume;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter); filter.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + duration + 0.02);
}

// nada lembut (sine/triangle saja — hindari gelombang kotak/gigi gergaji
// yang terdengar kasar), dengan sedikit harmonisa supaya tetap hangat
function tmcTone(ctx, t, { freq = 440, duration = 0.12, gain = 0.11, wave = 'sine', harmonic = 0 } = {}) {
  const vol = gain * TMC.soundVolume;
  const osc = ctx.createOscillator();
  osc.type = wave; osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + duration + 0.02);
  if (harmonic > 0) {
    const osc2 = ctx.createOscillator();
    osc2.type = wave; osc2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(vol * harmonic, t + 0.015);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.7);
    osc2.connect(g2); g2.connect(ctx.destination);
    osc2.start(t); osc2.stop(t + duration + 0.02);
  }
}

function tmcPlaySound(kind) {
  if (!TMC.soundOn || TMC.soundVolume <= 0) return;
  try {
    if (!tmcAudioCtx) tmcAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = tmcAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    switch (kind) {
      // Langkah biasa: satu ketukan kayu lembut + nada rendah pendek — jelas
      // ada feedback, tapi tidak mengagetkan.
      case 'move':
        tmcNoiseHit(ctx, t, { duration: 0.05, freq: 1100, q: 0.7, gain: 0.15 });
        tmcTone(ctx, t, { freq: 165, duration: 0.05, gain: 0.06 });
        break;
      // Capture: ketukan lebih "berat" (frekuensi lebih rendah) + nada bass
      // sedikit lebih panjang — terasa beda dari move biasa tanpa jadi kasar.
      case 'capture':
        tmcNoiseHit(ctx, t, { duration: 0.07, freq: 750, q: 0.7, gain: 0.20 });
        tmcTone(ctx, t, { freq: 120, duration: 0.09, gain: 0.09, wave: 'triangle' });
        break;
      // Check: 2 nada pendek naik — sinyal "waspada" tapi tetap nada bulat (sine).
      case 'check':
        tmcTone(ctx, t, { freq: 660, duration: 0.10, gain: 0.10, harmonic: 0.3 });
        tmcTone(ctx, t + 0.10, { freq: 880, duration: 0.14, gain: 0.11, harmonic: 0.3 });
        break;
      // Checkmate/game over: 3 nada turun, tegas tapi tetap lembut (triangle+sine).
      case 'checkmate':
        tmcTone(ctx, t, { freq: 523, duration: 0.16, gain: 0.12, wave: 'triangle', harmonic: 0.3 });
        tmcTone(ctx, t + 0.15, { freq: 440, duration: 0.16, gain: 0.12, wave: 'triangle', harmonic: 0.3 });
        tmcTone(ctx, t + 0.30, { freq: 330, duration: 0.42, gain: 0.14, wave: 'triangle', harmonic: 0.35 });
        break;
      // Menang: arpeggio naik yang enak didengar, tanpa noise burst tajam di akhir.
      case 'victory':
        [392, 494, 587, 784].forEach((f, i) => tmcTone(ctx, t + i * 0.11, { freq: f, duration: 0.24, gain: 0.11, wave: 'triangle', harmonic: 0.3 }));
        tmcTone(ctx, t + 0.44, { freq: 988, duration: 0.4, gain: 0.13, wave: 'triangle', harmonic: 0.35 });
        break;
      // Draw/seri: 3 nada datar, netral (tidak menang tidak kalah).
      case 'draw':
        tmcTone(ctx, t, { freq: 494, duration: 0.15, gain: 0.10, harmonic: 0.2 });
        tmcTone(ctx, t + 0.14, { freq: 440, duration: 0.15, gain: 0.10, harmonic: 0.2 });
        tmcTone(ctx, t + 0.28, { freq: 349, duration: 0.26, gain: 0.10, harmonic: 0.2 });
        break;
      case 'start':
        [392, 494, 587].forEach((f, i) => tmcTone(ctx, t + i * 0.09, { freq: f, duration: 0.13, gain: 0.10, wave: 'triangle', harmonic: 0.25 }));
        break;
      case 'end':
        tmcTone(ctx, t, { freq: 440, duration: 0.16, gain: 0.09, harmonic: 0.2 });
        break;
      case 'click':
        tmcNoiseHit(ctx, t, { duration: 0.02, freq: 2200, q: 0.6, gain: 0.08 });
        break;
      default:
        tmcNoiseHit(ctx, t, { duration: 0.05, freq: 1100, q: 0.7, gain: 0.14 });
    }
  } catch (e) { /* audio tidak tersedia, abaikan */ }
}

// ---------------------------------------------------------------
// AKHIR PERMAINAN
// ---------------------------------------------------------------
function tmcEndGame(winner, reason) {
  if (TMC.gameOver) return;
  TMC.gameOver = true;
  TMC.result = { winner, reason };
  tmcStopClockTick();
  if (reason === 'checkmate') tmcPlaySound('checkmate');
  setTimeout(() => tmcPlaySound(winner ? 'victory' : 'draw'), reason === 'checkmate' ? 500 : 0);
  setTimeout(() => tmcShowResultModal(), 250);
  // Mode online: serahkan pencatatan rating/riwayat match ke chess-online.js.
  // Fungsi ini AMAN dipanggil dua kali (oleh kedua client) — chess-online.js
  // memastikan penulisan match log tidak dobel.
  if (TMC.onlineRoomId && typeof tcoOnGameEnd === 'function') tcoOnGameEnd(winner, reason);
}

function tmcResign(color) {
  if (TMC.gameOver || !TMC.started) return;
  tmcEndGame(tmcOpp(color), 'resign');
  tmcRender();
}

function tmcOfferDraw() {
  if (TMC.gameOver || !TMC.started) return;
  if (TMC.onlineRoomId) {
    alert('Tawaran seri untuk mode online belum tersedia di versi ini. Gunakan Resign kalau ingin mengakhiri game.');
    return;
  }
  if (TMC.drawOfferBy && TMC.drawOfferBy !== TMC.turn) {
    tmcEndGame(null, 'agreement');
    tmcRender();
    return;
  }
  TMC.drawOfferBy = TMC.turn;
  tmcRenderStatus();
}

// Undo aktual dikerjakan oleh tmcHandleUndo() (memakai snapshot stack), lihat di bawah.

// Simpan snapshot penuh tiap langkah supaya undo akurat & murah
function tmcPushSnapshot() {
  TMC._snapshots = TMC._snapshots || [];
  TMC._snapshots.push(JSON.stringify({
    board: TMC.board, turn: TMC.turn, castling: TMC.castling, ep: TMC.ep,
    halfmove: TMC.halfmove, fullmove: TMC.fullmove, captured: TMC.captured,
    lastMove: TMC.lastMove
  }));
}

function tmcRestoreSnapshot() {
  if (!TMC._snapshots || TMC._snapshots.length === 0) return false;
  const snap = JSON.parse(TMC._snapshots.pop());
  Object.assign(TMC, snap);
  TMC.selected = null;
  TMC.legalForSelected = [];
  TMC.history.pop();
  return true;
}

// ---------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------
function tmcRender() {
  tmcRenderBoard();
  tmcRenderClocks();
  tmcRenderCaptured();
  tmcRenderMoveList();
  tmcRenderPlayerBars();
  tmcRenderStatus();
  tmcRenderControls();
}

function tmcRenderBoard() {
  const boardEl = document.getElementById('tmcBoard');
  if (!boardEl) return;
  boardEl.className = 'tmc-board';

  // simpan posisi bidak sebelum re-render (untuk animasi FLIP)
  const prevRects = {};
  if (TMC._animateMove) {
    boardEl.querySelectorAll('.tmc-sq').forEach(sq => {
      const p = sq.querySelector('.tmc-piece-art');
      if (p) prevRects[sq.dataset.r + '_' + sq.dataset.c] = true;
    });
  }

  boardEl.innerHTML = '';
  const kingInCheck = TMC.gameOver ? null : (tmcIsInCheck(TMC.board, TMC.turn) ? tmcFindKing(TMC.board, TMC.turn) : null);
  const inCheckmate = TMC.gameOver && TMC.result && TMC.result.reason === 'checkmate';
  const mateKingSq = inCheckmate ? tmcFindKing(TMC.board, tmcOpp(TMC.result.winner)) : null;

  // Orientasi papan TETAP (tidak ikut giliran) — HP diam di meja, 2 pemain
  // duduk berhadapan, jadi papan yang auto-muter tiap giliran malah bikin
  // bidak "loncat" ke ujung layar yang jauh. Papan cuma berubah kalau pemain
  // menekan tombol putar (tmcFlipBoard) secara manual. DOM petak SELALU
  // disusun dalam urutan standar (r,c asli) — orientasi visual murni
  // dikerjakan CSS transform:rotate(180deg) pada papan, dengan bidak & label
  // koordinat di-counter-rotate supaya tetap tegak dan mudah dibaca. Game
  // state/klik selalu memakai koordinat asli, tidak pernah tersentuh.
  const flipped = TMC.boardFlipped;
  boardEl.classList.toggle('tmc-flipped', flipped);
  const boardRegion = document.querySelector('.tmc-board-region');
  if (boardRegion) boardRegion.classList.toggle('tmc-flipped', flipped);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      const isLight = (r + c) % 2 === 0;
      sq.className = 'tmc-sq ' + (isLight ? 'tmc-light' : 'tmc-dark');
      sq.dataset.r = r; sq.dataset.c = c;

      if (TMC.selected && TMC.selected.r === r && TMC.selected.c === c) sq.classList.add('tmc-sq-selected');
      if (TMC.lastMove && ((TMC.lastMove.from.r === r && TMC.lastMove.from.c === c) || (TMC.lastMove.to.r === r && TMC.lastMove.to.c === c))) sq.classList.add('tmc-sq-last');
      if (kingInCheck && kingInCheck.r === r && kingInCheck.c === c) sq.classList.add('tmc-sq-check');
      if (mateKingSq && mateKingSq.r === r && mateKingSq.c === c) sq.classList.add('tmc-sq-mate');

      const piece = TMC.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('div');
        pieceEl.className = 'tmc-piece';
        const inner = document.createElement('div');
        inner.className = 'tmc-piece-inner';
        inner.innerHTML = tmcPieceSvg(piece.type, piece.color);
        pieceEl.appendChild(inner);
        sq.appendChild(pieceEl);
      }

      const moveHere = TMC.legalForSelected.find(m => m.to.r === r && m.to.c === c);
      if (moveHere) {
        const dot = document.createElement('div');
        dot.className = piece ? 'tmc-dot-capture' : 'tmc-dot';
        sq.appendChild(dot);
      }

      if (c === 0) { const lab = document.createElement('em'); lab.className = 'tmc-coord-rank'; lab.innerText = 8 - r; sq.appendChild(lab); }
      if (r === 7) { const lab = document.createElement('em'); lab.className = 'tmc-coord-file'; lab.innerText = TMC_FILES[c]; sq.appendChild(lab); }

      sq.addEventListener('click', () => tmcOnSquareClick(r, c));
      boardEl.appendChild(sq);
    }
  }

  // animasi geser bidak yang baru pindah — dihitung di koordinat papan
  // standar (bukan visual); rotasi papan dikerjakan terpisah oleh CSS di atas
  if (TMC._animateMove && TMC.lastMove) {
    const destSq = boardEl.querySelector(`[data-r="${TMC.lastMove.to.r}"][data-c="${TMC.lastMove.to.c}"]`);
    const pieceEl = destSq && destSq.querySelector('.tmc-piece');
    if (pieceEl) {
      const cell = boardEl.getBoundingClientRect().width / 8;
      const dx = (TMC.lastMove.from.c - TMC.lastMove.to.c) * cell;
      const dy = (TMC.lastMove.from.r - TMC.lastMove.to.r) * cell;
      pieceEl.style.transition = 'none';
      pieceEl.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          pieceEl.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)';
          pieceEl.style.transform = 'translate(0,0)';
        });
      });
    }
    TMC._animateMove = false;
  }
}

function tmcOnSquareClick(r, c) {
  if (TMC.gameOver || !TMC.started) return;
  const piece = TMC.board[r][c];

  // ===== DEBUG SEMENTARA — hapus setelah bug "bisa gerak bidak lawan" ketemu =====
  if (piece) {
    alert('DEBUG KLIK BIDAK:\npiece.color=' + piece.color + '\nTMC.turn=' + TMC.turn + '\nonlineRoomId=' + TMC.onlineRoomId + '\nonlineMyColor=' + TMC.onlineMyColor + '\nLOLOS GUARD? ' + (piece.color === TMC.turn && (!TMC.onlineRoomId || TMC.turn === TMC.onlineMyColor)));
  }
  // ===== AKHIR DEBUG =====

  if (TMC.selected) {
    const chosen = TMC.legalForSelected.find(m => m.to.r === r && m.to.c === c);
    if (chosen) {
      if (chosen.promotion && chosen.promotion !== 'q') return; // hindari duplikat entri promosi; tangani lewat dialog
      if (TMC.legalForSelected.filter(m => m.to.r === r && m.to.c === c).length > 1) {
        tmcShowPromotionChoice(chosen);
        return;
      }
      tmcSubmitMove(chosen);
      return;
    }
    if (piece && piece.color === TMC.turn && (!TMC.onlineRoomId || TMC.turn === TMC.onlineMyColor)) {
      tmcPlaySound('click');
      TMC.selected = { r, c };
      TMC.legalForSelected = tmcLegalMoves(TMC, r, c);
      tmcRenderBoard();
      return;
    }
    TMC.selected = null; TMC.legalForSelected = [];
    tmcRenderBoard();
    return;
  }

  if (piece && piece.color === TMC.turn && (!TMC.onlineRoomId || TMC.turn === TMC.onlineMyColor)) {
    tmcPlaySound('click');
    TMC.selected = { r, c };
    TMC.legalForSelected = tmcLegalMoves(TMC, r, c);
    tmcRenderBoard();
  }
}

// Titik tunggal setiap langkah pemain lokal dipicu dari sini.
// - Lokal (1 perangkat): langsung diterapkan seperti sebelumnya.
// - Online: TIDAK langsung diterapkan di client sendiri. Dikirim ke
//   Firestore dulu, papan baru berubah setelah listener room menerima
//   giliran ini kembali (dari server) — supaya kedua pemain selalu
//   melihat urutan langkah yang identik, tidak pernah "beda papan".
function tmcSubmitMove(move) {
  if (!TMC.onlineRoomId) {
    tmcPushSnapshot();
    tmcMakeMove(move);
    return;
  }
  if (TMC.turn !== TMC.onlineMyColor) return; // jaga-jaga, bukan giliran kita
  if (typeof tcoSendMove === 'function') tcoSendMove(move);
}

function tmcShowPromotionChoice(baseMove) {
  const modal = document.getElementById('tmcPromoModal');
  const wrap = document.getElementById('tmcPromoOptions');
  wrap.innerHTML = '';
  ['q', 'r', 'b', 'n'].forEach(pt => {
    const btn = document.createElement('button');
    btn.className = 'tmc-ctrl-btn';
    btn.style.width = '58px'; btn.style.height = '58px'; btn.style.justifyContent = 'center';
    btn.innerHTML = tmcPieceSvg(pt, TMC.turn);
    btn.onclick = () => {
      modal.classList.remove('active');
      tmcSubmitMove({ ...baseMove, promotion: pt });
    };
    wrap.appendChild(btn);
  });
  modal.classList.add('active');
}

function tmcRenderClocks() {
  const wc = document.getElementById('tmcClockW');
  const bc = document.getElementById('tmcClockB');
  if (!wc || !bc) return;
  const fmt = TMC.timeControl.init > 0 ? tmcFormatClock : (s => '∞');
  const wTime = wc.querySelector('.tmc-clock-time');
  const bTime = bc.querySelector('.tmc-clock-time');
  const wLbl = wc.querySelector('.tmc-clock-label');
  const bLbl = bc.querySelector('.tmc-clock-label');
  if (wTime) wTime.innerText = fmt(TMC.clocks.w);
  if (bTime) bTime.innerText = fmt(TMC.clocks.b);
  const wActive = TMC.turn === 'w' && TMC.clockRunning && !TMC.gameOver;
  const bActive = TMC.turn === 'b' && TMC.clockRunning && !TMC.gameOver;
  wc.classList.toggle('tmc-clock-active', wActive);
  bc.classList.toggle('tmc-clock-active', bActive);
  wc.classList.toggle('tmc-clock-low', TMC.timeControl.init > 0 && TMC.clocks.w <= 20 && !TMC.gameOver);
  bc.classList.toggle('tmc-clock-low', TMC.timeControl.init > 0 && TMC.clocks.b <= 20 && !TMC.gameOver);
  if (wLbl) wLbl.innerText = TMC.gameOver ? '' : (wActive ? 'GILIRAN' : 'MENUNGGU');
  if (bLbl) bLbl.innerText = TMC.gameOver ? '' : (bActive ? 'GILIRAN' : 'MENUNGGU');
}

function tmcRenderCaptured() {
  const mini = (arr, color) => arr.map(t => `<span class="tmc-cap-piece">${tmcPieceSvg(t, color)}</span>`).join('');
  const capW = document.getElementById('tmcCapturedW'); // bar bawah: bidak hitam yg ditangkap putih
  const capB = document.getElementById('tmcCapturedB'); // bar atas: bidak putih yg ditangkap hitam
  if (capW) capW.innerHTML = mini(TMC.captured.b, 'b');
  if (capB) capB.innerHTML = mini(TMC.captured.w, 'w');
  const dispB = document.getElementById('tmcCapturedDisplayB');
  const dispW = document.getElementById('tmcCapturedDisplayW');
  if (dispB) dispB.innerHTML = mini(TMC.captured.b, 'b');
  if (dispW) dispW.innerHTML = mini(TMC.captured.w, 'w');
}

function tmcRenderMoveList() {
  let html = '';
  const lastIdx = TMC.history.length - 1;
  for (let i = 0; i < TMC.history.length; i += 2) {
    const num = i / 2 + 1;
    const w = TMC.history[i], b = TMC.history[i + 1];
    const isCurrent = (i === lastIdx) || (i + 1 === lastIdx);
    html += `<div class="tmc-move-row${isCurrent ? ' tmc-move-current' : ''}"><span class="tmc-move-no">${num}</span><span>${w ? w.san : ''}</span><span>${b ? b.san : ''}</span></div>`;
  }
  html = html || '<div class="tmc-move-empty">Belum ada langkah</div>';
  const el = document.getElementById('tmcMoveList');
  const elMobile = document.getElementById('tmcMoveListMobile');
  if (el) { el.innerHTML = html; el.scrollTop = el.scrollHeight; }
  if (elMobile) { elMobile.innerHTML = html; elMobile.scrollTop = elMobile.scrollHeight; }
}

function tmcRenderPlayerBars() {
  const barW = document.getElementById('tmcBarW');
  const barB = document.getElementById('tmcBarB');
  if (barW) barW.classList.toggle('tmc-turn-active', TMC.turn === 'w' && !TMC.gameOver);
  if (barB) barB.classList.toggle('tmc-turn-active', TMC.turn === 'b' && !TMC.gameOver);
  const nameW = document.getElementById('tmcNameW');
  const nameB = document.getElementById('tmcNameB');
  if (nameW) nameW.innerText = TMC.players.w;
  if (nameB) nameB.innerText = TMC.players.b;
  const avW = document.getElementById('tmcAvatarW');
  const avB = document.getElementById('tmcAvatarB');
  if (avW) avW.innerText = (TMC.players.w || 'W').trim().charAt(0).toUpperCase();
  if (avB) avB.innerText = (TMC.players.b || 'B').trim().charAt(0).toUpperCase();
  const ratW = document.getElementById('tmcRatingW');
  const ratB = document.getElementById('tmcRatingB');
  if (ratW) {
    if (TMC.onlineRoomId && TMC.onlineRatingBefore.w != null) { ratW.style.display = ''; ratW.innerText = TMC.onlineRatingBefore.w + ' Rating'; }
    else ratW.style.display = 'none';
  }
  if (ratB) {
    if (TMC.onlineRoomId && TMC.onlineRatingBefore.b != null) { ratB.style.display = ''; ratB.innerText = TMC.onlineRatingBefore.b + ' Rating'; }
    else ratB.style.display = 'none';
  }
}

function tmcRenderStatus() {
  const el = document.getElementById('tmcStatusText');
  if (!el) return;
  if (TMC.gameOver) { el.innerText = ''; el.classList.remove('tmc-status-show'); return; }
  const inCheck = tmcIsInCheck(TMC.board, TMC.turn);
  if (TMC.drawOfferBy) {
    el.innerText = `${TMC.players[TMC.drawOfferBy]} menawarkan seri`;
    el.classList.add('tmc-status-show');
  } else if (inCheck) {
    el.innerText = `Skak — ${TMC.players[TMC.turn]} harus keluar dari skak`;
    el.classList.add('tmc-status-show');
  } else {
    el.innerText = '';
    el.classList.remove('tmc-status-show');
  }
}

function tmcRenderControls() {
  document.querySelectorAll('.tmc-undo-btn').forEach(btn => { btn.disabled = TMC.gameOver || TMC.history.length === 0 || !!TMC.onlineRoomId; });
}

function tmcTimeControlLabel() {
  const s = TMC.timeControl.init;
  if (!s) return 'Tanpa Batas';
  if (s <= 180) return 'Bullet/Blitz';
  if (s <= 600) return 'Blitz/Rapid';
  return 'Rapid';
}

// ---------------------------------------------------------------
// MODAL HASIL
// ---------------------------------------------------------------
const TMC_REASON_INFO = {
  checkmate: (w) => ({ eyebrow: 'SKAKMAT', title: `${TMC.players[w]} Menang!`, sub: 'Berhasil melakukan skakmat.' }),
  resign: (w) => ({ eyebrow: 'MENYERAH', title: `${TMC.players[w]} Menang!`, sub: `${TMC.players[tmcOpp(w)]} mengundurkan diri.` }),
  timeout: (w) => ({ eyebrow: 'WAKTU HABIS', title: `${TMC.players[w]} Menang!`, sub: `Waktu ${TMC.players[tmcOpp(w)]} telah habis.` }),
  stalemate: () => ({ eyebrow: 'SERI', title: 'Permainan Seri', sub: 'Stalemate — tidak ada langkah legal tersisa.' }),
  '50move': () => ({ eyebrow: 'SERI', title: 'Permainan Seri', sub: 'Aturan 50 langkah tanpa kemajuan.' }),
  material: () => ({ eyebrow: 'SERI', title: 'Permainan Seri', sub: 'Bidak tersisa tidak cukup untuk skakmat.' }),
  agreement: () => ({ eyebrow: 'SERI', title: 'Permainan Seri', sub: 'Disepakati oleh kedua pemain.' }),
};

const TMC_ICON_TROPHY = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M8 21h8m-4-4v4M6 4h12v3a6 6 0 01-6 6 6 6 0 01-6-6V4z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3"/></svg>';
const TMC_ICON_HANDSHAKE = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>';

function tmcShowResultModal() {
  const { winner, reason } = TMC.result;
  const info = TMC_REASON_INFO[reason](winner);
  document.getElementById('tmcResultEyebrow').innerText = info.eyebrow;
  document.getElementById('tmcResultTitle').innerText = info.title;
  document.getElementById('tmcResultSub').innerText = info.sub;
  const modal = document.getElementById('tmcResultModal');
  modal.classList.toggle('tmc-result-win', !!winner);
  modal.classList.toggle('tmc-result-draw', !winner);
  document.getElementById('tmcResultIcon').innerHTML = winner ? TMC_ICON_TROPHY : TMC_ICON_HANDSHAKE;
  modal.classList.add('active');
}

function tmcCloseResultModal() {
  document.getElementById('tmcResultModal').classList.remove('active');
}

function tmcRematch() {
  tmcCloseResultModal();
  const p = TMC.players;
  tmcStartGame(p.w, p.b, TMC.timeControl, TMC.soundOn);
}

function tmcBackToSetup() {
  tmcCloseResultModal();
  tmcStopClockTick();
  document.getElementById('tmcGameArea').classList.remove('active');
  document.getElementById('tmcSetupCard').style.display = 'block';
  TMC.started = false;
}

// ---------------------------------------------------------------
// SETUP / START
// ---------------------------------------------------------------
const TMC_TIME_PRESETS = {
  '1+0': [60, 0], '2+1': [120, 1], '3+0': [180, 0], '3+2': [180, 2],
  '5+0': [300, 0], '5+3': [300, 3], '10+0': [600, 0], '10+5': [600, 5],
  '15+10': [900, 10], 'unlimited': [0, 0]
};
let tmcSelectedTimePreset = '10+0';

function tmcSelectTimePreset(key, el) {
  tmcSelectedTimePreset = key;
  document.querySelectorAll('.tmc-time-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tmcCustomTimeRow').style.display = key === 'custom' ? 'flex' : 'none';
}

function tmcToggleSound(el) {
  TMC.soundOn = !TMC.soundOn;
  el.classList.toggle('on', TMC.soundOn);
  document.querySelectorAll('.tmc-sound-icon-btn').forEach(b => b.classList.toggle('tmc-muted', !TMC.soundOn));
  if (TMC.soundOn) tmcPlaySound('click');
}

function tmcSetVolume(val) {
  TMC.soundVolume = Math.max(0, Math.min(1, val / 100));
  document.querySelectorAll('.tmc-volume-value').forEach(el => { el.innerText = val + '%'; });
}

function tmcFlipBoard() {
  TMC.boardFlipped = !TMC.boardFlipped;
  tmcPlaySound('click');
  tmcRenderBoard();
}

const ICON_EXPAND = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V5a1 1 0 011-1h3m9 0h3a1 1 0 011 1v3m0 8v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3"/>';
const ICON_COLLAPSE = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4v3a1 1 0 01-1 1H5m10-4v3a1 1 0 001 1h3M5 15h3a1 1 0 011 1v3m6-4h3a1 1 0 011 1v3"/>';

function tmcToggleFullscreen() {
  const shell = document.getElementById('tmcShell');
  const btn = document.querySelector('.tmc-fullscreen-btn');
  const nowFullscreen = !shell.classList.contains('tmc-fullscreen-active');
  // Mekanisme UTAMA: kelas CSS, dijamin memenuhi layar di semua browser/WebView,
  // tidak bergantung Fullscreen API yang sering gagal diam-diam di in-app browser.
  shell.classList.toggle('tmc-fullscreen-active', nowFullscreen);
  document.body.classList.toggle('tmc-fullscreen-lock', nowFullscreen);
  if (btn) btn.querySelector('svg').innerHTML = nowFullscreen ? ICON_COLLAPSE : ICON_EXPAND;
  tmcPlaySound('click');
  // Bonus: coba juga Fullscreen API asli kalau browser mendukung (biar address
  // bar ikut hilang di browser yang support). Boleh gagal, sudah ada fallback CSS.
  try {
    if (nowFullscreen) {
      const req = shell.requestFullscreen || shell.webkitRequestFullscreen;
      if (req) req.call(shell).catch(() => {});
    } else if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) exit.call(document).catch(() => {});
    }
  } catch (e) { /* Fullscreen API tidak didukung — tidak masalah, CSS fallback tetap jalan */ }
}

document.addEventListener('fullscreenchange', () => {
  // kalau user keluar fullscreen lewat tombol back/gesture browser, sinkronkan kelas CSS-nya
  if (!document.fullscreenElement) {
    const shell = document.getElementById('tmcShell');
    const btn = document.querySelector('.tmc-fullscreen-btn');
    if (shell && shell.classList.contains('tmc-fullscreen-active')) {
      shell.classList.remove('tmc-fullscreen-active');
      document.body.classList.remove('tmc-fullscreen-lock');
      if (btn) btn.querySelector('svg').innerHTML = ICON_EXPAND;
    }
  }
});

function tmcSwitchTab(tab) {
  document.querySelectorAll('.tmc-tab-btn').forEach(b => b.classList.toggle('tmc-tab-active', b.dataset.tab === tab));
  document.querySelectorAll('.tmc-tab-panel').forEach(p => p.classList.toggle('tmc-tab-panel-active', p.dataset.tabPanel === tab));
}

function tmcToggleMoveSheet() {
  document.getElementById('tmcMoveSheet').classList.toggle('tmc-sheet-open');
}

function tmcResetGameKeepSetup() {
  TMC.board = tmcInitialBoard();
  TMC.turn = 'w';
  TMC.castling = { wK: true, wQ: true, bK: true, bQ: true };
  TMC.ep = null;
  TMC.halfmove = 0;
  TMC.fullmove = 1;
  TMC.history = [];
  TMC._snapshots = [];
  TMC.selected = null;
  TMC.legalForSelected = [];
  TMC.lastMove = null;
  TMC.gameOver = false;
  TMC.result = null;
  TMC.captured = { w: [], b: [] };
  TMC.drawOfferBy = null;
  TMC.boardFlipped = false;
  TMC.onlineRoomId = null;
  TMC.onlineMyColor = null;
  TMC.onlineUids = { w: null, b: null };
  TMC.onlineRatingBefore = { w: null, b: null };
}

function tmcStartGame(nameW, nameB, timeControl, soundOn) {
  tmcResetGameKeepSetup();
  TMC.players = { w: nameW || 'Pemain Putih', b: nameB || 'Pemain Hitam' };
  TMC.timeControl = timeControl;
  TMC.clocks = { w: timeControl.init, b: timeControl.init };
  TMC.theme = 'ivory';
  TMC.soundOn = soundOn;
  TMC.started = true;

  document.getElementById('tmcSetupCard').style.display = 'none';
  document.getElementById('tmcGameArea').classList.add('active');
  const metaEl = document.getElementById('tmcGameMeta');
  if (metaEl) metaEl.innerText = 'Permainan Lokal • ' + (timeControl.init ? (timeControl.init / 60) + '+' + timeControl.inc : 'Tanpa Batas') + ' • ' + tmcTimeControlLabel();
  tmcPlaySound('start');
  tmcRender();
  tmcStartClockTick();
}

function tmcHandleStartClick() {
  const nameW = document.getElementById('tmcNameWInput').value.trim() || 'Pemain Putih';
  const nameB = document.getElementById('tmcNameBInput').value.trim() || 'Pemain Hitam';
  let init, inc;
  if (tmcSelectedTimePreset === 'custom') {
    init = (parseInt(document.getElementById('tmcCustomMin').value, 10) || 0) * 60;
    inc = parseInt(document.getElementById('tmcCustomInc').value, 10) || 0;
  } else {
    [init, inc] = TMC_TIME_PRESETS[tmcSelectedTimePreset];
  }
  const soundOn = document.getElementById('tmcSoundSwitch').classList.contains('on');
  tmcStartGame(nameW, nameB, { init, inc }, soundOn);
}

// Undo yang aman: pakai snapshot stack
function tmcHandleUndo() {
  if (TMC.gameOver || TMC._snapshots.length === 0 || TMC.onlineRoomId) return;
  tmcRestoreSnapshot();
  tmcRender();
}

// Inisialisasi listener tombol saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
  // tombol undo memakai onclick inline di HTML (bisa lebih dari satu: desktop & mobile)
});
