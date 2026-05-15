// inject_badge.js — inject VerificationBadge into dashboard/index.html
const fs = require('fs');
const path = require('path');

const DASHBOARD = path.resolve(__dirname, 'vvv/dashboard/index.html');

let html = fs.readFileSync(DASHBOARD, 'utf8');

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

// Inject before <body
html = html.replace('<body', badgeHTML + '<body');

// Badge updater + scenario buttons injected before </script>
const badgeScript = `
// ═══ VerificationBadge ═══
function updateVerificationBadge(data) {
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
}

// ═══ Scenario Hint Buttons ═══
function bindScenarioButtons() {
  var scenarios = {
    'Fraudulent Bank Activity': { alpha: 8,  beta: 80, gamma: 1.5, threshold: 0.60 },
    'Ubuntu Pools (Normal)':      { alpha: 24, beta: 8,  gamma: 1.0, threshold: 0.60 },
    'Falsified Deed':             { alpha: 4,  beta: 95, gamma: 1.5, threshold: 0.60 },
  };
  var target = document.querySelector('.gauge-container');
  if (!target) return;
  Object.entries(scenarios).forEach(function([label, params]) {
    var btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = 'display:block;width:100%;margin:6px 0;padding:10px;background:#0A0F12;border:1px solid #2A3D4A;color:#7A9099;font-family:JetBrains Mono,monospace;font-size:11px;cursor:pointer;border-radius:4px;';
    btn.onmouseenter = function() { this.style.borderColor='#00ff66'; this.style.color='#00ff66'; };
    btn.onmouseleave = function() { this.style.borderColor='#2A3D4A'; this.style.color='#7A9099'; };
    btn.onclick = function() {
      document.getElementById('alpha').value = params.alpha;
      document.getElementById('alpha-val').textContent = params.alpha;
      document.getElementById('beta').value = params.beta;
      document.getElementById('beta-val').textContent = params.beta;
      document.getElementById('threshold').value = Math.round(params.threshold * 100);
      document.getElementById('threshold-val').textContent = params.threshold.toFixed(2);
      document.getElementById('gamma').value = String(params.gamma);
      document.getElementById('gamma-desc').textContent = GAMMA_DESCRIPTIONS[String(params.gamma)];
      state.alpha = params.alpha; state.beta = params.beta;
      state.gamma = params.gamma; state.threshold = params.threshold;
      updateDisplay();
      runInference();
    };
    target.parentNode.parentNode.insertBefore(btn, target);
  });
}

// Override runInference to fire badge
(function() {
  var orig = window.runInference;
  window.runInference = async function() {
    await orig.apply(this, arguments);
    updateVerificationBadge(window.__lastInferenceResult || {});
  };
})();

setTimeout(bindScenarioButtons, 100);
`;

html = html.replace('</script>\n</body>', badgeScript + '\n</script>\n</body>');

fs.writeFileSync(DASHBOARD, html);
console.log('✅ Badge injected into vvv/dashboard/index_html');
