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

  // ─── GitHub OAuth UI handling ─────────────────────────────────────
  async function loadGhAuthStatus() {
    try {
      const res = await fetch('/oauth/status');
      const data = await res.json();
      const $authCard = $('#ghAuth');
      const $user = $('#ghUser');
      const $statusMsg = $('#ghStatusMsg');
      const $loginBtn = $('#btnDeviceLogin');
      const $ghLogin = $('#ghLogin');
      const $ghName = $('#ghName');
      const $ghEmail = $('#ghEmail');
      const $ghAvatar = $('#ghAvatar');
      const $ghExpires = $('#ghExpires');
      const $headerStatus = $('#ghAuthStatus');

      if (data.authenticated) {
        $user.style.display = 'flex';
        $statusMsg.style.display = 'none';
        $ghLogin.textContent = data.user.login;
        $ghName.textContent = data.name || '';
        $ghEmail.textContent = data.email || '';
        $ghExpires.textContent = `Expires in ${Math.floor(data.expires_in / 60)}m ${data.expires_in % 60}s`;
        $ghAvatar.src = `https://github.com/${data.user.login}.png`;
        $ghAvatar.alt = data.user.login;
        $headerStatus.innerHTML = `<span class="tag ok">${data.user.login}</span>`;
      } else {
        $user.style.display = 'none';
        $statusMsg.style.display = 'block';
        $loginBtn.style.display = 'inline-block';
        $headerStatus.innerHTML = `<span class="tag muted">NOT AUTH</span>`;
      }
    } catch (err) {
      console.error('Failed to load GitHub auth status:', err);
    }
  }

  async function startDeviceFlow() {
    const $loginBtn = $('#btnDeviceLogin');
    const $codeBox = $('#deviceCodeBox');
    const $userCode = $('#deviceUserCode');
    const $uri = $('#deviceUri');
    const $wait = $('#deviceWaitMsg');

    $loginBtn.disabled = true;
    $loginBtn.textContent = 'Starting…';

    try {
      const res = await fetch('/oauth/device/code', { method: 'POST' });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      $codeBox.style.display = 'block';
      $userCode.textContent = data.user_code;
      $uri.href = data.verification_uri;
      $wait.textContent = `Polling every ${data.interval}s… waiting for you to authorize.`;
      $wait.className = 'hint mono';

      pollForToken(data.device_code, data.interval);
    } catch (err) {
      alert('Device flow error: ' + err.message);
      $loginBtn.disabled = false;
      $loginBtn.textContent = 'Start Device Flow Login';
    }
  }

  async function pollForToken(deviceCode, interval) {
    const $wait = $('#deviceWaitMsg');
    while (true) {
      try {
        const res = await fetch(`/oauth/device/wait?device_code=${encodeURIComponent(deviceCode)}`);
        const data = await res.json();

        if (data.status === 'authorized') {
          $wait.textContent = 'Authorized! Refreshing…';
          setTimeout(() => window.location.reload(), 500);
          return;
        }

        if (data.error) {
          throw new Error(data.error + (data.error_description ? ': ' + data.error_description : ''));
        }

        if (data.slow_down) {
          interval = data.interval;
        }

        await new Promise(r => setTimeout(r, (data.slow_down ? interval * 1000 : interval * 1000)));
      } catch (err) {
        alert('Polling error: ' + err.message);
        cancelDeviceFlow();
        return;
      }
    }
  }

  function cancelDeviceFlow() {
    const $loginBtn = $('#btnDeviceLogin');
    const $codeBox = $('#deviceCodeBox');
    $loginBtn.disabled = false;
    $loginBtn.textContent = 'Start Device Flow Login';
    $codeBox.style.display = 'none';
  }

  document.getElementById('btnDeviceLogin').addEventListener('click', startDeviceFlow);
  document.getElementById('btnCancelDevice').addEventListener('click', cancelDeviceFlow);

  // Initial load
  loadGhAuthStatus();
  setInterval(loadGhAuthStatus, 30000); // refresh every 30s

})();
