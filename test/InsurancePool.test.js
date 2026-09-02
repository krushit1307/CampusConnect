const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("Parametric Insurance Flash-Loan Arbitrage Mitigation Suite", function () {
  let InsurancePool, pool, MockToken, token, owner, attacker, payoutGuarantee;

  beforeEach(async function () {
    [owner, attacker] = await ethers.getSigners();

    // Deploy Mock ERC20 Token for premium funding transfers
    MockToken = await ethers.getContractFactory("MockERC20");
    token = await MockToken.deploy("Mock USDC", "USDC", ethers.parseEther("10000000"));
    await token.waitForDeployment();

    // Deploy core Parametric Insurance Pool
    InsurancePool = await ethers.getContractFactory("ParametricInsurancePool");
    pool = await InsurancePool.deploy(await token.getAddress());
    await pool.waitForDeployment();

    // Fund the pool to guarantee liquidity reserves
    await token.transfer(await pool.getAddress(), ethers.parseEther("500000"));
    // Fund attacker with premium balance
    await token.transfer(attacker.address, ethers.parseEther("10000"));
    await token.connect(attacker).approve(await pool.getAddress(), ethers.parseEther("10000"));
  });

  test("Should actively block payout request if attempted within the same atomic block execution trace", async function () {
    const premium = ethers.parseEther("1000");
    const payout = ethers.parseEther("50000");

    // Attacker purchases policy
    await pool.connect(attacker).purchasePolicy(premium, payout);

    // Attacker attempts to claim immediately (simulating flash-loan atomic execution block step)
    const mockOracleSig = "0x01020304";
    await expect(
      pool.connect(attacker).claimParametricPayout(0, mockOracleSig)
    ).to.be.revertedWith("Policy is locked: Activation delay period active");
  });

  test("Should cleanly approve payout validation checks once the 72-hour delay threshold elapses", async function () {
    const premium = ethers.parseEther("1000");
    const payout = ethers.parseEther("50000");

    await pool.connect(attacker).purchasePolicy(premium, payout);

    // Fast-forward Evm state network time by exactly 72 hours + 1 second
    await time.increase(72 * 3600 + 1);

    const mockOracleSig = "0x01020304";
    await expect(
      pool.connect(attacker).claimParametricPayout(0, mockOracleSig)
    ).to.emit(pool, "ClaimPaid");
  });
});
