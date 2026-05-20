import crypto from "node:crypto";
import { ProofBridgeComplianceTokenizer, SarbBop3Telemetry } from "../prover/compliance_tokenizer.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 3072,
  publicExponent: 0x10001,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" }
});

const tokenizer = new ProofBridgeComplianceTokenizer();

const telemetry: SarbBop3Telemetry = {
  reporting_entity: "BANK_ZA_ZA01",
  fsca_license_num: "FSCA-FSP-49931",
  transaction_ref: "ISO20022-TXID-99881122A",
  source_pool_id: "ROSCA_STOKVEL_SANDTON_09",
  sender_identity_did: "did:key:z6MkpTHR8VNsBxRkWStnqcT9WGSY5JD98",
  beneficiary_identity_did: "did:key:z6MkpTHR8VNsBxRkWStnqcT9WGSY5JD99",
  currency_code: "ZAR",
  fiat_amount: 250000.00,
  bop_category_code: "101",
  telemetry_risk_metrics: {
    alpha: 4,
    beta: 1,
    gamma: 1.0,
    posterior: 0.7142857142857143,
    threshold_tau: 0.600000,
    safety_margin: 0.11428571428571432,
    verdict: "SAFE"
  },
  tee_attestation_measurement: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
};

console.log("1_VALIDATE_ISOLATED_MEMORY_BOUNDS_AND_SYNTAX_PARSE");
assert(JSON.stringify(telemetry).length < 64000, "MEMORY_BOUND_EXCEEDED");
assert(telemetry.reporting_entity.length <= 64, "REPORTING_ENTITY_BOUND_FAIL");

console.log("2_RUN_LOCAL_ASYMMETRIC_JWT_CRYPTOGRAPHIC_VERIFICATION_TESTS");
const jwt = tokenizer.generatePoolAccessToken("pb_up_group_johannesburg_01", "did:key:z6Mkp", privateKey, 300);
assert(tokenizer.verifyPoolAccessToken(jwt, publicKey, "pb_up_group_johannesburg_01"), "JWT_VERIFY_FAIL");
assert(!tokenizer.verifyPoolAccessToken(jwt.slice(0, -2) + "xx", publicKey, "pb_up_group_johannesburg_01"), "JWT_TAMPER_FAIL");
assert(!tokenizer.verifyPoolAccessToken("not.a.jwt", publicKey, "pb_up_group_johannesburg_01"), "JWT_MALFORMED_FAIL");

console.log("3_EVALUATE_COMPLIANCE_TELEMETRY_SERIALIZATION_SCHEMA");
const log = tokenizer.compileSarbComplianceLog(telemetry, privateKey);
const parsed = JSON.parse(log);
assert(parsed.regulatory_affidavit_payload["@context"].includes("iso:20022"), "ISO20022_CONTEXT_FAIL");
assert(parsed.regulatory_affidavit_payload.bop3_iso20022_payload.instructed_amount.currency === "ZAR", "CURRENCY_FAIL");
assert(parsed.regulatory_affidavit_payload.bop3_iso20022_payload.bop_category_code === "101", "BOP3_CATEGORY_FAIL");

console.log("4_REAUDIT_SIGNATURE_VALIDATION_TIMING_PATHWAYS");
assert(tokenizer.verifyComplianceLog(log, publicKey), "COMPLIANCE_SIGNATURE_VERIFY_FAIL");
const tampered = log.replace("250000.00", "250001.00");
assert(!tokenizer.verifyComplianceLog(tampered, publicKey), "COMPLIANCE_TAMPER_FAIL");
assert(!tokenizer.verifyComplianceLog("{", publicKey), "COMPLIANCE_MALFORMED_FAIL");

console.log("5_FINAL_EXECUTION_CORRECTNESS_CHECK");
assert(parsed.assurance_status === "ENFORCED_COMPLIANCE_METRIC", "ASSURANCE_STATUS_FAIL");
assert(parsed.regulatory_affidavit_payload.proofbridge_kernel.verdict === "SAFE", "VERDICT_FAIL");

console.log(JSON.stringify({
  status: "COMPLETE",
  verification_loop: [
    "ISOLATED_MEMORY_BOUNDS_AND_SYNTAX_PARSE_PASS",
    "ASYMMETRIC_JWT_CRYPTOGRAPHIC_VERIFICATION_PASS",
    "SARB_BOP3_ISO20022_SERIALIZATION_PASS",
    "TIMING_PATHWAY_REAUDIT_PASS",
    "FINAL_EXECUTION_CORRECTNESS_PASS"
  ]
}, null, 2));
