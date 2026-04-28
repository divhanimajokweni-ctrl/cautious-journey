#!/bin/bash
# test-pdf-extraction.sh

echo "=== PDF Extraction Test ==="

# Load environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check API key (optional for PDF test)
if [ -z "$NVIDIA_API_KEY" ] || [ "$NVIDIA_API_KEY" = "nvapi-your-key-here" ]; then
    echo "⚠️  NVIDIA_API_KEY not set (but not required for PDF extraction test)"
else
    echo "✅ NVIDIA_API_KEY is set"
fi

# Test basic extraction
echo "Testing PDF extraction..."
node -e "
const fs = require('fs');
const pdfParse = require('pdf-parse');
const https = require('https');

async function testExtraction() {
  try {
    // Test with the IPFS CID from prover state
    const cid = 'bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354';
    const url = 'https://ipfs.io/ipfs/' + cid;

    console.log('Fetching PDF from IPFS...');
    const buffer = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          const redirectUrl = res.headers.location;
          console.log(\`Redirecting to \${redirectUrl}\`);
          https.get(redirectUrl, (res2) => {
            if (res2.statusCode !== 200) {
              reject(new Error(\`HTTP \${res2.statusCode} after redirect\`));
              return;
            }
            const chunks = [];
            res2.on('data', chunk => chunks.push(chunk));
            res2.on('end', () => resolve(Buffer.concat(chunks)));
          }).on('error', reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(\`HTTP \${res.statusCode}\`));
          return;
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });

    console.log(\`Downloaded \${buffer.length} bytes\`);

    const data = await pdfParse(buffer);
    console.log(\`Extracted \${data.text.length} characters of text\`);
    console.log('First 200 characters:', data.text.substring(0, 200));
    console.log('✅ PDF extraction successful');

  } catch (error) {
    console.error('❌ PDF extraction failed:', error.message);
  }
}

testExtraction();
"