// inject_badge_v2.js — inject VerificationBadge script into vvv/dashboard/index.html
const fs = require('fs');
const path = require('path');

const DASHBOARD = path.resolve(__dirname, 'vvv/dashboard/index.html');
let html = fs.readFileSync(DASHBOARD, 'utf8');

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
  var gauge = document.getElementById('belief-arc');
  if (!gauge) return;
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
      if (GAMMA_DESCRIPTIONS) document.getElementById('gamma-desc').textContent = GAMMA_DESCRIPTIONS[String(params.gamma)];
      state.alpha = params.alpha; state.beta = params.beta;
      state.gamma = params.gamma; state.threshold = params.threshold;
      updateDisplay(); runInference();
    };
    gauge.parentElement.parentNode.parentNode.insertBefore(btn, gauge.parentElement.parentNode);
  });
}

// Hook badge update into runInference
(function() {
  var orig = window.runInference;
  window.runInference = function() {
    var p = Promise.resolve(orig.apply(this, arguments));
    if (orig.constructor.name === 'AsyncFunction') return p;
    return p;
  };
  // Use a monkey-patched Observer to detect when the audit log gets populated
  var origUpdate = window.updateDisplay;
  window.updateDisplay = function() {
    origUpdate();
    var log = document.getElementById('audit-log');
    if (log && !log.classList.contains('hidden') && log.textContent !== 'Ready for audit trail...') {
      try {
        var data = JSON.parse(log.textContent);
        updateVerificationBadge(data);
      } catch(e) {}
    }
  };
})();

setTimeout(bindScenarioButtons, 100);
`;

// Inject before </script>
html = html.replace('</script>', badgeScript + '\n</script>');

fs.writeFileSync(DASHBOARD, html);
console.log('✅ Script injected into vvv/dashboard/index.html');
