(function () {
  const $ = (sel) => document.querySelector(sel);

  function shorten(addr) {
    if (!addr) return '—';
    return addr.length > 14 ? addr.slice(0, 8) + '…' + addr.slice(-6) : addr;
  }

  function fmtUptime(seconds) {
    if (!seconds && seconds !== 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function renderPhases(phases) {
    const root = $('#phases');
    root.innerHTML = '';
    phases.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'phase';
      row.innerHTML = `
        <div class="num">${String(p.id).padStart(2,'0')}</div>
        <div>
          <div class="lbl">${p.name}<small class="mono">PHASE-${p.id}</small></div>
          <div class="bar"><span style="width:${p.pct}%"></span></div>
        </div>
        <div class="pct">${p.pct}%</div>`;
      root.appendChild(row);
    });
  }

  function renderTests(tests) {
    $('#testsPassed').textContent = tests.passed;
    $('#testsTotal').textContent = tests.total;
    const root = $('#tests');
    root.innerHTML = '';
    tests.results.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'test';
      row.innerHTML = `
        <span class="dot"></span>
        <span class="mono">${t.name}</span>
        <span class="gas">${t.gas.toLocaleString()} gas</span>`;
      root.appendChild(row);
    });
  }

  function renderArchitecture(architecture) {
    if (!architecture) return;

    const layerRoot = $('#archLayers');
    layerRoot.innerHTML = '';
    architecture.layers.forEach((layer) => {
      const div = document.createElement('div');
      div.className = 'arch-layer';
      const statusClass = layer.status === 'proven' ? 'ok'
        : layer.status === 'deployed-pending' ? 'warn' : 'muted';
      const theoremHtml = layer.theorems
        ? `<div class="theorems">${layer.theorems.map(t =>
            `<span class="theorem">${t}</span>`).join('')}</div>`
        : '';
      div.innerHTML = `
        <div class="arch-layer-header">
          <span class="arch-layer-name">${layer.name}</span>
          <span class="tag ${statusClass}">${layer.status}</span>
        </div>
        <p class="hint" style="margin:4px 0 6px">${layer.description}</p>
        <span class="mono dim" style="font-size:0.72rem">${layer.artifact}</span>
        ${theoremHtml}`;
      layerRoot.appendChild(div);
    });

    const verRoot = $('#verificationArtifacts');
    verRoot.innerHTML = '';
    architecture.verification.forEach((v) => {
      const div = document.createElement('div');
      div.className = 'ver-item';
      const statusClass = v.status === 'complete' ? 'ok' : 'muted';
      div.innerHTML = `
        <div class="ver-header">
          <span class="ver-name">${v.name}</span>
          <span class="tag ${statusClass}">${v.status}</span>
        </div>
        <p class="hint" style="margin:3px 0 0">${v.note}</p>`;
      verRoot.appendChild(div);
    });
  }

  function renderAssets(assets, proverState) {
    const map = new Map();
    if (proverState && Array.isArray(proverState.results)) {
      for (const r of proverState.results) map.set(r.assetId, r);
    }
    const tbody = $('#assets');
    tbody.innerHTML = '';
    if (!assets.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="hint mono" style="padding:16px 10px">No assets configured.</td></tr>';
      return;
    }
    assets.forEach((a) => {
      const r = map.get(a.assetId);
      const status = r ? r.status : 'unknown';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.label || '—'}<br><span class="mono dim" style="font-size:0.7rem">${shorten(a.assetId)}</span></td>
        <td class="mono">${shorten(a.ipfsCid)}</td>
        <td class="mono">${shorten(a.expectedHash)}</td>
        <td><span class="tag ${status}">${status}</span></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderSigners(nodes) {
    const root = $('#signers');
    root.innerHTML = '';
    if (!nodes.length) {
      root.innerHTML = '<li class="hint mono" style="list-style:none;padding:4px 0">No signer nodes configured.</li>';
      return;
    }
    nodes.forEach((n) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span><strong>${n.id}</strong> · <span class="mono dim">${shorten(n.pubkey)}</span></span>
        <span class="endpoint">${n.endpoint}</span>`;
      root.appendChild(li);
    });
  }

  function renderProver(state) {
    const root = $('#proverState');
    if (!state) {
      root.innerHTML = '<p class="hint mono">Run <code>node prover/fetcher.js</code> to populate.</p>';
      return;
    }
    root.innerHTML = `
      <div class="kpi">
        <div><span class="kpi-num gold">${state.summary.fresh}</span><span class="kpi-lbl">FRESH</span></div>
        <div><span class="kpi-num" style="color:var(--red)">${state.summary.mismatch}</span><span class="kpi-lbl">MISMATCH</span></div>
        <div><span class="kpi-num" style="color:var(--gold)">${state.summary.unreachable}</span><span class="kpi-lbl">UNREACH</span></div>
      </div>
      <pre>${JSON.stringify(state, null, 2)}</pre>`;
  }

  async function loadHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const uptimeEl = $('#uptime');
      if (uptimeEl) uptimeEl.textContent = fmtUptime(data.uptime);
    } catch (_) {}
  }

  async function load() {
    const res = await fetch('/api/status');
    const data = await res.json();

    $('#network').textContent   = data.network || '—';
    $('#serverTime').textContent = new Date(data.serverTime).toLocaleTimeString();

    $('#cbAddress').textContent     = data.circuitBreakerAddress || '— not deployed —';
    $('#oracleAddress').textContent = data.oracleAddress || '—';
    $('#arAddress').textContent     = data.assetRegistryAddress || '— not deployed —';
    $('#teeAddress').textContent    = data.teeVerifierAddress || '— not deployed —';
    $('#enclaveAddress').textContent = data.enclaveAddress || '—';

    renderPhases(data.phases);
    renderTests(data.tests);
    renderArchitecture(data.architecture);
    renderAssets(data.assets, data.proverState);
    renderSigners(data.signerNodes);
    renderProver(data.proverState);

    loadHealth();
  }

  load().catch((err) => {
    document.body.innerHTML += `<pre style="color:var(--red,#ED1C24);padding:20px;font-family:monospace">${err.message}</pre>`;
  });
  setInterval(load, 15000);

  // ═══ RUN DEMO TASKS ═══
  window.runDemoTasks = async function () {
    var btn = document.getElementById('btn-run-demo');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('is-running');
    document.getElementById('btn-run-label').textContent = 'RUNNING…';
    document.getElementById('btn-run-icon').textContent = '⏳';

    var bar    = document.getElementById('demo-bar');
    var barTxt = document.getElementById('demo-bar-text');
    var verdictEl = document.getElementById('demo-verdict');
    var results    = document.getElementById('demo-results');
    var logEl      = document.getElementById('demo-results-log');
    bar.classList.add('active');
    results.classList.add('active');
    verdictEl.className = 'demo-verdict';
    verdictEl.textContent = '';
    logEl.textContent = '';

    var apiBase  = location.pathname.startsWith('/dashboard') ? '/' : '/api/verify';
    var apiUrl   = '/api/verify';
    var lines    = '';
    var allOk    = true;
    var steps    = 0;

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

    async function postVerify(name, params) {
      steps++;
      barTxt.textContent = `[${steps}/4] Running — ${esc(name)}`;
      verdictEl.textContent = 'WAITING';
      verdictEl.className = 'demo-verdict';
      try {
        var res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        var data = await res.json();
        var v = (data.verdict || '').toUpperCase();
        var s = data.safety_margin != null ? data.safety_margin.toFixed(4) : '—';
        var sig = data.signature || '';
        var prettySig = sig.length > 16 ? sig.substring(0, 12) + '…' + sig.substring(sig.length - 6) : sig;
        if (v !== 'SAFE') allOk = false;
        verdictEl.textContent = v;
        verdictEl.className = 'demo-verdict ' + (v === 'SAFE' ? 'safe' : 'trip');
        lines += `[Step ${steps}] ${esc(name)}\n` +
                 `  Params : α=${params.alpha}  β=${params.beta}  γ=${params.gamma}  τ=${params.threshold}\n` +
                 `  Verdict : ${v}  (safety margin ${s})\n` +
                 `  Reasoning chain : ${JSON.stringify(data.reasoning_chain, null, 2)}\n` +
                 `  Signature : HMAC-SHA256  ${esc(prettySig)}\n\n`;
        logEl.textContent = lines;
        try { window.updateVerificationBadge(data); } catch (_) {}
      } catch (err) {
        allOk = false;
        verdictEl.textContent = 'ERROR';
        verdictEl.className = 'demo-verdict trip';
        lines += `[Step ${steps}] ${esc(name)}\n  ERROR: ${esc(err.message)}\n\n`;
        logEl.textContent = lines;
      }
    }

    try {
      await postVerify('Default Kernel Parameters',   { alpha: 24, beta: 8,  gamma: 1.0, threshold: 0.6 });
      await new Promise(function(r) { setTimeout(r, 800); });
      await postVerify('Fraudulent Bank Detection',   { alpha: 8,  beta: 80, gamma: 1.5, threshold: 0.6 });
      await new Promise(function(r) { setTimeout(r, 800); });
      await postVerify('Ubuntu Pools — Normal',       { alpha: 24, beta: 8,  gamma: 1.0, threshold: 0.6 });
      await new Promise(function(r) { setTimeout(r, 800); });
      await postVerify('Falsified Deed',              { alpha: 4,  beta: 95, gamma: 1.5, threshold: 0.6 });
      await new Promise(function(r) { setTimeout(r, 500); });

      barTxt.textContent = allOk
        ? '[✓] Demo complete — all kernel checks passed.'
        : '[!] Demo complete — review results below.';
      verdictEl.textContent = allOk ? 'ALL SAFE' : 'REVIEW';
      verdictEl.className = 'demo-verdict ' + (allOk ? 'safe' : 'trip');
    } catch (err) {
      barTxt.textContent = '[✗] Demo aborted: ' + esc(err.message);
    }

    btn.disabled = false;
    btn.classList.remove('is-running');
    document.getElementById('btn-run-label').textContent = 'RUN DEMO';
    document.getElementById('btn-run-icon').textContent = '▶';

    // Auto-hide the live bar after 10 s; leave the results log visible
    setTimeout(function () { bar.classList.remove('active'); }, 10000);
  };
})();
