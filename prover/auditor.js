// prover/auditor.js
// ProofBridge Liner — Ghost‑Risk Audit Engine
//
// Consumes prover state, fetches deed content, extracts text from PDFs,
// submits forensic prompts to DeepSeek‑V4‑Pro via NVIDIA NIM API,
// and generates issuer‑ready audit reports.
//
// Usage:
//   npm run audit              after npm run fetch
//   node prover/auditor.js     directly
// ---------------------------------------------------------------------------

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const https = require("node:https");
const pdfParse = require("pdf-parse");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";
const MODEL = "deepseek-ai/deepseek-v4-pro";

const STATE_FILE = path.resolve(
  __dirname,
  "..",
  ".local",
  "state",
  "prover-state.json"
);
const AUDIT_REPORT = path.resolve(__dirname, "..", "demo", "audit-realT.md");
const CACHE_DIR = path.resolve(__dirname, "..", ".local", "state", "cache");

// IPFS gateways to try (fallback if the first fails)
const GATEWAYS = [
  "https://ipfs.io",
  "https://cloudflare-ipfs.com",
  "https://dweb.link",
];

// ---------------------------------------------------------------------------
// PDF text extraction using pdf-parse
// ---------------------------------------------------------------------------
async function extractTextFromPDF(buffer) {
  try {
    // Validate PDF format
    const str = buffer.toString("utf-8");
    if (!str.startsWith("%PDF-")) {
      throw new Error("Not a valid PDF");
    }

    // Use pdf-parse for proper text extraction
    const data = await pdfParse(buffer);

    if (data.text && data.text.trim().length > 0) {
      return data.text.trim();
    } else {
      return "[No extractable text - PDF may be image-based]";
    }
  } catch (error) {
    console.error(`[auditor] PDF extraction error: ${error.message}`);
    return `[PDF extraction failed: ${error.message}]`;
  }
}

// ---------------------------------------------------------------------------
// IPFS fetch with gateway fallback
// ---------------------------------------------------------------------------
async function fetchFromIPFS(cid) {
  for (const gateway of GATEWAYS) {
    const url = gateway + '/ipfs/' + cid;
    try {
      const buffer = await httpGet(url);
      return buffer;
    } catch (err) {
      console.warn(`[auditor] Gateway ${gateway} failed for ${cid}: ${err.message}`);
    }
  }
  throw new Error(`All gateways failed for CID ${cid}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Caching layer
// ---------------------------------------------------------------------------
function getCachedText(cid) {
  const cacheFile = path.join(CACHE_DIR, `${cid}.txt`);
  if (fs.existsSync(cacheFile)) {
    return fs.readFileSync(cacheFile, "utf-8");
  }
  return null;
}

function setCachedText(cid, text) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, `${cid}.txt`), text, "utf-8");
}

// ---------------------------------------------------------------------------
// NVIDIA NIM API call (OpenAI‑compatible endpoint)
// ---------------------------------------------------------------------------
async function callNVIDIA(prompt, options = {}) {
  if (!NVIDIA_API_KEY) throw new Error("NVIDIA_API_KEY is not set");

  const body = JSON.stringify({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: options.max_tokens || 2000,
    temperature: options.temperature || 0.1,
    stream: false,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      `${NVIDIA_API_BASE}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`NVIDIA API error ${res.statusCode}: ${data}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices[0].message.content);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Forensic prompt template
// ---------------------------------------------------------------------------
function buildPrompt(assetId, expectedHash, actualHash, status, deedText) {
  return `You are a forensic auditor. Analyze this property deed document text and compare it to the expected cryptographic hash: ${expectedHash}.

The current status is: ${status} (fresh means hash matches, mismatch means potential tampering).

Highlight any discrepant clauses, legal issues, or irregularities that could affect tokenization or RWA security. Focus on property description, vesting, encumbrances, and title validity.

Produce a two-paragraph summary suitable for an issuer’s legal team, including recommendations if issues are found.

Document text:
${deedText.slice(0, 8000)}`;
}

// ---------------------------------------------------------------------------
// Main audit routine
// ---------------------------------------------------------------------------
async function runAudit() {
  console.log("[auditor] Starting ghost‑risk audit...");

  // 1. Load prover state
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error("Prover state file not found. Run fetcher first.");
  }
  const proverState = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  if (
    !proverState.results ||
    !Array.isArray(proverState.results) ||
    proverState.results.length === 0
  ) {
    throw new Error("No prover results. Run fetcher first.");
  }

  // 2. Prepare report
  let report = `# ProofBridge Liner - Ghost-Risk Audit Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;

  // 3. Process each asset
  for (const result of proverState.results) {
    const { assetId, ipfsCid, expectedHash, actualHash, status } = result;
    console.log(`[auditor] Processing asset ${assetId} (${status})...`);

    // Get deed text (cached or fetch)
    let deedText = getCachedText(ipfsCid);
    if (!deedText) {
      try {
        const pdfBuffer = await fetchFromIPFS(ipfsCid);
        deedText = await extractTextFromPDF(pdfBuffer);
        setCachedText(ipfsCid, deedText);
      } catch (err) {
        console.error(
          `[auditor] Failed to fetch/extract text for ${ipfsCid}: ${err.message}`
        );
        deedText = `[Error: ${err.message}]`;
      }
    }

    // AI analysis
    let aiAnalysis = "";
    if (NVIDIA_API_KEY && deedText && deedText.length > 10 && !deedText.startsWith("[")) {
      const prompt = buildPrompt(
        assetId,
        expectedHash,
        actualHash,
        status,
        deedText
      );
      try {
        aiAnalysis = await callNVIDIA(prompt);
      } catch (err) {
        console.error(`[auditor] AI call failed for ${assetId}: ${err.message}`);
        aiAnalysis = "_AI analysis unavailable due to API error._";
      }
    } else {
      aiAnalysis = "_AI analysis skipped: missing API key or no extractable text._";
    }

    // Append to report
    report += `## Asset ID: ${assetId}\n\n`;
    report += `**Status:** ${status}\n`;
    report += `**Expected Hash:** ${expectedHash}\n`;
    report += `**Actual Hash:** ${actualHash}\n`;
    report += `**IPFS CID:** ${ipfsCid}\n\n`;
    report += `${aiAnalysis}\n\n`;
  }

  // 4. Write report
  const reportDir = path.dirname(AUDIT_REPORT);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(AUDIT_REPORT, report, "utf-8");
  console.log(`[auditor] Report written to ${AUDIT_REPORT}`);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
runAudit()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`[auditor] Fatal: ${err.message}`);
    process.exit(1);
  });