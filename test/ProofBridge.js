const { expect } = require("chai");

describe("ProofBridge Liner", function () {
  let scorer, kernel, token, verifier;
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const BayesianScorer = await ethers.getContractFactory("BayesianScorer");
    scorer = await BayesianScorer.deploy();

    const SafetyKernel = await ethers.getContractFactory("SafetyKernel");
    kernel = await SafetyKernel.deploy(owner.address, scorer.address);

    const TEEVerifier = await ethers.getContractFactory("TEEVerifier");
    const expectedHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
    verifier = await TEEVerifier.deploy(kernel.address, expectedHash);

    const SafeERC20 = await ethers.getContractFactory("SafeERC20");
    token = await SafeERC20.deploy("SafeToken", "STK", kernel.address);
  });

  it("Should deploy and check Bayesian scorer", async function () {
    const posterior = await scorer.computePosterior(40, 0); // high successes
    expect(posterior).to.be.gt(8000); // >80%

    const valid = await scorer.isValid(40, 0, 8000);
    expect(valid).to.be.true;
  });

  it("Should halt on low posterior", async function () {
    await kernel.check(7000, 8000); // 70% < 80%, halt
    expect(await kernel.state()).to.equal(1); // HALTED
  });

  it("Should allow transfer when open", async function () {
    await token.transfer(owner.address, 100); // self transfer
    // Should not revert
  });

  it("Should block transfer when halted", async function () {
    await kernel.check(7000, 8000);
    await expect(token.transfer(owner.address, 100)).to.be.revertedWith("Kernel is halted");
  });

  it("Should reset by authorized", async function () {
    await kernel.check(7000, 8000);
    await kernel.reset();
    expect(await kernel.state()).to.equal(0); // OPEN
  });
});