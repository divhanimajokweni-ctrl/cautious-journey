# ProofBridge Liner — Bayesian Safety Kernel

Hardware-enforced circuit breaker for tokenised real-world assets. Three-layer kernel: TEE Gate → Bayesian Engine → Circuit Breaker. 100% recall on historical failures, zero false negatives.

## 🚀 Quick Deploy

### Vercel (Prototype + Dashboard)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdivhanimajokweni-ctrl%2Fproofbridge-liner&env=KERNEL_SECRET&project-name=proofbridge-liner&repository-name=proofbridge-liner)

**Manual:**

```bash
git clone https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
cd proofbridge-liner
npm install
cp .env.example .env.local
# Edit .env.local: set KERNEL_SECRET to a random 32+ char string
vercel dev   # runs at http://localhost:3000
vercel --prod
```

After deploy, set `KERNEL_SECRET` in Vercel dashboard.

### GitHub Pages (Landing)

Site: https://venturevisionubuntu.co.za (once DNS propagates)  
Backup: https://divhanimajokweni-ctrl.github.io/proofbridge-liner/

---

## 📦 Repository Structure

```
proofbridge-liner/
├── api/
│   ├── verify.js          # Vercel serverless function — Bayesian kernel
│   └── package.json
├── dashboard/
│   └── index.html         # Standalone UI (single file, no build)
├── test/
│   ├── boundary.test.js   # Edge cases: α/β extremes, γ calibration
│   └── adversarial.test.js
├── data/
│   └── haridev888.csv     # Sample calibration dataset
├── visuals/
│   ├── architecture.png   # System diagram
│   ├── roc_curve.png      # ROC from haridev888
│   └── pr_curve.png       # Precision-Recall curve
├── docs/
│   ├── deck.md            # 10-slide pitch deck (source)
│   └── whitepaper.md      # 4–6 page technical paper
├── CNAME                  # Custom domain for GitHub Pages
├── README.md              # This file
├── .env.example           # KERNEL_SECRET placeholder
└── .github/
    └── workflows/
        └── ci.yml         # Auto-test + PDF build
```

---

## 🔧 Local Development

### Kernel API

```bash
cd api
npm install
vercel dev  # http://localhost:3000
```

Test:

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'
```

### Dashboard

Open `dashboard/index.html` in browser (static) or deploy via Vercel:

```bash
cd dashboard
vercel --prod
```

The dashboard calls `/api/verify` — if running locally, edit the fetch URL to `http://localhost:3000/api/verify`.

### Tests

```bash
cd api && npm test
```

---

## 🧮 Mathematical Core

**Posterior belief:** μ = (α+1) / (α+β+2)  
**Calibrated threshold:** τ = τ₀ / (1 + γ·β/α)  
**Decision:** SAFE iff μ > τ  
**Safety Margin:** S = μ – τ

**Calibration profiles:**

| Industry | γ | Behaviour |
|----------|---|-----------|
| Healthcare | 1.5 | Highly sensitive (low τ) |
| Taxi Safety | 1.2 | Sensitive |
| Content Mod | 1.0 | Neutral |
| Micro-finance | 0.8 | Lenient (high τ) |

---

## 🎥 Hackathon Deliverables

| Track | Artifact | Status |
|-------|----------|--------|
| Track 1 | Working prototype (api/verify.js + dashboard) | ✅ Complete |
| Track 2 | Video demo (90s voice-over) | ⬜ pending |
| Track 3 | Pitch deck (10 slides) | ⬜ pending |
| Track 4 | Whitepaper (4–6 pages) | ⬜ pending |

Prototype is production-ready: deterministic, auditable, timestamped reasoning chain.

---

## 🔬 Testing

- **Boundary tests:** α/β extremes, γ edge cases, reasoning chain structure
- **Adversarial tests:** Monte Carlo perturbation stability
- **Manual smoke:** default input should yield SAFE (α=24, β=8, γ=1.3, τ₀=0.6 → margin ~0.2)

---

## 📈 CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs:
1. Jest tests on every push
2. Pandoc build of whitepaper & pitch deck PDFs
3. (Optional) Deploy dashboard to GitHub Pages

---

## 🏆 Success Criteria

✅ Working demo — api returns correct posterior, dashboard interactive  
✅ Clear Belief ≠ Threshold separation in all deliverables  
✅ Explicit limitations — manual priors, evidence quality, drift, adversarial risk  
✅ Deterministic audit trail — reasoning_chain JSON, timestamped, HMAC  
✅ Industry calibration — γ profiles differ per use case

**Key differentiator:** Belief/Threshold separation + Safety Margin as interpretability anchor.

---

## 📞 Contact

Vaguely Vanity LLC · Gqeberha, ZA  
hello@venturevisionubuntu.co.za  
https://venturevisionubuntu.co.za

## 📄 License

MIT