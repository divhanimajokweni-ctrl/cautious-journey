const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createTestPDF() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const fontSize = 12;
  page.setFont(font);
  page.setFontSize(fontSize);

  // Add some test property deed text
  const text = `PROPERTY DEED DOCUMENT

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
John Doe, Authorized Representative`;

  const lines = text.split('\n');
  let y = 700;

  for (const line of lines) {
    page.drawText(line, {
      x: 50,
      y: y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0)
    });
    y -= 20;
  }

  const pdfBytes = await pdfDoc.save();

  // Save to test directory
  const testDir = path.join(__dirname, 'test');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const testPdfPath = path.join(testDir, 'test-deed.pdf');
  fs.writeFileSync(testPdfPath, pdfBytes);

  console.log(`✅ Test PDF created at: ${testPdfPath}`);
  console.log(`📄 PDF size: ${pdfBytes.length} bytes`);

  return testPdfPath;
}

// Test extraction
async function testExtraction(pdfPath) {
  const fs = require('fs');
  const pdfParse = require('pdf-parse');

  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);

  console.log(`📖 Extracted text length: ${data.text.length} characters`);
  console.log('📋 First 300 characters:');
  console.log(data.text.substring(0, 300));
  console.log('...');

  return data.text;
}

// Run the test
async function main() {
  try {
    const pdfPath = await createTestPDF();
    const extractedText = await testExtraction(pdfPath);

    // Test if it passes the auditor's condition
    const hasApiKey = process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY !== 'nvapi-your-key-here';
    const hasText = extractedText && extractedText.length > 10 && !extractedText.startsWith('[');

    console.log(`🔍 API Key available: ${hasApiKey ? '✅' : '❌'}`);
    console.log(`📄 Text extractable: ${hasText ? '✅' : '❌'}`);
    console.log(`🤖 AI analysis would run: ${hasApiKey && hasText ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

main();