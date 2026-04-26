(function () {
  const $ = (sel) => document.querySelector(sel);

  function shorten(addr) {
    if (!addr) return '—';
    return addr.length > 14 ? addr.slice(0, 8) + '…' + addr.slice(-6) : addr;
  }

  function renderPhases(phases) {
    const root = $('#phases');
    root.innerHTML = '';
    phases.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'phase';
      row.innerHTML = `
        <div class="num">${p.id}</div>
        <div>
          <div class="lbl">${p.name}<small>Phase ${p.id}</small></div>
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
      row.innerHTML = `<span class="dot"></span><span class="mono">${t.name}</span><span class="gas">${t.gas.toLocaleString()} gas</span>`;
      root.appendChild(row);
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
      tbody.innerHTML = '<tr><td colspan="4" class="hint">No assets configured.</td></tr>';
      return;
    }
    assets.forEach((a) => {
      const r = map.get(a.assetId);
      const status = r ? r.status : 'unknown';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${a.label || '—'}<br><span class="mono hint">${shorten(a.assetId)}</span></td>
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
      root.innerHTML = '<li class="hint">No signer nodes configured.</li>';
      return;
    }
    nodes.forEach((n) => {
      const li = document.createElement('li');
      li.innerHTML = `<span><strong>${n.id}</strong> · <span class="mono hint">${shorten(n.pubkey)}</span></span><span class="endpoint mono">${n.endpoint}</span>`;
      root.appendChild(li);
    });
  }

  function renderProver(state) {
    const root = $('#proverState');
    if (!state) {
      root.innerHTML = '<p class="hint">Run <code>node prover/fetcher.js</code> to populate.</p>';
      return;
    }
    root.innerHTML = `
      <div class="kpi">
        <div><span class="kpi-num">${state.summary.fresh}</span><span class="kpi-lbl">fresh</span></div>
        <div><span class="kpi-num">${state.summary.mismatch}</span><span class="kpi-lbl">mismatch</span></div>
        <div><span class="kpi-num">${state.summary.unreachable}</span><span class="kpi-lbl">unreachable</span></div>
      </div>
      <pre>${JSON.stringify(state, null, 2)}</pre>`;
  }

  async function load() {
    const res = await fetch('/api/status');
    const data = await res.json();
    $('#tagline').textContent = data.tagline;
    $('#network').textContent = data.network;
    $('#serverTime').textContent = new Date(data.serverTime).toLocaleString();
    $('#cbAddress').textContent = data.circuitBreakerAddress || '— not yet deployed —';
    $('#oracleAddress').textContent = data.oracleAddress || '—';
    renderPhases(data.phases);
    renderTests(data.tests);
    renderAssets(data.assets, data.proverState);
    renderSigners(data.signerNodes);
    renderProver(data.proverState);
  }

  load().catch((err) => {
    document.body.innerHTML += `<pre style="color:#ff6b6b;padding:20px">${err.message}</pre>`;
  });
  setInterval(load, 15000);
})();
