const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("NebulaToken", function() {
  async function deployNEB() {
    const [owner, otherAccount] = await ethers.getSigners();
    const StakingBridge = await ethers.getContractFactory("StakingBridge");
    const NebulaToken = await ethers.getContractFactory("NebulaToken");
    const nebSupply = ethers.parseUnits("10000000000", "ether");
    const nebulaToken = await NebulaToken.deploy("Nebula Token", "NEB", nebSupply, 2, 500, 4);
    const stakingBridge = await StakingBridge.deploy(nebulaToken.target);
    await nebulaToken.setStakingBridge(stakingBridge.target);
    return { nebulaToken, stakingBridge, owner, otherAccount };
  }
  it("should mint initial supply", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const nebSupply = Number(ethers.formatEther(await nebulaToken.balanceOf(nebulaToken.target)));
    expect(nebSupply).to.be.equal(10000000000);
    expect(await nebulaToken.transfersEnabled(), false);
    expect(await nebulaToken.owner(), owner.address);
  });
  it("should not set staking bridge when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).setStakingBridge(stakingBridge.target)).to.be.reverted;
  });
  it("should not set staking bridge more than once", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.setStakingBridge(stakingBridge.target)).to.be.revertedWithCustomError(nebulaToken, "StakingBridgeAlreadySet");
  });
  it("should not enable transfers when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).enableTransfers()).to.be.reverted;
    expect(await nebulaToken.transfersEnabled(), false);
  });
  it("should enable transfers", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await time.increase(86400);
    await nebulaToken.enableTransfers();
    expect(await nebulaToken.transfersEnabled(), true);
  });
  it("should add unlocked address", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.addUnlockedAddress(nebulaToken.target);
    expect(await nebulaToken.isAddressUnlocked(owner.address), false);
    expect(await nebulaToken.isAddressUnlocked(nebulaToken.target), true);
  });
  it("should not add unlocked address when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).addUnlockedAddress(nebulaToken.target)).to.be.reverted;
  });
  it("should remove unlocked address", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.addUnlockedAddress(nebulaToken.target);
    expect(await nebulaToken.isAddressUnlocked(owner.address), false);
    expect(await nebulaToken.isAddressUnlocked(nebulaToken.target), true);
    await nebulaToken.removeUnlockedAddress(nebulaToken.target);
    expect(await nebulaToken.isAddressUnlocked(nebulaToken.target), false);
  });
  it("should not remove unlocked address when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).removeUnlockedAddress(nebulaToken.target)).to.be.reverted;
  });
  it("should issue tokens", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const issueAmount = ethers.parseUnits("1000000000", "ether");
    await nebulaToken.issueTokens(otherAccount.address, issueAmount);
    const nebContractBalance = Number(ethers.formatEther(await nebulaToken.balanceOf(nebulaToken.target)));
    const receiverBalance = Number(ethers.formatEther(await nebulaToken.balanceOf(otherAccount.address)));
    expect(nebContractBalance).to.be.equal(9000000000);
    expect(receiverBalance).to.be.equal(1000000000);
  });
  it("should not issue tokens when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const issueAmount = ethers.parseUnits("1000000000", "ether");
    await expect(nebulaToken.connect(otherAccount).issueTokens(otherAccount.address, issueAmount)).to.be.reverted;
  });
  it("should not transfer NEB while user not permitted", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const issueAmount = ethers.parseUnits("1000000000", "ether");
    await nebulaToken.issueTokens(otherAccount.address, issueAmount);
    await expect(nebulaToken.connect(otherAccount).transfer(owner.address, issueAmount)).to.be.revertedWithCustomError(nebulaToken, "TransfersDisabled");
  });
  it("should transfer NEB when permitted while locked", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const issueAmount = ethers.parseUnits("1000000000", "ether");
    await nebulaToken.issueTokens(otherAccount.address, issueAmount);
    await nebulaToken.addUnlockedAddress(otherAccount.address);
    await nebulaToken.connect(otherAccount).transfer(owner.address, issueAmount);
    const ownerNeb = Number(ethers.formatEther(await nebulaToken.balanceOf(owner.address)));
    const otherAccountNeb = Number(ethers.formatEther(await nebulaToken.balanceOf(otherAccount.address)));
    expect(ownerNeb).to.be.equal(1000000000);
    expect(otherAccountNeb).to.be.equal(0);
  });
  it("should register Nebula key", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const key = "0xce69ab9250568cbdaa432afdb11ad933e3e0e70715cb74029bb98d1a76b4a7bf";
    const pubKey = ethers.getBytes(key);
    await nebulaToken.registerNebulaKey(pubKey);
    expect(ethers.hexlify(await nebulaToken.nebulaKeys(owner.address)), key);
  });
  it("should not stake more than 67% of total NEB supply", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const key = "0xce69ab9250568cbdaa432afdb11ad933e3e0e70715cb74029bb98d1a76b4a7bf";
    const pubKey = ethers.getBytes(key);
    const stakeAmount = ethers.parseUnits("6700000001", "ether");
    await expect(nebulaToken.stake(pubKey, stakeAmount)).to.be.revertedWithCustomError(nebulaToken, "StakingRateExceeded");
  });
  it("should stake and unstake unissued NEB", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const key = "0xce69ab9250568cbdaa432afdb11ad933e3e0e70715cb74029bb98d1a76b4a7bf";
    const pubKey = ethers.getBytes(key);
    const stakeAmount = ethers.parseUnits("5000000000", "ether");
    await expect(nebulaToken.stake(pubKey, stakeAmount)).to.be.reverted;
    await nebulaToken.approveStakingBridge();
    await nebulaToken.stake(pubKey, stakeAmount);
    let stakedNeb = Number(ethers.formatEther(await nebulaToken.balanceOf(stakingBridge.target)));
    let unissuedNeb = Number(ethers.formatEther(await nebulaToken.balanceOf(nebulaToken.target)));
    expect(stakedNeb).to.be.equal(5000000000);
    expect(unissuedNeb).to.be.equal(5000000000);
    await nebulaToken.addUnlockedAddress(stakingBridge.target);
    await nebulaToken.removeStake(pubKey, stakeAmount);
    stakedNeb = Number(ethers.formatEther(await nebulaToken.balanceOf(stakingBridge.target)));
    unissuedNeb = Number(ethers.formatEther(await nebulaToken.balanceOf(nebulaToken.target)));
    expect(stakedNeb).to.be.equal(0);
    expect(unissuedNeb).to.be.equal(10000000000);
  });
  it("should not stake unissued NEB when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const key = "0xce69ab9250568cbdaa432afdb11ad933e3e0e70715cb74029bb98d1a76b4a7bf";
    const pubKey = ethers.getBytes(key);
    const stakeAmount = ethers.parseUnits("5000000000", "ether");
    await expect(nebulaToken.connect(otherAccount).stake(pubKey, stakeAmount)).to.be.reverted;
  });
  it("should not unstake unissued NEB when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    const key = "0xce69ab9250568cbdaa432afdb11ad933e3e0e70715cb74029bb98d1a76b4a7bf";
    const pubKey = ethers.getBytes(key);
    const stakeAmount = ethers.parseUnits("5000000000", "ether");
    await expect(nebulaToken.connect(otherAccount).removeStake(pubKey, stakeAmount)).to.be.reverted;
  });
  it("should not approve staking bridge when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).approveStakingBridge()).to.be.reverted;
  });
  it("should revoke staking bridge spending allowance", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.approveStakingBridge();
    expect(await nebulaToken.allowance(nebulaToken.target, stakingBridge.target)).to.be.above(1000000000000);
    await nebulaToken.revokeStakingBridgeAllowance();
    expect(await nebulaToken.allowance(nebulaToken.target, stakingBridge.target)).to.be.equal(0);
  });
  it("should not revoke staking bridge allowance when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).revokeStakingBridgeAllowance()).to.be.reverted;
  });
  it("should get years since initial mint", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    let years = await nebulaToken.getYearsSinceInitialMint();
    expect(years).to.be.equal(0);
    await time.increase(86400 * 365);
    years = await nebulaToken.getYearsSinceInitialMint();
    expect(years).to.be.equal(1);
    await time.increase(86400 * 365);
    years = await nebulaToken.getYearsSinceInitialMint();
    expect(years).to.be.equal(2);
    await time.increase(86400 * 365);
    years = await nebulaToken.getYearsSinceInitialMint();
    expect(years).to.be.equal(3);
    await time.increase(86400 * 365);
    years = await nebulaToken.getYearsSinceInitialMint();
    expect(years).to.be.equal(4);
    await time.increase(86400 * 365);
    years = await nebulaToken.getYearsSinceInitialMint();
    expect(years).to.be.equal(5);
  });
  it("should enable and disable inflation", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    expect(await nebulaToken.mintEnabled()).to.be.equal(false);
    await nebulaToken.enableMint();
    expect(await nebulaToken.mintEnabled()).to.be.equal(true);
    await nebulaToken.disableMint();
    expect(await nebulaToken.mintEnabled()).to.be.equal(false);
  });
  it("should not enable inflation when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).enableMint()).to.be.reverted;
  });
  it("should not disable inflation when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).disableMint()).to.be.reverted;
  });
  it("should set inflation rate decay", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    expect(await nebulaToken.inflationRateDecay()).to.be.equal(4);
    await nebulaToken.setInflationRateDecay(5);
    expect(await nebulaToken.inflationRateDecay()).to.be.equal(5);
  });
  it("should not set inflation rate decay when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.connect(otherAccount).setInflationRateDecay(2)).to.be.reverted;
  });
  it("should not set inflation rate decay to zero", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.setInflationRateDecay(0)).to.be.revertedWithCustomError(nebulaToken, "InflationDecayRateTooLow");
  });
  it("should not mint new tokens when inflation is disabled", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(nebulaToken.mintNewTokens(2)).to.be.revertedWithCustomError(nebulaToken, "MintDisabled");
  });
  it("should not mint new tokens when skipping a year", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.enableMint();
    await time.increase(86400 * 365 * 3);
    await expect(nebulaToken.mintNewTokens(3)).to.be.revertedWithCustomError(nebulaToken, "MintMissing");
  });
  it("should not mint new tokens before starting year", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.enableMint();
    await expect(nebulaToken.mintNewTokens(1)).to.be.revertedWithCustomError(nebulaToken, "MintInPast");
  });
  it("should not mint new tokens before starting year", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.enableMint();
    await expect(nebulaToken.mintNewTokens(2)).to.be.revertedWithCustomError(nebulaToken, "MintInFuture");
  });
  it("should not mint new tokens when mint is already completed", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.enableMint();
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(2);
    await expect(nebulaToken.mintNewTokens(2)).to.be.revertedWithCustomError(nebulaToken, "MintAlreadyCompleted");
  });
  it("should not mint new tokens when not owner", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.enableMint();
    await expect(nebulaToken.connect(otherAccount).mintNewTokens(2)).to.be.reverted;
  });
  it("should mint new tokens", async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await nebulaToken.enableMint();
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(2);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(10500000000);
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(3);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(10875000000);
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(4);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(11156250000);
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(5);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(11367187500);
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(6);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(11525390625);
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(7);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(11644042968.75);
    await time.increase(86400 * 365 * 2);
    await nebulaToken.mintNewTokens(8);
    expect(Number(ethers.formatEther(await nebulaToken.totalSupply()))).to.be.equal(11733032226.5625);
  });
  it('should allow otherAccount to stake during the locked period', async function() {
    const { nebulaToken, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);

    const nebAmount = ethers.parseUnits("1000", "ether");

    await nebulaToken.connect(owner).issueTokens(otherAccount.address, nebAmount);

    const pubKey = ethers.getBytes("0xce69ab9250568cbdaa432afdb11ad933e3e0e70715cb74029bb98d1a76b4a7bf");

    await nebulaToken.connect(otherAccount).approve(stakingBridge.target, nebAmount);
    await stakingBridge.connect(otherAccount).stake(nebAmount, pubKey);

    const stakedBalance = await stakingBridge.stakeBalance(otherAccount, pubKey)

    expect(stakedBalance).to.be.equal(nebAmount)

    await stakingBridge.connect(otherAccount).removeStake(nebAmount, pubKey)

    const postStakingBalance = await stakingBridge.stakeBalance(otherAccount, pubKey)

    expect(postStakingBalance).to.be.equal(0n)
  })
});
