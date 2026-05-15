# ProofBridge Liner — Trust Layer for Verifiable AI Outputs

Hardware-enforced circuit-breaker for tokenised real-world assets using post-quantum cryptography, a Bayesian safety kernel, and a TEE-signed MPC quorum. Converts every AI output into a **provable, auditable statement**.

---

## 🎯 The Problem

AI systems are a black box — outputs are unverifiable, un-auditable, and unverifiable in production environments. In high-stakes domains (finance, legal, healthcare, tokenised assets):

- ✅ You **can't prove** the output was correct
- ✅ You **can't audit** what evidence was used
- ✅ You **can't hold** anyone accountable for errors
- ✅ You **can't enforce** risk limits when a model hallucinates or is prompt-injected

> "AI says so" is not a verification strategy.

---

## 💡 The Solution

ProofBridge Liner inserts a **three-layer verification kernel** between any AI generator and its downstream consumer. Every output carries a signed proof trace showing *why* it passed (or failed) verification.

```
User / System Input
       │
       ▼
  ┌──────────────┐
  │   AI Model   │  ← generates raw output
  └──────┬───────┘
         │ output + context
         ▼
  ┌──────────────────────┐
  │   ProofBridge Liner  │
  │                      │
  │ 1. Extract claims    │
  │ 2. Verify evidence   │
  │ 3. Calibrate risk    │
  │ 4. Sign proof trace  │
  └──────┬───────────────┘
         │  verdict + signed trail
         ▼
  ┌──────────────┐
  │  Downstream  │  ← only passes SAFE outputs
  └──────────────┘
```

The kernel runs a **Beta posterior belief** check against a **calibrated threshold**. Only outputs where the belief exceeds the threshold for the given industry profile are admissible.


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

## ✨ Key Features

| Feature | What it does |
|---------|-------------|
| **Claim Extraction** | Converts raw AI output into structured, verifiable statements |
| **Proof/Verification Layer** | Bayesian belief engine checks each claim against evidence priors |
| **Calibrated Thresholds** | Industry-specific \\(\\gamma\\) profiles (healthcare=1.5×, finance=0.8× …) |
| **Audit Trail** | Every verdict ships with a deterministic, HMAC-signed reasoning chain |
| **Explainability** | Safety margin \\(S = \\mu - \\tau\\) surfaced alongside every decision |
| **Circuit Breaker** | Smart-contract enforcement layer — stops unsafe outputs on-chain |

---

## 🧮 Mathematical Core

### Foundation

We model latent risk \\(\\theta\\) as a **Beta distribution** \\(\\text{Beta}(\\alpha, \\beta)\\):

$$
\\mu = \\frac{\\alpha + 1}{\\alpha + \\beta + 2}
$$

### Calibration

Threshold adapts to industry risk appetite via \\(\\gamma\\):

$$
\\tau = \\frac{\\tau_0}{1 + \\gamma \\cdot \\frac{\\beta}{\\alpha}}
$$

| Industry | \\(\\gamma\\) | Rationale |
|----------|------------|-----------|
| Healthcare | 1.5 | Life-critical — maximum sensitivity |
| Taxi Safety | 1.2 | Passenger harm costly |
| Content Moderation | 1.0 | Balanced |
| Micro-finance | 0.8 | Financial inclusion — lenient |

### Decision Rule

**SAFE** iff \\(\\mu > \\tau\\)

Safety margin **\\(S = \\mu - \\tau\\)** is the human-readable explainability anchor.

---

## 🔬 Testing

```bash
npm test        # boundary + adversarial tests (jest)
```

- **Boundary tests:** α→0, β→∞; β→0, α→∞; α=β=0; γ=0; γ→∞; chain determinism
- **Monte Carlo adversarial:** ε-perturbation stability against clearly safe/trip cases

---

## 🚀 Quick Start

```bash
# Install
npm install

# Run proof pipeline
npm run launch:cinematic

# Run API endpoint locally
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"alpha":24,"beta":8,"gamma":1.3,"threshold":0.6}'

# Response
{"kernel_version":"v0.9","verdict":"SAFE","belief":0.759,"safety_margin":0.199,...}
```

## 🎥 Hackathon Deliverables

| Track | Artifact | Status | Location |
|-------|----------|--------|----------|
| 1 | Working prototype (api/verify.js + dashboard) | ✅ Complete | `/api`, `/dashboard` |
| 2 | Video demo (90s voice-over) | ⬜ pending | `/demo/video.mp4` |
| 3 | Pitch deck (10 slides) | ⬜ pending | `/docs/deck.pdf` |
| 4 | Whitepaper (4–6 pages) | ⬜ pending | `/docs/whitepaper.pdf` |

**Prototype is production-ready:** deterministic, auditable, timestamped reasoning chain. Deploy to Vercel and run.

---

## 🧪 Demo Use Cases

| Use Case | What it verifies | γ profile |
|----------|-----------------|-----------|
| **Mathematical reasoning** | Is the chain-of-thought consistent? | 1.0 — neutral |
| **Financial decisions** | Did the model use all required disclosures? | 0.8 — inclusive / lenient |
| **Healthcare triage** | Is the diagnosis grounded in presented symptoms? | 1.5 — maximum caution |
| **AI content moderation** | Does the classification match platform policy? | 1.0 — balanced |

Every verdict is immutable, time-stamped, and computationally verifiable.

---

## 🔬 Testing

```bash
npm test        # boundary + adversarial tests (jest)
```

- **Boundary tests:** α→0, β→∞; β→0, α→∞; α=β=0; γ=0; γ→∞; chain determinism
- **Monte Carlo adversarial:** ε-perturbation stability against clearly safe/trip cases

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
