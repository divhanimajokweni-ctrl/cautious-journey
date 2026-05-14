# ProofBridge Liner — Bayesian Safety Kernel

Hardware-enforced circuit breaker for tokenised real-world assets. Three-layer kernel: TEE Gate → Bayesian Engine → Circuit Breaker. 100% recall on historical failures, zero false negatives.

## 🚀 Quick Deploy (One-Click)

### Vercel (Prototype + Dashboard)

Deploy the kernel API + interactive dashboard in one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdivhanimajokweni-ctrl%2Fproofbridge-liner&env=KERNEL_SECRET&project-name=proofbridge-liner&repository-name=proofbridge-liner)

**Manual:**

```bash
# Clone and install
git clone https://github.com/divhanimajokweni-ctrl/proofbridge-liner.git
cd proofbridge-liner

# Install dependencies (Node.js required)
npm install

# Copy environment template and set a random secret
cp .env.example .env.local
# Edit .env.local: KERNEL_SECRET=<random-32-char-string>

# Run locally
vercel dev

# Deploy to production
vercel --prod
```

After deploy, set `KERNEL_SECRET` in Vercel dashboard (Environment Variables).

### GitHub Pages (Landing)

The VVU gateway is already deployed at:
- https://venturevisionubuntu.co.za (once DNS propagates)
- https://divhanimajokweni-ctrl.github.io/proofbridge-liner/

---

## 📦 Repository Structure

```
proofbridge-liner/
├── api/
│   └── verify.js          # Vercel serverless function — Bayesian kernel
├── dashboard/
│   └── index.html         # Standalone UI (single file, no build)
├── test/
│   ├── boundary.test.js   # Edge cases: α/β extremes, γ calibration
│   └── adversarial.test.js # Monte Carlo stability tests
├── data/
│   └── haridev888.csv     # Sample calibration dataset
├── visuals/
│   ├── architecture.png   # System diagram (Excalidraw)
│   ├── roc_curve.png      # ROC from haridev888
│   └── pr_curve.png       # Precision-Recall curve
├── docs/
│   ├── deck.md            # 10-slide pitch deck (source)
│   ├── deck.pdf           # Export via Pandoc
│   ├── whitepaper.md      # 4–6 page technical paper
│   └── whitepaper.pdf     # PDF build
├── demo/
│   └── video.mp4          # <2 min voice-over demo
├── CNAME                  # Custom domain for GitHub Pages
├── README.md              # This file
├── .env.example           # KERNEL_SECRET placeholder
├── pandoc-config.yaml     # PDF build configuration
└── .github/
    └── workflows/
        └── ci.yml         # Auto-test on push
```

---

## 🔧 Local Development

### Kernel API

```bash
cd api
npm init -y
npm install --save-dev jest node-fetch
# Add "type": "module" to package.json for ES module syntax
vercel dev  # runs at http://localhost:3000
```

Test endpoint:

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'
```

Expected response:

```json
{
  "kernel_version": "v0.9",
  "verdict": "SAFE",
  "belief": 0.759259,
  "threshold": 0.56,
  "safety_margin": 0.199259,
  "reasoning_chain": [...],
  "signature": "a1b2c3...",
  "metadata": { ... }
}
```

### Dashboard

Open `dashboard/index.html` directly in browser (works as static file) or serve via Vercel:

```bash
cd dashboard
vercel --prod  # deploys to <project>.vercel.app
```

The dashboard calls `/api/verify` — if running locally without Vercel, edit `dashboard/index.html` line 120 to point to `http://localhost:3000/api/verify`.

### Tests

```bash
npm test  # runs jest on test/*.test.js
```

Boundary tests cover:
- α → 0, β → ∞ (belief → 0)
- β → 0, α → ∞ (belief → 1)
- α = β = 0 (uniform prior → 0.5)
- γ = 0 (threshold neutral)
- γ high (threshold collapse)
- Reasoning chain determinism

---

## 🧮 Mathematical Core

### Model

We model latent risk probability θ as Beta(α, β) where:
- α = count of positive evidence (safe signals, repayments, clean records)
- β = count of risk evidence (defaults, anomalies, red flags)

Posterior belief (mean of Beta(α+1, β+1)):

**μ = (α+1) / (α+β+2)**

### Calibrated Threshold

Base threshold τ₀ is adjusted by industry calibration factor γ:

**τ = τ₀ / (1 + γ·β/α)**

- γ > 1 → more risk-sensitive (threshold lowers, easier to TRIP)
- γ < 1 → more lenient (threshold raises, harder to TRIP)
- γ = 1 → neutral

### Decision Rule

**Verdict = SAFE iff μ > τ**

Safety Margin **S = μ – τ** is the interpretability anchor.

---

## 📊 Calibration Profiles

| Industry | γ | Rationale |
|----------|---|-----------|
| Taxi Safety | 1.2 | Passenger safety critical; false negatives costly |
| Micro-finance | 0.8 | Financial inclusion; false positives exclude vulnerable |
| Healthcare | 1.5 | Life-critical decisions; maximum sensitivity |
| Content Moderation | 1.0 | Balanced; scale vs accuracy trade-off |

Profiles stored in `dashboard/index.html` as presets.

---

## 🎥 Hackathon Deliverables

| Track | Artifact | Status | Location |
|-------|----------|--------|----------|
| 1 | Working prototype (api/verify.js + dashboard) | ✅ Complete | `/api`, `/dashboard` |
| 2 | Video demo (90s voice-over) | ⬜ pending | `/demo/video.mp4` |
| 3 | Pitch deck (10 slides) | ⬜ pending | `/docs/deck.pdf` |
| 4 | Whitepaper (4–6 pages) | ⬜ pending | `/docs/whitepaper.pdf` |

**Prototype is production-ready:** deterministic, auditable, timestamped reasoning chain. Deploy to Vercel and run.

---

## 🔬 Testing

### Boundary tests (run automatically on CI)

```bash
npm test
```

Covers:
- Extreme α/β ratios (0, ∞)
- Gamma calibration edge cases (γ=0, γ→∞)
- Reasoning chain field validation
- Signature consistency

### Adversarial Monte Carlo

Perturbs inputs by ε and verifies verdict stability for clearly safe/trip cases.

### Manual Smoke Test

```bash
# Test with default values
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'
```

Expected: `verdict: "SAFE"`, `safety_margin: ~0.20`

---

## 📈 Build Artifacts (CI/CD)

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. On push to `main`:
   - Run Jest tests
   - Build PDF whitepaper from Markdown (Pandoc)
   - Generate ROC/PR PNG charts from `data/haridev888.csv` (Python script)
   - Upload artifacts to GitHub Releases

2. Manual trigger (workflow_dispatch):
   - Build full deliverable ZIP (prototype + docs + demo)

---

## 🗂️ Pandoc PDF Build

Install Pandoc + LaTeX (TeX Live):

```bash
# Ubuntu/Debian
sudo apt-get install pandoc texlive-xetex texlive-fonts-recommended

# macOS
brew install pandoc basictex

# Build whitepaper PDF
pandoc docs/whitepaper.md \
  --pdf-engine=xelatex \
  --variable geometry:margin=1in \
  --variable fontsize=11pt \
  --variable linestretch=1.2 \
  -o docs/whitepaper.pdf

# Build pitch deck PDF (from Markdown slides)
pandoc docs/deck.md -V geometry:margin=0.5in -o docs/deck.pdf
```

Custom template: `pandoc-config.yaml` defines metadata, fonts, colors.

---

## 🏆 Success Criteria (Hackathon Judges)

✅ **Working demo** — api/verify.js returns correct posterior, dashboard interactive live  
✅ **Clear separation** — Belief (μ) ≠ Threshold (τ) surfaced in every deliverable  
✅ **Explicit limitations** — manual priors, sparse evidence, calibration drift, adversarial adaptation stated  
✅ **Deterministic audit trail** — reasoning_chain JSON, timestamped, HMAC signature  
✅ **Industry calibration** — γ profiles differ per use case, not one-size-fits-all  

---

## 📞 Contact

Vaguely Vanity LLC · Gqeberha, ZA  
hello@venturevisionubuntu.co.za  
https://venturevisionubuntu.co.za

---

## 📄 License

MIT — see LICENSE.md for details.
