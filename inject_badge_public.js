// inject_badge_public.js — inject VerificationBadge into dashboard/public/index.html
const fs = require('fs');
const path = require('path');

const DASHBOARD = path.resolve(__dirname, 'dashboard/public/index.html');

let html = fs.readFileSync(DASHBOARD, 'utf8');

// Find the </main> tag and inject before it
const badgeHTML = `
    <!-- ═══ VERIFICATION BADGE ═══ -->
    <div id="verification-badge"
         style="display:none;position:fixed;top:20px;right:20px;z-index:9999;
                padding:12px 16px;background-color:#082a14;border:2px solid #00ff66;
                font-family:'JetBrains Mono',monospace;color:#88ff88;border-radius:4px;
                max-width:340px;box-shadow:0 0 20px rgba(0,255,102,0.15);">
      <h4 style="margin:0 0 4px 0;font-size:14px;color:#00ff66;">🛡️ VERIFIED SOVEREIGN TRUTH</h4>
      <p style="margin:0;font-size:11px;color:#aaa;">SYSTEM RISK SCORE: <span id="badge-score">—</span></p>
      <p style="margin:0;font-size:11px;color:#aaa;">PROOF TRACE: Deterministic replay — 100% match</p>
    </div>
`;

html = html.replace('</main>', badgeHTML + '</main>');

const badgeScript = `
// ═══ VerificationBadge updater ═══
window.updateVerificationBadge = function(data) {
  var badge = document.getElementById('verification-badge');
  if (!badge) return;
  var isTripped = (data.verdict || '').toUpperCase() === 'TRIP';
  badge.style.display = 'block';
  badge.style.backgroundColor = isTripped ? '#2a0808' : '#082a14';
  badge.style.border = '2px solid ' + (isTripped ? '#ff3333' : '#00ff66');
  badge.style.color = isTripped ? '#ff8888' : '#88ff88';
  badge.querySelector('h4').textContent = isTripped
    ? '🚨 CIRCUIT BREAKER TRIPPED'
    : '🛡️ VERIFIED SOVEREIGN TRUTH';
  var scoreEl = document.getElementById('badge-score');
  if (scoreEl) {
    scoreEl.textContent = (data.safety_margin != null)
      ? (data.safety_margin >= 0 ? '+' + data.safety_margin.toFixed(4) : data.safety_margin.toFixed(4))
      : '—';
  }
};
`;

html = html.replace('</script>', badgeScript + '\n</script>');

fs.writeFileSync(DASHBOARD, html);
console.log('✅ Badge injected into dashboard/public/index.html');
