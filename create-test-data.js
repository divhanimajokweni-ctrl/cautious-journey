const fs = require('fs');
const path = require('path');

// Create a test state with sample deed text
const testState = {
  runAt: new Date().toISOString(),
  results: [
    {
      assetId: "0x52aa9c8c3e83a0f1f4f73b1f4d0f2c4a4b3a2d1c0e9d8c7b6a5948372615040f",
      ipfsCid: "bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354",
      expectedHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      actualHash: "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      status: "fresh",
      gateway: "https://ipfs.io/ipfs/",
      bytes: 1985,
      error: null,
      durationMs: 100,
      checkedAt: new Date().toISOString()
    }
  ],
  summary: {
    total: 1,
    fresh: 1,
    mismatch: 0,
    unreachable: 0
  }
};

// Create test directory
const testDir = path.join(__dirname, 'test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Write test state
const statePath = path.join(testDir, 'test-prover-state.json');
fs.writeFileSync(statePath, JSON.stringify(testState, null, 2));

// Create sample deed text file
const sampleDeedText = `PROPERTY DEED DOCUMENT

Property Address: 123 Blockchain Street, Crypto City, CC 12345

Legal Description:
This deed conveys all right, title, and interest in the real property located at 123 Blockchain Street, Crypto City, including all improvements thereon.

Grantor: RealT Property LLC
Grantee: Tokenized Real Estate Trust

Consideration: $100,000.00

This property is subject to the following encumbrances:
- First mortgage in the amount of $75,000.00
- Property taxes for 2024
- HOA fees of $200.00 per month

Title Guarantee: The grantor warrants good title to the property, subject to the exceptions noted above.

Executed this 15th day of April, 2024.

[Signature]
John Doe, Authorized Representative

NOTARY PUBLIC
State of Michigan
County of Wayne

This document was acknowledged before me on April 15, 2024 by John Doe.

[Notary Seal]`;

const textPath = path.join(testDir, 'sample-deed-text.txt');
fs.writeFileSync(textPath, sampleDeedText);

console.log('✅ Test files created:');
console.log(`📄 State: ${statePath}`);
console.log(`📖 Text: ${textPath}`);
console.log(`📏 Sample text length: ${sampleDeedText.length} characters`);

// Test the auditor condition
const hasApiKey = process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'nvapi-your-key-here';
const hasText = sampleDeedText && sampleDeedText.length > 10 && !sampleDeedText.startsWith('[');

console.log(`🔍 API Key available: ${hasApiKey ? '✅' : '❌'}`);
console.log(`📄 Text extractable: ${hasText ? '✅' : '❌'}`);
console.log(`🤖 AI analysis would run: ${hasApiKey && hasText ? '✅ YES' : '❌ NO - ' + (!hasApiKey ? 'missing API key' : 'no text')}`);