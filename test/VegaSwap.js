const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");

describe("VegaSwap", function () {
  async function deployNEB() {
    const [owner, otherAccount] = await ethers.getSigners();
    const StakingBridge = await ethers.getContractFactory("StakingBridge");
    const NebulaToken = await ethers.getContractFactory("NebulaToken");
    const VegaSwap = await ethers.getContractFactory("VegaSwap");
    const VEGA = await ethers.getContractFactory("Vega_2");
    const nebSupply = ethers.parseUnits("10000000000", "ether");
    const nebulaToken = await NebulaToken.deploy("Nebula Token", "NEB", nebSupply, 2, 500, 4);
    const stakingBridge = await StakingBridge.deploy(nebulaToken.target);
    const vegaSupply = ethers.parseUnits("64999723", "ether");
    const vega = await VEGA.deploy(vegaSupply, 0, "Vega Token", "VEGA");
    const blockTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const vegaAllo = ethers.parseUnits("2000000000", "ether");
    const vegaSwap = await VegaSwap.deploy(vega.target, nebulaToken.target, vegaAllo, 5, blockTimestamp + 86400, blockTimestamp + (86400 * 2));
    await nebulaToken.setStakingBridge(stakingBridge.target);
    await nebulaToken.issueTokens(vegaSwap.target, vegaAllo);
    await nebulaToken.addUnlockedAddress(vegaSwap.target);
    return { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount };
  }
  it("should swap VEGA for NEB", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    let ownerVega = await vega.balanceOf(owner.address);
    expect(ownerVega).to.be.equal(ethers.parseUnits("64999723", "ether"));
    await expect(vegaSwap.swap(ownerVega)).to.be.revertedWith("ERC20: transfer amount exceeds allowance");
    await vega.approve(vegaSwap.target, await vega.balanceOf(owner.address));
    expect(await vega.totalSupply(), ethers.parseUnits("64999723", "ether"));
    expect(await nebulaToken.totalSupply(), ethers.parseUnits("10000000000", "ether"));
    await vegaSwap.swap(ownerVega);
    const ownerNeb = await nebulaToken.balanceOf(owner.address);
    ownerVega = await vega.balanceOf(owner.address);
    expect(ownerVega).to.be.equal("0");
    expect(ownerNeb).to.be.equal(ethers.parseUnits("2000000000", "ether"));
  });
  it("should not swap VEGA when swap deadline has passed", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await time.increase(86400);
    await expect(vegaSwap.swap(0)).to.be.revertedWithCustomError(vegaSwap, "VegaDeadlinePassed");
  });
  it("should not permit redemption of leftover NEB when not owner", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    expect (vegaSwap.connect(otherAccount).permitRedemptionOfLeftoverNeb()).to.be.reverted;
    expect(await vegaSwap.redeemLeftoverEnabled()).to.be.equal(false);
  });
  it("should permit redemption of leftover NEB", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await vegaSwap.permitRedemptionOfLeftoverNeb();
    expect(await vegaSwap.redeemLeftoverEnabled()).to.be.equal(true);
  });
  it("should not redeem leftover NEB when disabled", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await expect(vegaSwap.redeemRemainder()).to.be.revertedWithCustomError(vegaSwap, "RedeemLeftoverNotEnabled");
  });
  it("should not redeem leftover NEB when deadline has passed", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await vegaSwap.permitRedemptionOfLeftoverNeb();
    await time.increase(3 * 86400);
    await expect(vegaSwap.redeemRemainder()).to.be.revertedWithCustomError(vegaSwap, "RedeemLeftoverDeadlinePassed");
  });
  it("should not redeem leftover NEB when swap deadline has not passed", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await vegaSwap.permitRedemptionOfLeftoverNeb();
    await expect(vegaSwap.redeemRemainder()).to.be.revertedWithCustomError(vegaSwap, "VegaDeadlinePassed");
  });
  it("should not redeem leftover NEB when user has not swapped VEGA", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await vegaSwap.permitRedemptionOfLeftoverNeb();
    await time.increase(86400);
    await expect(vegaSwap.redeemRemainder()).to.be.revertedWithCustomError(vegaSwap, "IneligibleForLeftoverRedemption");
  });
  it("should redeem leftover NEB", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    await vegaSwap.permitRedemptionOfLeftoverNeb();
    let ownerVega = await vega.balanceOf(owner.address);
    expect(ownerVega).to.be.equal(ethers.parseUnits("64999723", "ether"));
    await vega.transfer(otherAccount.address, ethers.parseUnits("32499861.5", "ether"));
    await vega.connect(otherAccount).approve(vegaSwap.target, ethers.parseUnits("64999723", "ether"));
    await vegaSwap.connect(otherAccount).swap(0);
    otherAccountVega = await vega.balanceOf(otherAccount.address);
    expect(otherAccountVega).to.be.equal(0);
    expect(await nebulaToken.balanceOf(otherAccount.address)).to.be.equal("1000000000000000000000000000");
    await time.increase(86400);
    await vegaSwap.connect(otherAccount).redeemRemainder();
    expect(await nebulaToken.balanceOf(otherAccount.address)).to.be.equal("2000000000000000000000000000");
  });
  it("should calculate leftover NEB as zero when not possible to redeem", async function() {
    const { nebulaToken, vegaSwap, vega, stakingBridge, owner, otherAccount } = await loadFixture(deployNEB);
    expect(await vegaSwap.calculateLeftoverNeb(owner.address)).to.be.equal(0);
    await vegaSwap.permitRedemptionOfLeftoverNeb();
    expect(await vegaSwap.calculateLeftoverNeb(owner.address)).to.be.equal(0);
    await time.increase(86400);
    expect(await vegaSwap.calculateLeftoverNeb(owner.address)).to.be.equal(0);
  });
});