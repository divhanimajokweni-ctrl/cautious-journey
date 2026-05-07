# Technical FAQ - ProofBridge Liner v1.1.1

## Q: What is the Bayesian scoring model?
A: We use a beta-binomial posterior mean for risk assessment, calibrated with stratified thresholds.

## Q: How does TEE attestation work?
A: Hardware PCR0 values are verified to ensure kernel integrity.

## Q: What regulations are supported?
A: Act 47, e-DRS Act, JS2, POPIA, Cybercrimes Act, FICA.

## Q: How is PII handled?
A: Sensitive data is hashed and redacted before logging.

## Q: What happens in a high-risk event?
A: Automatic generation of FSCA reports, FIC SAR, forensic bundles, and CISO notifications.