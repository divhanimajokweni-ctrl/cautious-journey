# Roadmap: Next Milestones (90-Day View)

## 🗺️ Suggested Next Milestones

### 1. Deploy Pending Contracts on Amoy
- **TEEVerifier**: Deploy `contracts/TEEVerifier.sol` for TEE-signed attestations (EIP-191 ECDSA)
- **AssetRegistry**: Deploy `contracts/AssetRegistry.sol` for per-asset isolated circuit-breaker kernels
- **Script**: Use `script/DeployFull.s.sol` with required environment variables (PRIVATE_KEY, ORACLE_ADDRESS, ENCLAVE_ADDRESS)
- **Timeline**: Week 1-2
- **Dependencies**: Funded wallet, environment setup

### 2. Publish Attestation + Verification Walkthrough
- **Content**: Step-by-step guide for TEE attestation generation and verification
- **Format**: Technical documentation with code examples
- **Audience**: Developers integrating with ProofBridge Liner
- **Timeline**: Week 3-4
- **Deliverables**: Updated docs, code samples, video tutorial

### 3. External Security Review (Focused, Not Broad)
- **Scope**: Smart contract security audit for deployed contracts
- **Vendors**: Consider Certik, OpenZeppelin, or specialized DeFi auditors
- **Focus Areas**: Circuit-breaker logic, oracle interactions, TEE verification
- **Timeline**: Week 5-8
- **Budget**: $10K-$20K

### 4. One Real Partner Pilot (Even Synthetic Data, Real Process)
- **Objective**: End-to-end pilot with RWA platform or financial institution
- **Data**: Use synthetic/real-world data for circuit-breaker testing
- **Partners**: Target RealT, Centrifuge, or South African financial institutions
- **Timeline**: Week 9-12
- **Success Metrics**: Successful circuit activation, partner feedback

### 5. Regulatory-Facing Whitepaper (Non-Crypto Language)
- **Audience**: Regulators, compliance officers, institutional investors
- **Content**: Explain TEE-enhanced security, legal compliance, risk mitigation
- **Language**: Avoid crypto jargon, focus on traditional finance concepts
- **Timeline**: Month 3
- **Impact**: Support regulatory approval and institutional adoption

## 📊 Progress Tracking
- [ ] Deploy TEEVerifier and AssetRegistry
- [ ] Publish attestation walkthrough
- [ ] Complete security review
- [ ] Execute partner pilot
- [ ] Release regulatory whitepaper

## 🎯 Key Dependencies
- Continued funding from Phase 1 strategy
- Technical team expansion (DevOps, security)
- Legal counsel for regulatory compliance
- Partnership development team

## 📈 Success Metrics
- All contracts deployed and verified
- Documentation completeness score >90%
- Security audit with no critical issues
- Pilot completion with partner sign-off
- Whitepaper distributed to 50+ regulatory contacts

## 📅 Timeline Overview
- **Weeks 1-4**: Contract deployments and documentation
- **Weeks 5-8**: Security review and pilot preparation
- **Weeks 9-12**: Pilot execution and whitepaper development

For questions or adjustments to this roadmap, please contact the project lead.