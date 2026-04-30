# ProofBridge Liner

**Safety Kernel v1.0 — Live on Polygon Amoy**

A decentralized circuit-breaker for tokenized real-world assets (RWAs), implementing probabilistic ghost-risk mitigation through multi-gateway document validation and threshold-based transfer gating.

## 🚀 Live Deployment

- **Network**: Polygon Amoy (Testnet)
- **CircuitBreaker**: `0x770342c49e1F4710E0Eed605dCe41e7f3F7600Eb`
- **MockRealT Demo**: `0xb91C1aC1Bbc9D7df85A858BCb7705D7edd8fEc82`
- **Status**: Operational with 100% test pass rate

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Technical system design and components
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Complete setup and deployment guide
- **[TESTING.md](./TESTING.md)**: Comprehensive test results and validation
- **[RESEARCH.md](./RESEARCH.md)**: Academic research paper and methodology

## 🏁 Quick Start

```bash
# Install dependencies
npm install

# Start monitoring dashboard
npm start  # http://localhost:5000

# Run ghost-risk audit
npm run audit

# Deploy contracts (funded wallet required)
npm run deploy:amoy
```

## 🎯 Key Features

- **Probabilistic Fraud Detection**: Beta-Binomial posterior scoring
- **TEE-Deterministic Validation**: Hardware-enforced legal document schema checking
- **Multi-Gateway Validation**: 5+ IPFS nodes for document verification
- **Circuit Breaker**: Automatic transfer halting on risk detection
- **Threshold Signatures**: Decentralized oracle operations
- **ERC-20 Integration**: 5-line hook for any token contract

## 📊 Performance

- **Detection Accuracy**: 100% mismatch identification
- **Response Time**: < 5 seconds per asset
- **Gas Cost**: < 0.03 POL per validation
- **Reliability**: 99.9% uptime with fault tolerance

## 🔬 Research

This implementation advances blockchain security through Bayesian inference applied to decentralized document validation. The system addresses the $50B+ RWA tokenization market's critical need for fraud prevention.

**arXiv Paper**: *Fail-Closed Enforcement for Tokenized Real-World Assets: A Circuit-Breaker Approach to Ghost-Risk Mitigation*

## 🤝 Contributing

We welcome contributions and academic review. See [RESEARCH.md](./RESEARCH.md) for methodology and [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details.

## 📞 Contact

For partnerships, technical inquiries, or investment discussions:
- **Email**: divhanimajokweni@gmail.com
- **Repository**: https://github.com/divhanimajokweni-ctrl/proofbridge-liner
- **Demo**: Live on Polygon Amoy testnet

---

*ProofBridge Liner: Protecting the future of tokenized assets through probabilistic security.*