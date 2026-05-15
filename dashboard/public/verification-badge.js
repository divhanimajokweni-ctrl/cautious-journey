// verification-badge.js — ProofBridge Liner verification badge updater
// Injected into dashboard/public/index.html and externalized as standalone script.
window.updateVerificationBadge = function (data) {
  var badge = document.getElementById('verification-badge');
  if (!badge) return;
  var isTripped = (data.verdict || '').toUpperCase() === 'TRIP';
  badge.style.display = 'block';
  badge.style.backgroundColor = isTripped ? '#2a0808' : '#082a14';
  badge.style.border = '2px solid ' + (isTripped ? '#ff3333' : '#00ff66');
  badge.style.color = isTripped ? '#ff8888' : '#88ff88';
  badge.querySelector('h4').textContent = isTripped
    ? '\u{1F6A8} CIRCUIT BREAKER TRIPPED'
    : '\u{1F6E1} VERIFIED SOVEREIGN TRUTH';
  var scoreEl = document.getElementById('badge-score');
  if (scoreEl) {
    scoreEl.textContent = (data.safety_margin != null)
      ? (data.safety_margin >= 0 ? '+' + data.safety_margin.toFixed(4) : data.safety_margin.toFixed(4))
      : '—';
  }
};
