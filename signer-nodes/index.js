const express = require('express');
const { ethers } = require('ethers');

const app = express();
app.use(express.json());

const SIGNER_ID = process.env.SIGNER_ID || '1';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY not set');
  process.exit(1);
}

const wallet = new ethers.Wallet(PRIVATE_KEY);
console.log(`Signer ${SIGNER_ID} started. Address: ${wallet.address}`);

app.post('/sign', async (req, res) => {
  const { digest } = req.body;
  if (!digest) return res.status(400).json({ error: 'missing digest' });
  const sig = await wallet.signMessage(ethers.getBytes(digest));
  res.json({ sig, signer: wallet.address });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Signer ${SIGNER_ID} listening on port ${PORT}`));