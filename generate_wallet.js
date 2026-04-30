const { ethers } = require('ethers');

const wallet = ethers.Wallet.createRandom();
console.log('Address:', wallet.address);
// Private key not displayed for security reasons