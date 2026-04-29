#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns for common secrets
const secretPatterns = [
  /nvapi-[a-zA-Z0-9_-]{40,}/,  // NVIDIA API keys
  /sk-[a-zA-Z0-9_-]{40,}/,     // OpenAI keys
  /hf_[a-zA-Z0-9_-]{40,}/,     // Hugging Face tokens
  /[a-zA-Z0-9_-]{32,}@github/, // GitHub tokens (basic)
  /xoxb-[0-9]+-[0-9]+-[a-zA-Z0-9_-]+/, // Slack tokens
  /[a-zA-Z0-9_-]{64}/,         // Generic long keys (adjust as needed)
];

// Files to skip (contain legitimate hashes)
const skipFiles = ['package-lock.json', 'yarn.lock', 'node_modules/**', 'demo/audit-realT.md', 'fetcher-audit.md', 'phase-4-gateway-quorum-summary.md', 'prover/scorer.js'];

// Get staged files
try {
  const output = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  const files = output.trim().split('\n').filter(f => f);

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    if (skipFiles.some(skip => file.includes(skip))) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        // Allow known placeholders
        if (content.includes('your-key-here') || content.includes('REMOVED_KEY')) continue;
        console.error(`❌ Potential secret detected in ${file} matching pattern: ${pattern}`);
        console.error('Commit blocked. Remove the secret or use environment variables.');
        process.exit(1);
      }
    }
  }

  console.log('✅ No secrets detected in staged files.');
} catch (error) {
  console.error('Error checking for secrets:', error.message);
  process.exit(1);
}