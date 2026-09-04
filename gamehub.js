// ========================================================================
// GAMEHUB.JS — Render Leaderboard (Chess & UNO, terpisah) + Statistik Game
// Memakai fungsi dari gamedata.js (gdGetChessLeaderboard, gdGetUnoLeaderboard,
// gdGetMyGameStats). File ini HANYA membaca data, tidak pernah menulis
// rating/poin siapapun.
// ========================================================================

let ghActiveTab = 'chess'; // 'chess' | 'uno' | 'stats'

function ghSwitchTab(tab) {
  ghActiveTab = tab;
  document.querySelectorAll('.gh-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.gh-panel-section').forEach(el => {
    el.style.display = el.dataset.section === tab ? '' : 'none';
  });
  if (tab === 'chess') ghRenderChessLeaderboard();
  if (tab === 'uno') ghRenderUnoLeaderboard();
  if (tab === 'stats') ghRenderMyStats();
}

function ghRankClass(i) {
  if (i === 0) return 'gh-rank gh-rank-1';
  if (i === 1) return 'gh-rank gh-rank-2';
  if (i === 2) return 'gh-rank gh-rank-3';
  return 'gh-rank';
}

// escape sederhana — nama akun berasal dari data user, tetap dijaga
// supaya tidak ada celah tampilan HTML aneh di leaderboard.
function ghEsc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function ghRenderChessLeaderboard() {
  const box = document.getElementById('ghChessLeaderboardBody');
  if (!box) return;
  box.innerHTML = '<tr><td colspan="6" class="gh-empty">Memuat leaderboard...</td></tr>';
  try {
    const rows = await gdGetChessLeaderboard();
    if (rows.length === 0) {
      box.innerHTML = '<tr><td colspan="6" class="gh-empty">Belum ada pertandingan Chess yang tercatat.</td></tr>';
      return;
    }
    const myUid = AUTH.user ? AUTH.user.uid : null;
    box.innerHTML = rows.map((r, i) => `
      <tr class="${r.uid === myUid ? 'gh-me' : ''}">
        <td class="${ghRankClass(i)}">#${i + 1}</td>
        <td class="gh-name">${ghEsc(r.name)}${r.uid === myUid ? '<span class="gh-you-badge">KAMU</span>' : ''}</td>
        <td class="gh-num">${r.rating}</td>
        <td class="gh-num">${r.wins}</td>
        <td class="gh-num">${r.draws}</td>
        <td class="gh-num">${r.losses}</td>
      </tr>`).join('');
  } catch (err) {
    console.error('Gagal memuat leaderboard chess:', err);
    box.innerHTML = '<tr><td colspan="6" class="gh-empty">Gagal memuat leaderboard. Coba lagi.</td></tr>';
  }
}

async function ghRenderUnoLeaderboard() {
  const box = document.getElementById('ghUnoLeaderboardBody');
  if (!box) return;
  box.innerHTML = '<tr><td colspan="5" class="gh-empty">Memuat leaderboard...</td></tr>';
  try {
    const rows = await gdGetUnoLeaderboard();
    if (rows.length === 0) {
      box.innerHTML = '<tr><td colspan="5" class="gh-empty">Belum ada pertandingan UNO yang tercatat.</td></tr>';
      return;
    }
    const myUid = AUTH.user ? AUTH.user.uid : null;
    box.innerHTML = rows.map((r, i) => `
      <tr class="${r.uid === myUid ? 'gh-me' : ''}">
        <td class="${ghRankClass(i)}">#${i + 1}</td>
        <td class="gh-name">${ghEsc(r.name)}${r.uid === myUid ? '<span class="gh-you-badge">KAMU</span>' : ''}</td>
        <td class="gh-num">${r.points}</td>
        <td class="gh-num">${r.games}</td>
        <td class="gh-num">${r.podium}</td>
      </tr>`).join('');
  } catch (err) {
    console.error('Gagal memuat leaderboard uno:', err);
    box.innerHTML = '<tr><td colspan="5" class="gh-empty">Gagal memuat leaderboard. Coba lagi.</td></tr>';
  }
}

async function ghRenderMyStats() {
  const box = document.getElementById('ghMyStatsBody');
  if (!box) return;
  if (!AUTH.user) {
    box.innerHTML = '<div class="gh-login-notice">Masuk (login) dulu untuk melihat statistik game kamu.</div>';
    return;
  }
  box.innerHTML = '<div class="gh-login-notice">Memuat statistik...</div>';
  try {
    const stats = await gdGetMyGameStats();
    box.innerHTML = `
      <div class="gh-stats-grid">
        <div class="gh-stat-card">
          <h4>Chess</h4>
          <div class="gh-stat-row"><span>Rating</span><b>${stats.chess.rating}</b></div>
          <div class="gh-stat-row"><span>Games</span><b>${stats.chess.games}</b></div>
          <div class="gh-stat-row"><span>Wins</span><b>${stats.chess.wins}</b></div>
          <div class="gh-stat-row"><span>Draws</span><b>${stats.chess.draws}</b></div>
          <div class="gh-stat-row"><span>Losses</span><b>${stats.chess.losses}</b></div>
        </div>
        <div class="gh-stat-card">
          <h4>UNO</h4>
          <div class="gh-stat-row"><span>Points</span><b>${stats.uno.points}</b></div>
          <div class="gh-stat-row"><span>Games</span><b>${stats.uno.games}</b></div>
          <div class="gh-stat-row"><span>Wins</span><b>${stats.uno.wins}</b></div>
          <div class="gh-stat-row"><span>Podium</span><b>${stats.uno.podium}</b></div>
        </div>
      </div>`;
  } catch (err) {
    console.error('Gagal memuat statistik game:', err);
    box.innerHTML = '<div class="gh-login-notice">Gagal memuat statistik. Coba lagi.</div>';
  }
}

// Dipanggil dari navigateTo() (script.js) saat halaman 'gamehub' dibuka.
function ghOnPageOpen() {
  ghSwitchTab(ghActiveTab);
}
