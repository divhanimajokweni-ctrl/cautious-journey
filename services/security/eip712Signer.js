/**
 * services/security/eip712Signer.js
 * ----------------------------------------------------------
 * EIP-712 typed signature generator for oracle decisions.
 *
 * Reads:
 *   contracts/AssetRegistry.sol  — per-asset kernel tripping interface
 *   contracts/TEEVerifier.sol    — EIP-191 enclave attestation model
 *
 * This module does NOT call smart contracts directly. It produces
 * off-chain, human-readable EIP-712 signatures that the orchestrator
 * (or a relayer) can submit to on-chain functions such as:
 *   AssetRegistry.check(entity_id, posterior)
 *   AssetRegistry.reset(entity_id)
 *
 * Domain:
 *   name    = "ProofBridgeLiner"
 *   version = "1"
 *   chainId = process.env.POLYGON_AMOY_CHAIN_ID  (default 80002)
 *   verifyingContract = process.env.ORACLE_PUBLIC_KEY
 *
 * Primary type "OracleDecision":
 *   entity_id   string
 *   belief      uint256   (basis-points 0..10000 => 0.00..1.00)
 *   threshold   uint256   (basis-points)
 *   verdict     string    ("PASS" | "WARN" | "HALT")
 *   nonce       uint256
 *   timestamp   uint256   (unix seconds)
 *
 * Signer key:
 *   process.env.ORACLE_PRIVATE_KEY  (required; throws if absent)
 *
 * ESM module — compatible with Vercel Serverless Functions and
 * the local orchestrator equally.
 */

import { ethers } from 'ethers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CHAIN_ID = 80002; // Polygon Amoy

const DOMAIN = {
  name: 'ProofBridgeLiner',
  version: '1',
};

// EIP-712 primary type for an oracle decision
const DECISION_TYPE = {
  OracleDecision: [
    { name: 'entity_id',   type: 'string'  },
    { name: 'belief',      type: 'uint256' },
    { name: 'threshold',   type: 'uint256' },
    { name: 'verdict',     type: 'string'  },
    { name: 'nonce',       type: 'uint256' },
    { name: 'timestamp',   type: 'uint256' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the EIP-712 domain, injecting chainId and verifyingContract at call-time
 * so the environment can change between unit tests and production without
 * re-initialising a module-level constant.
 */
function buildDomain(chainId, verifyingContract) {
  return {
    ...DOMAIN,
    chainId: Number(chainId),
    verifyingContract,
  };
}

/**
 * Validate that a basis-point value is within range [0, 10000].
 * Basis-points express the same probability space as [0.00, 1.00]
 * where 10000 bp = 1.00.
 */
function assertValidBasisPoints(value, name) {
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0 || v > 10000) {
    throw new RangeError(`${name} must be a basis-point value in [0, 10000], got ${value}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a wallet signer from the ORACLE_PRIVATE_KEY environment variable.
 * Throws with a clear error if the variable is not set or is the zero address.
 */
function getOracleWallet() {
  const privateKey = process.env.ORACLE_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'ORACLE_PRIVATE_KEY environment variable is not set. ' +
      'Set it before calling signDecision().'
    );
  }
  const pk = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;
  const wallet = new ethers.Wallet(pk);
  if (wallet.address === ethers.ZeroAddress) {
    throw new Error('ORACLE_PRIVATE_KEY resolves to the zero address — refusing to sign.');
  }
  return wallet;
}

/**
 * Build the full EIP-712 domain object including chainId and verifying
 * contract address.  Verifying contract defaults to ORACLE_PUBLIC_KEY;
 * falls back to ENCLAVE_ADDRESS for backward compatibility.
 *
 * @returns {{ domain: object, domainDefining: object }}
 */
export function getDecisionDomain() {
  const chainId = Number(
    process.env.POLYGON_AMOY_CHAIN_ID
    || process.env.CHAIN_ID
    || DEFAULT_CHAIN_ID
  );

  const verifyingContract =
    process.env.ORACLE_PUBLIC_KEY
    || process.env.ENCLAVE_ADDRESS
    || process.env.TEE_VERIFIER_ADDRESS;

  if (!verifyingContract) {
    throw new Error(
      'No verifying contract address set. ' +
      'Set ORACLE_PUBLIC_KEY, ENCLAVE_ADDRESS, or TEE_VERIFIER_ADDRESS.'
    );
  }

  const domain = buildDomain(chainId, verifyingContract);
  return { domain, domainDefining: DOMAIN };
}

/**
 * Sign an oracle decision using EIP-712 typed data (Ethereum signed message
 * standard).  The returned signature can be verified off-chain with
 * {@link verifySignature} or on-chain via `ecrecover` in Solidity.
 *
 * @param {object} params
 * @param {string} params.entity_id   — asset / entity identifier (e.g. keccak256 label)
 * @param {number} params.belief      — posterior in basis-points (0..10000)
 * @param {number} params.threshold   — calibrated threshold in basis-points (0..10000)
 * @param {string} params.verdict     — "PASS" | "WARN" | "HALT"
 * @param {number} params.nonce       — monotonically increasing nonce
 * @param {number} params.timestamp   — unix seconds
 * @returns {Promise<{domain: object, types: object, value: object, signature: string}>}
 * @throws {Error} if ORACLE_PRIVATE_KEY is not set
 * @throws {RangeError} if belief or threshold are out of basis-point range
 */
export async function signDecision({
  entity_id,
  belief,
  threshold,
  verdict,
  nonce,
  timestamp,
}) {
  if (!entity_id || typeof entity_id !== 'string') {
    throw new TypeError('entity_id is required and must be a string');
  }
  if (typeof verdict !== 'string' || !['PASS', 'WARN', 'HALT'].includes(verdict)) {
    throw new TypeError(`verdict must be one of PASS | WARN | HALT, got "${verdict}"`);
  }

  assertValidBasisPoints(belief,      'belief');
  assertValidBasisPoints(threshold,   'threshold');

  const wallet = getOracleWallet();

  const { domain } = getDecisionDomain();

  // Sanitise the value for EIP-712 (ethers v6 expects types + value pairs)
  const value = {
    entity_id:   String(entity_id),
    belief:      BigInt(Math.round(Number(belief))),
    threshold:   BigInt(Math.round(Number(threshold))),
    verdict:     String(verdict),
    nonce:       BigInt(Number(nonce)),
    timestamp:   BigInt(Math.round(Number(timestamp))),
  };

  const signature = await wallet.signTypedData(domain, DECISION_TYPE, value);

  return {
    domain,
    types:     DECISION_TYPE,
    value,
    signature,
  };
}

/**
 * Verify an EIP-712 signature produced by {@link signDecision}.
 *
 * @param {object} params
 * @param {object} params.domain   — the domain object used when signing
 * @param {object} params.types    — the types object used when signing (DECISION_TYPE)
 * @param {object} params.value    — the value object used when signing
 * @param {string} params.signature — 0x-prefixed hex r|s|v
 * @param {string} params.address  — expected signer address (checksummed)
 * @returns {Promise<string>} recovered signer address (checksummed)
 * @throws {Error} if the recovered signer does not match the expected address
 */
export async function verifySignature({ domain, types, value, signature, address }) {
  const recovered = ethers.verifyTypedData(domain, types, value, signature);
  if (recovered.toLowerCase() !== address.toLowerCase()) {
    throw new Error(
      `Signature verification failed: recovered ${recovered}, expected ${address}`
    );
  }
  return recovered;
}

// ---------------------------------------------------------------------------
// Convenience: convert a posterior/calibrated_threshold float [0..1]
// to basis-points [0..10000]
// ---------------------------------------------------------------------------

/** @type {(p: number) => number} */
export const toBasisPoints = (p) => Math.round(Number(p) * 10000);

/** @type {(bp: number) => number} */
export const fromBasisPoints = (bp) => Number(bp) / 10000;

export { DOMAIN, DECISION_TYPE };
