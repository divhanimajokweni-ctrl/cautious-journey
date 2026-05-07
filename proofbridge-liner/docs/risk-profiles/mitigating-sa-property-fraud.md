# Mitigating South African Property Fraud with ProofBridge Liner

## Overview
Property fraud in South Africa is a significant risk, with deeds registries vulnerable to identity theft and fraudulent transfers. ProofBridge Liner addresses this through Bayesian scoring and automated compliance.

## Risk Mitigation Strategies
- **Bayesian Evaluation**: Uses beta-binomial distribution for risk assessment.
- **Stratified Thresholds**: Class A (administrative noise) vs Class B (structural fraud).
- **TEE Attestation**: Hardware-locked integrity for scoring.
- **Regulatory Automation**: Triggers FSCA JS2, FICA SAR, and forensic evidence packaging.

## Key Features
- Real-time scoring with gamma=20 cost ratio.
- Automated incident reporting to regulators.
- PII sanitization for audits.
- Disaster recovery with gamma fallback.

## Implementation
Integrate with Deeds Office APIs for seamless operation.