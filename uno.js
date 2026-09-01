// ========================================================================
// UNO — engine murni JS, di-port dari UnoEngine.js (React) milik pengguna.
// Aturan & logic dipertahankan SAMA PERSIS, hanya disesuaikan agar berjalan
// tanpa React/build-tool (namespace UNOENGINE, gaya penamaan menyesuaikan
// konvensi chess.js). File berdiri sendiri, tidak menyentuh file lain.
// ========================================================================

const UNO_COLORS = ['red', 'yellow', 'green', 'blue'];
const UNO_COLOR_MAP = { red: '#ef4444', yellow: '#fbbf24', green: '#22c55e', blue: '#3b82f6' };
const UNO_CARD_TYPES = {
  NUMBER: 'number', SKIP: 'skip', REVERSE: 'reverse',
  DRAW_TWO: 'draw2', WILD: 'wild', WILD_DRAW_FOUR: 'wild4'
};

function unoCreateDeck() {
  const deck = [];
  for (const color of UNO_COLORS) {
    deck.push({ color, type: UNO_CARD_TYPES.NUMBER, value: 0, id: `n-${color}-0` });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, type: UNO_CARD_TYPES.NUMBER, value: i, id: `n-${color}-${i}-1` });
      deck.push({ color, type: UNO_CARD_TYPES.NUMBER, value: i, id: `n-${color}-${i}-2` });
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ color, type: UNO_CARD_TYPES.SKIP, value: 'skip', id: `s-${color}-${i}` });
      deck.push({ color, type: UNO_CARD_TYPES.REVERSE, value: 'reverse', id: `r-${color}-${i}` });
      deck.push({ color, type: UNO_CARD_TYPES.DRAW_TWO, value: 'draw2', id: `d2-${color}-${i}` });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'wild', type: UNO_CARD_TYPES.WILD, value: 'wild', id: `w-${i}` });
    deck.push({ color: 'wild', type: UNO_CARD_TYPES.WILD_DRAW_FOUR, value: 'wild4', id: `w4-${i}` });
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

function unoCanPlayCard(card, topCard, activeColor, drawStack) {
  if (drawStack > 0) {
    if (card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) return true;
    if (card.type === UNO_CARD_TYPES.DRAW_TWO && activeColor === card.color) return true;
    return false;
  }
  if (card.type === UNO_CARD_TYPES.WILD || card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) return true;
  if (card.color === activeColor) return true;
  if (card.type === UNO_CARD_TYPES.NUMBER && topCard.type === UNO_CARD_TYPES.NUMBER && card.value === topCard.value) return true;
  if (card.type !== UNO_CARD_TYPES.NUMBER && card.type === topCard.type) return true;
  return false;
}

class UnoEngine {
  constructor(playersConfig, difficulty = 'normal') {
    this.players = playersConfig.map((p, idx) => ({
      id: idx,
      name: p.name,
      isBot: p.isBot || false,
      hand: [],
      saidUno: false,
      needsUno: false,
      score: 0,
      avatar: p.avatar || p.name.charAt(0).toUpperCase()
    }));
    this.deck = unoCreateDeck();
    this.discard = [];
    this.currentPlayer = 0;
    this.direction = 1;
    this.activeColor = null;
    this.difficulty = difficulty;
    this.drawStack = 0;
    this.winner = null;
    this.gameOver = false;
    this.pendingColor = false;
    this.turnCount = 0;
    this.history = [];

    this.dealCards();
    this.setupFirstCard();
  }

  dealCards() {
    for (let i = 0; i < 7; i++) {
      for (const player of this.players) player.hand.push(this.deck.pop());
    }
  }

  setupFirstCard() {
    let first = this.deck.pop();
    while (first.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) {
      this.deck.push(first);
      this.deck = unoShuffle(this.deck);
      first = this.deck.pop();
    }
    this.discard.push(first);
    this.activeColor = first.color === 'wild' ? UNO_COLORS[Math.floor(Math.random() * 4)] : first.color;

    if (first.type === UNO_CARD_TYPES.SKIP) {
      this.nextTurn();
    } else if (first.type === UNO_CARD_TYPES.REVERSE) {
      this.direction = -1;
      if (this.players.length === 2) this.nextTurn();
    } else if (first.type === UNO_CARD_TYPES.DRAW_TWO) {
      this.drawStack = 2;
    } else if (first.type === UNO_CARD_TYPES.WILD) {
      this.activeColor = UNO_COLORS[Math.floor(Math.random() * 4)];
    }
  }

  get topCard() { return this.discard[this.discard.length - 1]; }

  canPlay(cardIndex, playerIdx) {
    if (this.gameOver) return false;
    if (playerIdx !== this.currentPlayer) return false;
    if (this.pendingColor) return false;
    const card = this.players[playerIdx].hand[cardIndex];
    return unoCanPlayCard(card, this.topCard, this.activeColor, this.drawStack);
  }

  playCard(playerIdx, cardIndex, chosenColor = null) {
    if (!this.canPlay(cardIndex, playerIdx)) return false;

    const player = this.players[playerIdx];
    const card = player.hand.splice(cardIndex, 1)[0];
    this.discard.push(card);
    player.saidUno = false;
    player.needsUno = false;

    this.history.push({ player: player.name, card: unoCardName(card), turn: this.turnCount });

    if (card.type === UNO_CARD_TYPES.WILD || card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) {
      this.activeColor = chosenColor || 'red';
      if (card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) this.drawStack += 4;
    } else {
      this.activeColor = card.color;
      if (card.type === UNO_CARD_TYPES.DRAW_TWO) {
        this.drawStack += 2;
      } else if (card.type === UNO_CARD_TYPES.SKIP) {
        this.nextTurn();
      } else if (card.type === UNO_CARD_TYPES.REVERSE) {
        this.direction *= -1;
        if (this.players.length === 2) this.nextTurn();
      }
    }

    if (player.hand.length === 0) {
      this.winner = player;
      this.gameOver = true;
      this.calculateScores();
      return true;
    }

    if (player.hand.length === 1) player.needsUno = true;

    this.nextTurn();
    return true;
  }

  drawCard(playerIdx) {
    if (this.gameOver) return null;
    if (playerIdx !== this.currentPlayer) return null;
    if (this.pendingColor) return null;

    const player = this.players[playerIdx];
    if (this.deck.length === 0) this.reshuffle();
    if (this.deck.length === 0) return null;

    const card = this.deck.pop();
    player.hand.push(card);
    player.saidUno = false;

    if (this.drawStack > 0) {
      this.drawStack--;
      if (this.drawStack === 0) this.nextTurn();
      return card;
    }

    if (unoCanPlayCard(card, this.topCard, this.activeColor, 0)) return card;

    this.nextTurn();
    return card;
  }

  reshuffle() {
    if (this.discard.length <= 1) return;
    const top = this.discard.pop();
    this.deck = unoShuffle(this.discard);
    this.discard = [top];
  }

  nextTurn() {
    this.turnCount++;
    if (this.drawStack > 0) {
      const nextIdx = this.getNextIndex();
      const nextPlayer = this.players[nextIdx];
      const canStack = nextPlayer.hand.some(c => c.type === UNO_CARD_TYPES.DRAW_TWO || c.type === UNO_CARD_TYPES.WILD_DRAW_FOUR);
      if (!canStack) {
        for (let i = 0; i < this.drawStack; i++) {
          if (this.deck.length === 0) this.reshuffle();
          if (this.deck.length > 0) nextPlayer.hand.push(this.deck.pop());
        }
        this.drawStack = 0;
        this.currentPlayer = this.getNextIndex(nextIdx);
        return;
      }
    }
    this.currentPlayer = this.getNextIndex();
  }

  getNextIndex(from = this.currentPlayer) {
    let idx = from + this.direction;
    if (idx < 0) idx = this.players.length - 1;
    if (idx >= this.players.length) idx = 0;
    return idx;
  }

  callUno(playerIdx) {
    const player = this.players[playerIdx];
    if (player.hand.length === 1) {
      player.saidUno = true;
      player.needsUno = false;
      return true;
    }
    return false;
  }

  checkUnoPenalty(playerIdx) {
    const player = this.players[playerIdx];
    if (player.hand.length === 1 && player.needsUno && !player.saidUno) {
      player.needsUno = false;
      for (let i = 0; i < 2; i++) {
        if (this.deck.length === 0) this.reshuffle();
        if (this.deck.length > 0) player.hand.push(this.deck.pop());
      }
      return true;
    }
    return false;
  }

  calculateScores() {
    let total = 0;
    for (const p of this.players) {
      if (p.id === this.winner.id) continue;
      for (const c of p.hand) {
        if (c.type === UNO_CARD_TYPES.NUMBER) total += c.value;
        else if (c.type === UNO_CARD_TYPES.DRAW_TWO || c.type === UNO_CARD_TYPES.REVERSE || c.type === UNO_CARD_TYPES.SKIP) total += 20;
        else total += 50;
      }
    }
    this.winner.score = total;
  }

  // ========== BOT AI ==========
  botChooseCard(botIdx) {
    const bot = this.players[botIdx];
    const playable = bot.hand
      .map((c, i) => ({ card: c, index: i }))
      .filter(({ card }) => unoCanPlayCard(card, this.topCard, this.activeColor, this.drawStack));

    if (playable.length === 0) return null;

    playable.sort((a, b) => this.cardPriority(b.card, bot.hand.length) - this.cardPriority(a.card, bot.hand.length));

    let choice;
    const rand = Math.random();
    if (this.difficulty === 'easy' && rand < 0.5) {
      choice = playable[Math.floor(Math.random() * playable.length)];
    } else if (this.difficulty === 'normal' && rand < 0.25) {
      choice = playable[Math.floor(Math.random() * playable.length)];
    } else {
      choice = playable[0];
    }

    let color = null;
    if (choice.card.type === UNO_CARD_TYPES.WILD || choice.card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) {
      color = this.chooseBestColor(bot.hand);
    }
    return { index: choice.index, color };
  }

  cardPriority(card, handSize) {
    if (card.type === UNO_CARD_TYPES.WILD_DRAW_FOUR) return handSize > 2 ? 10 : 3;
    if (card.type === UNO_CARD_TYPES.DRAW_TWO) return 8;
    if (card.type === UNO_CARD_TYPES.SKIP) return 7;
    if (card.type === UNO_CARD_TYPES.REVERSE) return 6;
    if (card.type === UNO_CARD_TYPES.WILD) return handSize > 3 ? 5 : 2;
    if (card.value === 0) return 1;
    return 4;
  }

  chooseBestColor(hand) {
    const counts = {};
    for (const c of hand) if (c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1;
    let best = UNO_COLORS[0], max = 0;
    for (const [color, count] of Object.entries(counts)) {
      if (count > max) { max = count; best = color; }
    }
    return best;
  }
}

// ========================================================================
// LAPISAN UI — state, render, interaksi. Engine di atas tidak disentuh.
// ========================================================================

const UNOGAME = {
  engine: null,
  mode: null,           // 'bot' | 'local'
  soundOn: true,
  pendingColor: false,
  pendingCardIndex: null,
  botTimer: null,
  unoPenaltyTimer: null,
  revealedPlayer: null, // mode lokal: index pemain yang tangannya sedang "dibuka" di layar
  started: false,
  toastTimer: null,
};

const UNO_ICON_SKIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';
const UNO_ICON_REVERSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>';
const UNO_ICON_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m0 0l-6-6m6 6l-6 6"/></svg>';
const UNO_ICON_HAND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12V6a1.5 1.5 0 013 0v5m0-4a1.5 1.5 0 013 0v4m0-2.5a1.5 1.5 0 013 0V13m-9 3.5V17a5 5 0 005 5h1a5 5 0 005-4.5l.5-4a2 2 0 00-1.8-2.4"/></svg>';

// ---------------------------------------------------------------
// SUARA (Web Audio API, sama pola dgn TM Chess — noise+nada berlapis)
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
function unoNoiseHit(ctx, t, { duration = 0.05, freq = 1800, q = 2, gain = 0.2 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = unoGetNoiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter); filter.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + duration + 0.02);
}
function unoTone(ctx, t, { freq = 440, duration = 0.12, gain = 0.14, wave = 'sine' } = {}) {
  const osc = ctx.createOscillator();
  osc.type = wave; osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + duration + 0.02);
}
function unoPlaySound(kind) {
  if (!UNOGAME.soundOn) return;
  try {
    if (!unoAudioCtx) unoAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = unoAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime;
    switch (kind) {
      case 'play': unoNoiseHit(ctx, t, { duration: 0.06, freq: 1600, gain: 0.22 }); unoTone(ctx, t, { freq: 500, duration: 0.09, gain: 0.08 }); break;
      case 'draw': unoNoiseHit(ctx, t, { duration: 0.08, freq: 900, q: 1.4, gain: 0.24 }); break;
      case 'uno': [700, 900, 1150].forEach((f, i) => unoTone(ctx, t + i * 0.11, { freq: f, duration: 0.16, gain: 0.14, wave: 'triangle' })); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => unoTone(ctx, t + i * 0.13, { freq: f, duration: 0.22, gain: 0.14, wave: 'triangle' })); break;
      case 'lose': [400, 350, 300, 250].forEach((f, i) => unoTone(ctx, t + i * 0.13, { freq: f, duration: 0.22, gain: 0.12 })); break;
      case 'error': unoTone(ctx, t, { freq: 180, duration: 0.16, gain: 0.12, wave: 'sawtooth' }); break;
      case 'penalty': unoTone(ctx, t, { freq: 150, duration: 0.24, gain: 0.14, wave: 'sawtooth' }); unoNoiseHit(ctx, t + 0.05, { duration: 0.1, freq: 500, gain: 0.12 }); break;
      case 'click': unoNoiseHit(ctx, t, { duration: 0.02, freq: 2400, q: 3, gain: 0.12 }); break;
      default: unoNoiseHit(ctx, t, { duration: 0.05, freq: 1600, gain: 0.18 });
    }
  } catch (e) { /* audio tidak tersedia, abaikan */ }
}

function unoToggleSound(el) {
  UNOGAME.soundOn = !UNOGAME.soundOn;
  el.classList.toggle('tmc-muted', !UNOGAME.soundOn);
  if (UNOGAME.soundOn) unoPlaySound('click');
}

function unoShowToast(msg) {
  const el = document.getElementById('unoToast');
  if (!el) return;
  el.innerText = msg;
  el.classList.add('show');
  if (UNOGAME.toastTimer) clearTimeout(UNOGAME.toastTimer);
  UNOGAME.toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------
let unoSelectedMode = 'bot';
let unoBotCount = 2;
let unoDifficulty = 'normal';
let unoLocalCount = 2;

function unoSelectMode(mode, el) {
  unoSelectedMode = mode;
  document.querySelectorAll('.uno-mode-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('unoBotOptions').style.display = mode === 'bot' ? 'block' : 'none';
  document.getElementById('unoLocalOptions').style.display = mode === 'local' ? 'block' : 'none';
  unoPlaySound('click');
}

function unoSelectBotCount(n, el) {
  unoBotCount = n;
  document.querySelectorAll('.uno-botcount-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}
function unoSelectDifficulty(d, el) {
  unoDifficulty = d;
  document.querySelectorAll('.uno-diff-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}
function unoSelectLocalCount(n, el) {
  unoLocalCount = n;
  document.querySelectorAll('.uno-localcount-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  unoRenderLocalNameInputs();
}

function unoRenderLocalNameInputs() {
  const wrap = document.getElementById('unoLocalNames');
  if (!wrap) return;
  let html = '';
  for (let i = 0; i < unoLocalCount; i++) {
    html += `<input type="text" class="uno-name-input uno-local-name-input" placeholder="Nama Pemain ${i + 1}" maxlength="14">`;
  }
  wrap.innerHTML = html;
}

function unoHandleStartClick() {
  let players;
  if (unoSelectedMode === 'bot') {
    const nameEl = document.getElementById('unoBotPlayerName');
    const name = (nameEl.value || '').trim() || 'Pemain';
    players = [{ name, isBot: false }];
    for (let i = 0; i < unoBotCount; i++) players.push({ name: `Bot ${i + 1}`, isBot: true });
  } else {
    const inputs = document.querySelectorAll('.uno-local-name-input');
    players = Array.from(inputs).map((inp, i) => ({ name: (inp.value || '').trim() || `Pemain ${i + 1}`, isBot: false }));
  }
  unoStartGame(players, unoDifficulty, unoSelectedMode);
}

function unoStartGame(players, difficulty, mode) {
  UNOGAME.engine = new UnoEngine(players, difficulty);
  UNOGAME.mode = mode;
  UNOGAME.started = true;
  UNOGAME.pendingColor = false;
  UNOGAME.pendingCardIndex = null;
  UNOGAME.revealedPlayer = mode === 'local' ? null : 0;

  document.getElementById('unoSetupCard').style.display = 'none';
  document.getElementById('unoGameArea').classList.add('active');
  unoPlaySound('play');
  unoRenderAll();
  unoMaybeStartBotTurn();
}

function unoBackToSetup() {
  if (UNOGAME.botTimer) clearTimeout(UNOGAME.botTimer);
  if (UNOGAME.unoPenaltyTimer) clearTimeout(UNOGAME.unoPenaltyTimer);
  document.getElementById('unoGameArea').classList.remove('active');
  document.getElementById('unoSetupCard').style.display = 'block';
  document.getElementById('unoResultModal').classList.remove('active');
  const shell = document.getElementById('unoShell');
  if (shell && shell.classList.contains('uno-fullscreen-active')) {
    shell.classList.remove('uno-fullscreen-active');
    document.body.classList.remove('uno-fullscreen-lock');
    try { if (document.fullscreenElement) (document.exitFullscreen || function(){}).call(document); } catch (e) {}
  }
  UNOGAME.started = false;
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    const shell = document.getElementById('unoShell');
    if (shell && shell.classList.contains('uno-fullscreen-active')) {
      shell.classList.remove('uno-fullscreen-active');
      document.body.classList.remove('uno-fullscreen-lock');
    }
  }
});

function unoRematch() {
  document.getElementById('unoResultModal').classList.remove('active');
  const players = UNOGAME.engine.players.map(p => ({ name: p.name, isBot: p.isBot }));
  unoStartGame(players, UNOGAME.engine.difficulty, UNOGAME.mode);
}

// ---------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------
function unoRenderAll() {
  const e = UNOGAME.engine;
  if (!e) return;
  unoRenderHeader();
  unoRenderOpponentSlots();
  unoRenderTable();
  unoRenderHandArea();
  unoRenderHistory();
  unoRenderControls();
}

function unoRenderHeader() {
  const e = UNOGAME.engine;
  const modeEl = document.getElementById('unoHeaderMode');
  if (modeEl) modeEl.innerText = UNOGAME.mode === 'local' ? 'Multiplayer Lokal' : 'Vs Bot';
  const roundEl = document.getElementById('unoHeaderRound');
  if (roundEl) roundEl.innerText = e.turnCount + 1;
  const dirRing = document.getElementById('unoDirRing');
  if (dirRing) dirRing.classList.toggle('rev', e.direction === -1);
}

// Susun lawan ke slot atas/kiri/kanan sekeliling meja, tergantung berapa jumlahnya
function unoAssignOppSlots(opponents) {
  const slots = { top: null, left: null, right: null };
  if (opponents.length === 1) slots.top = opponents[0];
  else if (opponents.length === 2) { slots.left = opponents[0]; slots.right = opponents[1]; }
  else if (opponents.length >= 3) { slots.left = opponents[0]; slots.top = opponents[1]; slots.right = opponents[2]; }
  return slots;
}

function unoRenderOppFan(opp, vertical) {
  const n = Math.min(opp.hand.length, 6);
  let backs = '';
  for (let i = 0; i < n; i++) {
    const offset = (i - (n - 1) / 2) * (vertical ? 14 : 12);
    const rot = (i - (n - 1) / 2) * (vertical ? 5 : 8);
    const posProp = vertical ? `top:${50 + offset}%; left:50%; transform:translate(-50%,-50%) rotate(${rot}deg);`
                              : `left:${50 + offset}%; top:0; transform:translateX(-50%) rotate(${rot}deg);`;
    backs += `<div class="uno-opp-backcard" style="${posProp}"></div>`;
  }
  return backs;
}

function unoRenderOpponentSlots() {
  const e = UNOGAME.engine;
  const activeHandIdx = UNOGAME.mode === 'local' ? e.currentPlayer : 0;
  const opponents = e.players.filter((_, i) => i !== activeHandIdx);
  const slots = unoAssignOppSlots(opponents);

  const build = (opp, vertical) => {
    if (!opp) return '';
    const active = opp.id === e.currentPlayer;
    return `
      <div class="uno-opp-avatar-ring">${opp.avatar}</div>
      <div class="uno-opp-name">${opp.name}</div>
      <div class="uno-opp-count-chip">${opp.hand.length} Kartu${opp.hand.length === 1 && opp.saidUno ? ' · UNO' : ''}</div>
      <div class="uno-opp-fan ${vertical ? 'vertical' : ''}">${unoRenderOppFan(opp, vertical)}</div>
    `;
  };

  const topEl = document.getElementById('unoSlotTop');
  const leftEl = document.getElementById('unoSlotLeft');
  const rightEl = document.getElementById('unoSlotRight');
  if (topEl) { topEl.innerHTML = build(slots.top, false); topEl.classList.toggle('active', !!slots.top && slots.top.id === e.currentPlayer); topEl.style.display = slots.top ? 'flex' : 'none'; }
  if (leftEl) { leftEl.innerHTML = build(slots.left, true); leftEl.classList.toggle('active', !!slots.left && slots.left.id === e.currentPlayer); leftEl.style.display = slots.left ? 'flex' : 'none'; }
  if (rightEl) { rightEl.innerHTML = build(slots.right, true); rightEl.classList.toggle('active', !!slots.right && slots.right.id === e.currentPlayer); rightEl.style.display = slots.right ? 'flex' : 'none'; }
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

function unoRenderCardEl(card, { size = 'md', disabled = false, onClick = null, style = '' } = {}) {
  const div = document.createElement('div');
  div.className = `uno-card uno-card-${size} ${unoCardColorClass(card)} ${disabled ? 'disabled' : ''}`;
  if (style) div.style.cssText = style;
  div.innerHTML = `<div class="uno-card-inner">${unoCardSymbolHtml(card)}</div>`;
  if (onClick && !disabled) div.addEventListener('click', onClick);
  return div;
}

function unoRenderTable() {
  const e = UNOGAME.engine;
  const wrap = document.getElementById('unoTableTop');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.appendChild(unoRenderCardEl(e.topCard, { size: 'lg' }));

  const stackBadge = document.getElementById('unoDrawStackBadge');
  if (stackBadge) {
    stackBadge.style.display = e.drawStack > 0 ? 'grid' : 'none';
    stackBadge.innerText = '+' + e.drawStack;
  }
  const deckCount = document.getElementById('unoDeckCount');
  if (deckCount) deckCount.innerText = e.deck.length;
}

function unoRenderHandArea() {
  const e = UNOGAME.engine;
  const activeIdx = UNOGAME.mode === 'local' ? e.currentPlayer : 0;
  const player = e.players[activeIdx];
  const isPlayerTurn = e.currentPlayer === activeIdx;

  // Mode lokal: kalau giliran pindah ke pemain manusia lain yang belum "reveal", tampilkan overlay geser-HP
  const passOverlay = document.getElementById('unoPassOverlay');
  const needsPass = UNOGAME.mode === 'local' && !player.isBot && UNOGAME.revealedPlayer !== activeIdx;
  if (passOverlay) {
    passOverlay.classList.toggle('active', needsPass && !e.gameOver);
    if (needsPass) {
      document.getElementById('unoPassTitle').innerText = `Giliran ${player.name}`;
      document.getElementById('unoPassSub').innerText = 'Geser HP ke pemain ini, lalu tekan tombol di bawah untuk membuka kartumu.';
    }
  }

  const avatarEl = document.getElementById('unoHandAvatar');
  const nameEl = document.getElementById('unoHandName');
  const countEl = document.getElementById('unoHandCount');
  const statusEl = document.getElementById('unoTurnStatus');
  if (avatarEl) avatarEl.innerText = player.avatar;
  if (nameEl) nameEl.innerText = player.name;
  if (countEl) countEl.innerText = player.hand.length + ' Kartu';
  if (statusEl) {
    statusEl.innerText = isPlayerTurn ? 'Giliran Kamu' : `Menunggu ${e.players[e.currentPlayer].name}`;
    statusEl.classList.toggle('waiting', !isPlayerTurn);
  }

  const unoBtn = document.getElementById('unoCallBtn');
  if (unoBtn) unoBtn.style.display = (player.hand.length === 2 && isPlayerTurn && !player.saidUno) ? 'inline-flex' : 'none';

  const handWrap = document.getElementById('unoHandScroll');
  if (handWrap) {
    handWrap.innerHTML = '';
    if (player.hand.length === 0) {
      handWrap.innerHTML = '<div class="uno-hand-empty">Tidak ada kartu</div>';
    } else if (!needsPass || player.isBot) {
      const n = player.hand.length;
      const stepDeg = n > 10 ? 3 : n > 6 ? 5 : 7;
      player.hand.forEach((card, i) => {
        const canPlay = e.canPlay(i, activeIdx);
        const centerOffset = i - (n - 1) / 2;
        const rot = centerOffset * stepDeg;
        const lift = Math.abs(centerOffset) * 2.2;
        const cardEl = unoRenderCardEl(card, {
          size: 'md',
          disabled: !canPlay || !isPlayerTurn,
          onClick: () => unoHandleCardClick(activeIdx, i),
          style: `transform: rotate(${rot}deg) translateY(${lift}px); z-index:${i};`
        });
        handWrap.appendChild(cardEl);
      });
    }
  }
}

function unoRenderHistory() {
  const e = UNOGAME.engine;
  const list = document.getElementById('unoHistoryList');
  if (!list) return;
  const recent = e.history.slice(-12).reverse();
  if (recent.length === 0) {
    list.innerHTML = '<div class="uno-hist-empty">Belum ada langkah</div>';
    return;
  }
  list.innerHTML = recent.map(h => `
    <div class="uno-hist-row">
      <div class="uno-hist-avatar">${h.player.charAt(0).toUpperCase()}</div>
      <div class="uno-hist-main">
        <div class="uno-hist-name">${h.player}</div>
        <div class="uno-hist-action">Memainkan ${h.card}</div>
      </div>
    </div>
  `).join('');
}

function unoRenderControls() {
  const e = UNOGAME.engine;
  const drawBtn = document.getElementById('unoDrawPileBtn');
  if (drawBtn) {
    const activeIdx = UNOGAME.mode === 'local' ? e.currentPlayer : 0;
    drawBtn.disabled = e.currentPlayer !== activeIdx || e.gameOver;
  }
}

function unoRevealHand() {
  UNOGAME.revealedPlayer = UNOGAME.engine.currentPlayer;
  unoPlaySound('click');
  unoRenderHandArea();
}

function unoToggleFullscreen() {
  const shell = document.getElementById('unoShell');
  const btn = document.querySelector('.uno-fullscreen-btn');
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
// INTERAKSI PEMAIN
// ---------------------------------------------------------------
function unoHandleCardClick(playerIdx, cardIndex) {
  const e = UNOGAME.engine;
  if (!e || e.gameOver) return;
  if (e.currentPlayer !== playerIdx) return;
  const card = e.players[playerIdx].hand[cardIndex];
  if (!e.canPlay(cardIndex, playerIdx)) {
    unoPlaySound('error');
    unoShowToast('Kartu tidak valid!');
    return;
  }
  if (card.type === 'wild' || card.type === 'wild4') {
    UNOGAME.pendingCardIndex = cardIndex;
    UNOGAME.pendingColor = true;
    document.getElementById('unoColorPicker').classList.add('active');
    return;
  }
  unoPlayCard(playerIdx, cardIndex);
}

function unoPlayCard(playerIdx, cardIndex, chosenColor = null) {
  const e = UNOGAME.engine;
  const success = e.playCard(playerIdx, cardIndex, chosenColor);
  if (!success) return false;
  unoPlaySound('play');

  if (e.gameOver) {
    unoOnGameOver();
    return true;
  }

  // Mode lokal: begitu giliran pindah ke pemain manusia lain, tutup lagi tangannya (perlu reveal ulang)
  if (UNOGAME.mode === 'local' && e.currentPlayer !== playerIdx) {
    UNOGAME.revealedPlayer = e.players[e.currentPlayer].isBot ? UNOGAME.revealedPlayer : null;
  }

  unoRenderAll();
  unoMaybeStartBotTurn();
  return true;
}

function unoHandleColorPick(color) {
  document.getElementById('unoColorPicker').classList.remove('active');
  UNOGAME.pendingColor = false;
  if (UNOGAME.pendingCardIndex !== null && UNOGAME.engine) {
    const activeIdx = UNOGAME.mode === 'local' ? UNOGAME.engine.currentPlayer : 0;
    unoPlayCard(activeIdx, UNOGAME.pendingCardIndex, color);
    UNOGAME.pendingCardIndex = null;
  }
}

function unoHandleDrawClick() {
  const e = UNOGAME.engine;
  if (!e || e.gameOver || UNOGAME.pendingColor) return;
  const activeIdx = UNOGAME.mode === 'local' ? e.currentPlayer : 0;
  if (e.currentPlayer !== activeIdx) return;
  const beforePlayer = e.currentPlayer;
  const card = e.drawCard(activeIdx);
  if (!card) return;
  unoPlaySound('draw');
  unoShowToast(`Ambil: ${unoCardName(card)}`);

  if (UNOGAME.mode === 'local' && e.currentPlayer !== beforePlayer) {
    UNOGAME.revealedPlayer = e.players[e.currentPlayer].isBot ? UNOGAME.revealedPlayer : null;
  }

  unoRenderAll();
  unoMaybeStartBotTurn();
}

function unoHandleCallUno() {
  const e = UNOGAME.engine;
  if (!e) return;
  const activeIdx = UNOGAME.mode === 'local' ? e.currentPlayer : 0;
  const success = e.callUno(activeIdx);
  if (success) {
    unoPlaySound('uno');
    unoShowToast('UNO!');
    unoRenderAll();
  }
}

// Penalti UNO otomatis (lupa panggil UNO saat tinggal 1 kartu) — dicek 3 detik setelah giliran manusia
function unoScheduleUnoPenaltyCheck() {
  if (UNOGAME.unoPenaltyTimer) clearTimeout(UNOGAME.unoPenaltyTimer);
  const e = UNOGAME.engine;
  if (!e || e.gameOver) return;
  const activeIdx = UNOGAME.mode === 'local' ? e.currentPlayer : 0;
  const p = e.players[activeIdx];
  if (p.hand.length === 1 && p.needsUno) {
    UNOGAME.unoPenaltyTimer = setTimeout(() => {
      const penalized = e.checkUnoPenalty(activeIdx);
      if (penalized) {
        unoPlaySound('penalty');
        unoShowToast(`${p.name} lupa UNO! +2 kartu penalty`);
        unoRenderAll();
      }
    }, 3000);
  }
}

// ---------------------------------------------------------------
// BOT LOOP
// ---------------------------------------------------------------
function unoMaybeStartBotTurn() {
  unoScheduleUnoPenaltyCheck();
  const e = UNOGAME.engine;
  if (!e || e.gameOver) return;
  const cp = e.players[e.currentPlayer];
  if (!cp.isBot) return;

  if (UNOGAME.botTimer) clearTimeout(UNOGAME.botTimer);
  UNOGAME.botTimer = setTimeout(() => {
    if (!UNOGAME.engine || UNOGAME.engine.gameOver) return;
    const eng = UNOGAME.engine;
    const botIdx = eng.currentPlayer;
    const bot = eng.players[botIdx];
    const choice = eng.botChooseCard(botIdx);

    if (choice) {
      eng.playCard(botIdx, choice.index, choice.color);
      unoPlaySound('play');
      if (bot.hand.length === 1) {
        eng.callUno(botIdx);
        unoShowToast(`${bot.name}: UNO!`);
      }
    } else {
      const card = eng.drawCard(botIdx);
      if (card) {
        unoPlaySound('draw');
        // Kalau setelah draw kartu itu bisa langsung dimainkan, bot mainkan
        if (eng.currentPlayer === botIdx) {
          const afterChoice = eng.botChooseCard(botIdx);
          if (afterChoice) {
            unoRenderAll();
            UNOGAME.botTimer = setTimeout(() => {
              if (!UNOGAME.engine || UNOGAME.engine.gameOver) return;
              eng.playCard(botIdx, afterChoice.index, afterChoice.color);
              unoPlaySound('play');
              unoRenderAll();
              if (eng.gameOver) { unoOnGameOver(); } else { unoMaybeStartBotTurn(); }
            }, 550);
            return;
          }
        }
      }
    }

    unoRenderAll();
    if (eng.gameOver) {
      unoOnGameOver();
    } else {
      unoMaybeStartBotTurn();
    }
  }, 1100);
}

// ---------------------------------------------------------------
// AKHIR PERMAINAN
// ---------------------------------------------------------------
function unoOnGameOver() {
  const e = UNOGAME.engine;
  const humanWon = !e.winner.isBot && (UNOGAME.mode === 'bot' ? e.winner.id === 0 : true);
  unoPlaySound(e.winner.isBot ? 'lose' : 'win');
  unoRenderAll();

  const icon = document.getElementById('unoResultIcon');
  const title = document.getElementById('unoResultTitle');
  const sub = document.getElementById('unoResultSub');
  const won = !e.winner.isBot;
  icon.className = 'uno-result-icon ' + (won ? 'win' : 'lose');
  icon.innerHTML = won
    ? '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M8 21h8m-4-4v4M6 4h12v3a6 6 0 01-6 6 6 6 0 01-6-6V4z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3"/></svg>'
    : '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M9 9l6 6m0-6l-6 6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  title.innerText = `${e.winner.name} Menang!`;
  sub.innerText = e.winner.score ? `Skor babak ini: ${e.winner.score}` : 'Permainan selesai.';
  document.getElementById('unoResultModal').classList.add('active');
}
