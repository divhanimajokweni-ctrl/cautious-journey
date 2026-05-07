const { ethers } = require("hardhat");

async function main() {
  // Deploy BayesianScorer (library)
  const BayesianScorer = await ethers.getContractFactory("BayesianScorer");
  const scorer = await BayesianScorer.deploy();
  await scorer.deployed();
  console.log("BayesianScorer deployed to:", scorer.address);

  // Deploy SafetyKernel with authorized actor and scorer address
  const [deployer] = await ethers.getSigners();
  const SafetyKernel = await ethers.getContractFactory("SafetyKernel");
  const kernel = await SafetyKernel.deploy(deployer.address, scorer.address);
  await kernel.deployed();
  console.log("SafetyKernel deployed to:", kernel.address);

  // Deploy TEEVerifier with kernel and dummy expected hash
  const expectedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("dummy"));
  const TEEVerifier = await ethers.getContractFactory("TEEVerifier");
  const verifier = await TEEVerifier.deploy(kernel.address, expectedHash);
  await verifier.deployed();
  console.log("TEEVerifier deployed to:", verifier.address);

  // Deploy SafeERC20 with kernel
  const SafeERC20 = await ethers.getContractFactory("SafeERC20");
  const token = await SafeERC20.deploy("SafeToken", "STK", kernel.address);
  await token.deployed();
  console.log("SafeERC20 deployed to:", token.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});