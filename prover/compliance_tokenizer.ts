import crypto from "node:crypto";

export type Verdict = "SAFE" | "TRIP";
export type ChainTarget = "POLYGON_AMOY";
export type ExecutionScope = "COMPLIANCE_FABRIC";

export interface SarbBop3Telemetry {
  reporting_entity: string;
  fsca_license_num: string;
  transaction_ref: string;
  source_pool_id: string;
  sender_identity_did: string;
  beneficiary_identity_did: string;
  currency_code: "ZAR";
  fiat_amount: number;
  bop_category_code: string;
  telemetry_risk_metrics: {
    alpha: number;
    beta: number;
    gamma: number;
    posterior: number;
    threshold_tau: number;
    safety_margin: number;
    verdict: Verdict;
  };
  tee_attestation_measurement: string;
}

export interface ComplianceEnvelope {
  regulatory_affidavit_payload: Record<string, unknown>;
  attestation_signature_proof: string;
  payload_sha256: string;
  assurance_status: "ENFORCED_COMPLIANCE_METRIC";
}

const MAX = {
  reporting_entity: 64,
  fsca_license_num: 64,
  transaction_ref: 64,
  source_pool_id: 96,
  did: 256,
  bop_category_code: 16,
  tee_attestation_measurement: 128
} as const;

function assertBound(name: string, value: string, max: number): void {
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new Error(`COMPLIANCE_ERR_INVALID_FIELD_BOUND:${name}`);
  }
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`COMPLIANCE_ERR_NONFINITE_NUMBER:${name}`);
}

function assertHexSha256(name: string, value: string): void {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error(`COMPLIANCE_ERR_INVALID_SHA256:${name}`);
}

function b64urlJson(input: unknown): string {
  return Buffer.from(canonicalize(input)).toString("base64url");
}

export function canonicalize(value: unknown): string {
  if (value === undefined) throw new Error("CANONICALIZE_UNSUPPORTED_UNDEFINED");
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

function sha256Hex(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function timingSafeEqualText(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export class ProofBridgeComplianceTokenizer {
  private readonly algorithm = "RS256";
  private readonly issuer = "did:gov:za:sarb:proofbridge";
  private readonly audience = "did:bank:za:switchboard:enclave";

  generatePoolAccessToken(
    poolId: string,
    issuerDid: string,
    privateKeyPem: string,
    expiresInSeconds = 300
  ): string {
    assertBound("pool_id", poolId, MAX.source_pool_id);
    assertBound("issuer_did", issuerDid, MAX.did);
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 900) {
      throw new Error("TOKEN_ERR_INVALID_EXPIRY_WINDOW");
    }

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: this.algorithm, typ: "JWT" };
    const payload = {
      iss: this.issuer,
      sub: issuerDid,
      aud: this.audience,
      exp: now + expiresInSeconds,
      nbf: now,
      iat: now,
      jti: crypto.randomBytes(32).toString("hex"),
      pool_id: poolId,
      chain_target: "POLYGON_AMOY" satisfies ChainTarget,
      execution_scope: "COMPLIANCE_FABRIC" satisfies ExecutionScope
    };

    const signingInput = `${b64urlJson(header)}.${b64urlJson(payload)}`;
    const signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKeyPem).toString("base64url");
    return `${signingInput}.${signature}`;
  }

  verifyPoolAccessToken(token: string, publicKeyPem: string, expectedPoolId?: string): boolean {
    try {
      const parts = token.split(".");
      const [encodedHeader, encodedPayload, encodedSignature] = parts;
      if (parts.length !== 3 || !encodedHeader || !encodedPayload || !encodedSignature) return false;

      const signingInput = `${encodedHeader}.${encodedPayload}`;
      const ok = crypto.verify(
        "RSA-SHA256",
        Buffer.from(signingInput),
        publicKeyPem,
        Buffer.from(encodedSignature, "base64url")
      );
      if (!ok) return false;

      const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as unknown;
      if (!isRecord(payload)) return false;
      const now = Math.floor(Date.now() / 1000);

      if (!timingSafeEqualText(String(payload.iss), this.issuer)) return false;
      if (!timingSafeEqualText(String(payload.aud), this.audience)) return false;
      if (expectedPoolId && !timingSafeEqualText(String(payload.pool_id), expectedPoolId)) return false;
      if (typeof payload.exp !== "number" || typeof payload.nbf !== "number") return false;
      if (now >= payload.exp || now < payload.nbf) return false;

      return true;
    } catch {
      return false;
    }
  }

  compileSarbComplianceLog(telemetry: SarbBop3Telemetry, privateKeyPem: string): string {
    this.validateTelemetry(telemetry);

    const payload = {
      "@context": "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10",
      reporting_header: {
        submission_timestamp: new Date().toISOString(),
        regulatory_framework: "SARB_BOP3_v2026",
        fsca_governance_scope: "FSCA_JOINT_STATUS_2",
        chain_target: "POLYGON_AMOY",
        execution_scope: "COMPLIANCE_FABRIC"
      },
      bop3_iso20022_payload: {
        reporting_entity: telemetry.reporting_entity,
        fsca_license_num: telemetry.fsca_license_num,
        end_to_end_id: telemetry.transaction_ref,
        source_pool_id: telemetry.source_pool_id,
        debtor_did: telemetry.sender_identity_did.toLowerCase(),
        creditor_did: telemetry.beneficiary_identity_did.toLowerCase(),
        instructed_amount: {
          currency: telemetry.currency_code,
          value: telemetry.fiat_amount.toFixed(2)
        },
        bop_category_code: telemetry.bop_category_code
      },
      proofbridge_kernel: {
        alpha: telemetry.telemetry_risk_metrics.alpha,
        beta: telemetry.telemetry_risk_metrics.beta,
        gamma: telemetry.telemetry_risk_metrics.gamma.toFixed(6),
        posterior_mu: telemetry.telemetry_risk_metrics.posterior.toFixed(6),
        threshold_tau: telemetry.telemetry_risk_metrics.threshold_tau.toFixed(6),
        safety_margin: telemetry.telemetry_risk_metrics.safety_margin.toFixed(6),
        verdict: telemetry.telemetry_risk_metrics.verdict
      },
      hardware_proof: {
        enclave_type: "AMD_SEV_SNP",
        pcr0_sha256: telemetry.tee_attestation_measurement.toLowerCase()
      }
    };

    const canonicalPayload = canonicalize(payload);
    const signature = crypto.sign("RSA-SHA256", Buffer.from(canonicalPayload), privateKeyPem).toString("hex");

    const envelope: ComplianceEnvelope = {
      regulatory_affidavit_payload: payload,
      attestation_signature_proof: signature,
      payload_sha256: sha256Hex(canonicalPayload),
      assurance_status: "ENFORCED_COMPLIANCE_METRIC"
    };

    return JSON.stringify(envelope, null, 2);
  }

  verifyComplianceLog(envelopeJson: string, publicKeyPem: string): boolean {
    try {
      const envelope = JSON.parse(envelopeJson) as unknown;
      if (!isRecord(envelope)) return false;
      if (!isRecord(envelope.regulatory_affidavit_payload)) return false;
      if (typeof envelope.attestation_signature_proof !== "string") return false;
      if (typeof envelope.payload_sha256 !== "string") return false;
      if (envelope.assurance_status !== "ENFORCED_COMPLIANCE_METRIC") return false;
      if (!/^[a-fA-F0-9]+$/.test(envelope.attestation_signature_proof)) return false;
      if (!/^[a-fA-F0-9]{64}$/.test(envelope.payload_sha256)) return false;

      const canonicalPayload = canonicalize(envelope.regulatory_affidavit_payload);
      if (!timingSafeEqualText(sha256Hex(canonicalPayload), envelope.payload_sha256)) return false;

      return crypto.verify(
        "RSA-SHA256",
        Buffer.from(canonicalPayload),
        publicKeyPem,
        Buffer.from(envelope.attestation_signature_proof, "hex")
      );
    } catch {
      return false;
    }
  }

  private validateTelemetry(t: SarbBop3Telemetry): void {
    assertBound("reporting_entity", t.reporting_entity, MAX.reporting_entity);
    assertBound("fsca_license_num", t.fsca_license_num, MAX.fsca_license_num);
    assertBound("transaction_ref", t.transaction_ref, MAX.transaction_ref);
    assertBound("source_pool_id", t.source_pool_id, MAX.source_pool_id);
    assertBound("sender_identity_did", t.sender_identity_did, MAX.did);
    assertBound("beneficiary_identity_did", t.beneficiary_identity_did, MAX.did);
    assertBound("bop_category_code", t.bop_category_code, MAX.bop_category_code);
    assertBound("tee_attestation_measurement", t.tee_attestation_measurement, MAX.tee_attestation_measurement);
    assertHexSha256("tee_attestation_measurement", t.tee_attestation_measurement);

    if (t.currency_code !== "ZAR") throw new Error("COMPLIANCE_ERR_UNSUPPORTED_CURRENCY");
    assertFinite("fiat_amount", t.fiat_amount);
    if (t.fiat_amount <= 0) throw new Error("COMPLIANCE_ERR_INVALID_AMOUNT");

    const m = t.telemetry_risk_metrics;
    for (const [k, v] of Object.entries(m)) {
      if (typeof v === "number") assertFinite(k, v);
    }

    const expectedPosterior = (m.alpha + 1) / (m.alpha + m.beta + 2);
    const expectedMargin = expectedPosterior - m.threshold_tau;

    if (Math.abs(expectedPosterior - m.posterior) > 0.000001) throw new Error("COMPLIANCE_ERR_POSTERIOR_MISMATCH");
    if (Math.abs(expectedMargin - m.safety_margin) > 0.000001) throw new Error("COMPLIANCE_ERR_SAFETY_MARGIN_MISMATCH");
    if ((m.safety_margin > 0 ? "SAFE" : "TRIP") !== m.verdict) throw new Error("COMPLIANCE_ERR_VERDICT_MISMATCH");
  }
}
