// prover/latency.js
// Computes detection latency statistics for ProofBridge Liner.
//
// Assumes periodic polling with interval Δ.
// Tampering events occur uniformly within interval.
// Detection latency T ~ Uniform(0, Δ)
//
// Hazard function: λ(t) = 1/(Δ - t)
// Expected value: E[T] = Δ/2 + t_overhead
// 95th percentile: t_0.95 = 0.95 Δ

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const OVERHEAD_MS = 2000; // Estimated gateway latency + aggregation

/**
 * Computes expected detection latency.
 * @returns {number} Expected latency in milliseconds
 */
function expectedLatency() {
  return POLL_INTERVAL_MS / 2 + OVERHEAD_MS;
}

/**
 * Computes 95th percentile detection latency.
 * @returns {number} 95th percentile in milliseconds
 */
function percentile95Latency() {
  return 0.95 * POLL_INTERVAL_MS;
}

/**
 * Hazard function value at time t.
 * @param {number} t - Time in milliseconds from tampering event
 * @returns {number} Hazard rate (instantaneous detection probability per ms)
 */
function hazardFunction(t) {
  if (t >= POLL_INTERVAL_MS) return 0; // No detection after interval
  return 1 / (POLL_INTERVAL_MS - t);
}

/**
 * Generates latency statistics for dashboard or reports.
 * @returns {Object} Latency stats
 */
function getLatencyStats() {
  return {
    pollIntervalMs: POLL_INTERVAL_MS,
    overheadMs: OVERHEAD_MS,
    expectedMs: expectedLatency(),
    percentile95Ms: percentile95Latency(),
    expectedMinutes: (expectedLatency() / 60000).toFixed(2),
    percentile95Minutes: (percentile95Latency() / 60000).toFixed(2)
  };
}

module.exports = {
  POLL_INTERVAL_MS,
  OVERHEAD_MS,
  expectedLatency,
  percentile95Latency,
  hazardFunction,
  getLatencyStats
};