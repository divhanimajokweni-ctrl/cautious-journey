/**
 * ProofBridge Liner Dashboard — Main Client Controller
 * Handles WebSocket connections, real-time updates, UI reactivity
 */

// WebSocket connection (created by server)
let ws = null;
let metricsUpdateCount = 0;

// Color constants for dynamic states
const COLORS = {
  gold: '#FFD700',
  goldDim: '#B8860B',
  red: '#ED1C24',
  terracotta: '#E2725B',
  green: '#4ade80',
  amber: '#f59e0b',
};

// Ant-hony mascot element
const antHony = document.getElementById('ant-hony');

/**
 * Initialize WebSocket connection to dashboard server
 */
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('[Dash] Connected to kernel telemetry');
    addLog('[INFO] WebSocket connection established', 'success');
  };
  
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleKernelMessage(msg);
  };
  
  ws.onclose = () => {
    console.log('[Dash] Disconnected — reconnecting in 3s...');
    addLog('[WARN] Connection lost, reconnecting...', 'warning');
    setTimeout(initWebSocket, 3000);
  };
  
  ws.onerror = (err) => {
    console.error('[Dash] WebSocket error:', err);
    addLog('[ERROR] Connection error', 'error');
  };
}

/**
 * Handle incoming kernel messages
 */
function handleKernelMessage(msg) {
  switch (msg.type) {
    case 'kernel_state':
      updateUptime(msg.data.uptime);
      break;
    
    case 'metrics_update':
      updateMetrics(msg.data.metrics);
      break;
    
    case 'consensus_update':
      updateConsensus(msg.data);
      break;
    
    case 'simulation_update':
      if (window.colonySimulation) {
        window.colonySimulation.setColonySize(msg.data.colony_size);
        window.colonySimulation.setAlphaStrength(msg.data.alpha_intensity);
      }
      break;
  }
}

/**
 * Update real-time metrics display
 */
function updateMetrics(metrics) {
  metricsUpdateCount++;
  
  // TPS
  document.getElementById('tps-value').textContent = metrics.transactions_per_second;
  
  // CPU Load with color threshold
  const cpuEl = document.getElementById('cpu-value');
  cpuEl.textContent = `${metrics.cpu_load}%`;
  if (metrics.cpu_load > 90) {
    cpuEl.classList.add('text-radeon-red', 'critical-pulse');
    triggerAntHonyReaction('wiping-glasses');
  } else {
    cpuEl.classList.remove('text-radeon-red', 'critical-pulse');
  }
  
  // Memory
  document.getElementById('mem-value').textContent = `${metrics.memory_usage_mb} MB`;
  
  // Queue depth
  document.getElementById('queue-value').textContent = metrics.queue_depth;
  
  // TEE attestation
  if (metrics.tee_attestation === 'VALID') {
    setTEEStatus('VALID', 'text-green-400');
  } else {
    setTEEStatus('INVALID', 'text-radeon-red');
    addLog('[CRITICAL] TEE attestation failed!', 'error');
  }
  
  // Periodic log entries (every 10 updates to avoid spam)
  if (metricsUpdateCount % 10 === 0) {
    addLog(`[METRIC] TPS: ${metrics.transactions_per_second} | CPU: ${metrics.cpu_load}% | MEM: ${metrics.memory_usage_mb}MB`);
  }
}

/**
 * Update consensus state
 */
function updateConsensus(data) {
  // Update alpha gauge
  document.getElementById('alpha-value').textContent = data.alpha_accumulated;
  
  // Update risk class
  const riskEl = document.getElementById('risk-class');
  riskEl.textContent = data.risk_class;
  
  // Apply color based on risk
  if (data.risk_class === 'CLASS_A') {
    riskEl.className = 'font-tech text-xl font-bold text-center py-4 px-2 rounded bg-amd-void-light border border-ubuntu-gold/30 text-ubuntu-gold';
  } else if (data.risk_class === 'CLASS_B') {
    riskEl.className = 'font-tech text-xl font-bold text-center py-4 px-2 rounded bg-amd-void-light border border-terracotta text-terracotta';
  } else if (data.risk_class === 'ESCALATE') {
    riskEl.className = 'font-tech text-xl font-bold text-center py-4 px-2 rounded bg-amd-void-light border border-radeon-red text-radeon-red animate-pulse';
    addLog(`[ALERT] Escalation triggered — Colony: ${data.colony_size}`, 'warning');
  }
  
  // Update probabilities (derived simulation)
  if (data.risk_class === 'CLASS_A') {
    updateProbabilities({ a: 85, b: 10, e: 5 });
  } else if (data.risk_class === 'CLASS_B') {
    updateProbabilities({ a: 25, b: 65, e: 10 });
  } else {
    updateProbabilities({ a: 5, b: 15, e: 80 });
  }
  
  // Update colony simulation
  if (window.colonySimulation) {
    window.colonySimulation.updateParams(data.colony_size, 1.0);
  }
  
  // Update target CID display
  document.getElementById('target-cid').textContent = `Target: ${generateCIDShort()}`;
  
  // Periodic consensus log
  addLog(`[CONSENSUS] α=${data.alpha_accumulated} | Nodes: ${data.colony_size} | Class: ${data.risk_class}`);
}

/**
 * Update probability bars
 */
function updateProbabilities(probs) {
  document.getElementById('class-a-prob').textContent = `${probs.a}%`;
  document.getElementById('class-b-prob').textContent = `${probs.b}%`;
  document.getElementById('escalate-prob').textContent = `${probs.e}%`;
}

/**
 * Update uptime display
 */
function updateUptime(uptimeSeconds) {
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  document.getElementById('uptime-display').textContent = 
    `Uptime: ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
}

/**
 * Set TEE attestation status
 */
function setTEEStatus(status, colorClass) {
  const el = document.getElementById('tee-status');
  el.textContent = status;
  el.className = `px-2 py-1 rounded text-xs font-bold ${colorClass}`;
}

/**
 * Trigger Ant-hony reaction based on system state
 */
function triggerAntHonyReaction(reaction) {
  if (!antHony) return;
  
  if (reaction === 'wiping-glasses') {
    antHony.classList.add('wiping-glasses');
    setTimeout(() => antHony.classList.remove('wiping-glasses'), 1500);
    addLog('[ANT-HONY] Wiping glasses — High CPU detected');
  }
}

/**
 * Add entry to system log terminal
 */
function addLog(message, type = 'info') {
  const terminal = document.getElementById('syslog');
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const line = document.createElement('span');
  line.className = `terminal-line ${type}`;
  line.textContent = `[${timestamp}] ${message}`;
  
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
  
  // Keep only last 50 lines
  while (terminal.children.length > 50) {
    terminal.removeChild(terminal.firstChild);
  }
}

/**
 * Generate random CID short for display
 */
function generateCIDShort() {
  return 'Qm' + Math.random().toString(36).slice(2, 8) + '...';
}

/**
 * Fetch initial statistics from API (polling fallback)
 */
async function fetchStats() {
  try {
    const [metricsRes, consensusRes] = await Promise.all([
      fetch('/api/metrics'),
      fetch('/api/consensus')
    ]);
    
    if (metricsRes.ok) {
      const metrics = await metricsRes.json();
      updateMetrics(metrics.metrics);
      updateUptime(metrics.uptime);
    }
    
    if (consensusRes.ok) {
      const consensus = await consensusRes.json();
      updateConsensus({
        alpha_accumulated: consensus.alpha_accumulated,
        colony_size: consensus.colony_size,
        risk_class: consensus.risk_classification,
      });
    }
  } catch (err) {
    console.error('[Dash] Failed to fetch stats:', err);
  }
}

/**
 * Initialize dashboard
 */
document.addEventListener('DOMContentLoaded', () => {
  // Start WebSocket connection
  initWebSocket();
  
  // Fallback: poll every 5s if WS fails
  setInterval(fetchStats, 5000);
  
  // Initial fetch
  fetchStats();
  
  addLog('[INFO] Ubuntu-Bridge Dashboard initialized');
  addLog('[INFO] Ant Colony simulation engine started');
  addLog('[INFO] Waiting for kernel telemetry...');
  
  // Set initial values
  document.getElementById('pcr0-hash').textContent = 
    'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef12'.slice(0, 16) + '...';
});

// Expose for external (simulation) control
window.addLog = addLog;
