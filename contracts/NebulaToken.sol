// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20, ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StakingBridge} from "./StakingBridge.sol";

/// @title Nebula Token
contract NebulaToken is ERC20, ERC20Permit, Ownable {
    /// @notice Event emitted when minting is enabled or disabled
    /// @param enabled Whether minting is enabled as of the event
    event MintEnabled(bool enabled);
    /// @notice Event emitted when minting is completed for a given year
    /// @param year The year that minting was completed for relative to the initial mint
    /// @param amount The amount of tokens minted
    event MintCompleted(uint256 year, uint256 amount);
    /// @notice Event emitted when the rate of decay of inflation is changed
    /// @param newRate The new rate of decay of inflation
    event InflationDecayRateChanged(uint256 newRate);
    /// @notice Event emitted when NEB is issued to a recipient
    /// @param recipient The address that NEB was issued to
    /// @param amount The amount of NEB issued
    event IssueNeb(address indexed recipient, uint256 amount);
    /// @notice Event emitted when transfers are enabled for all accounts
    event TransfersEnabled();
    /// @notice Event emitted when the staking bridge address is set
    event StakingBridgeSet(address indexed stakingBridge);
    /// @notice Event emitted when an account is unlocked for transfers, effective before transfers are enabled
    /// @param addr The address that is unlocked
    /// @param unlocked Whether the address is unlocked as of the event
    event UnlockAddress(address indexed addr, bool unlocked);
    /// @notice Event emitted when a Nebula public key is registered with an Ethereum address
    /// @param ethKey The Ethereum address that the Nebula public key is registered with
    /// @param nebulaPublicKey The Nebula public key that is registered
    event RegisterNebulaKey(address indexed ethKey, bytes32 indexed nebulaPublicKey);

    /// @notice Error when transfers between locked accounts is disabled
    error TransfersDisabled();
    /// @notice Error when minting according to the inflation schedule is disabled
    error MintDisabled();
    /// @notice Error when minting is attempted before the mint start year
    error MintInPast();
    /// @notice Error when minting is attempted in a future year
    error MintInFuture();
    /// @notice Error when minting has already been completed for a given year
    error MintAlreadyCompleted();
    /// @notice Error when attempting to mint for a year that has not been completed
    /// @param year The year that has not been minted relative to the initial mint
    error MintMissing(uint256 year);
    /// @notice Error when the rate of decay of inflation is set too low. Minimum value is 2
    error InflationDecayRateTooLow();
    /// @notice Error when the staking bridge has already been set
    error StakingBridgeAlreadySet();
    /// @notice Error when the staking rate is exceeded
    /// @param amountStaked The amount of Nebula currently staked
    /// @param maxStake The maximum amount of Nebula that can be staked
    error StakingRateExceeded(uint256 amountStaked, uint256 maxStake);

    /// @notice Nebula staking bridge contract address. Initially unset until deployed and updated by the contract owner
    StakingBridge public stakingBridge;
    /// @notice Amount of NEB that is staked internally from the Nebula treasury
    uint256 public internalStakedNeb;

    /// @notice Whether transfers are enabled for all accounts
    bool public transfersEnabled;
    /// @notice Mapping of addresses that are unlocked for transfers before transfers are enabled
    mapping(address => bool) public isAddressUnlocked;

    /// @notice Timestamp of the initial mint
    uint256 public immutable initialMintTimestamp;
    /// @notice Whether minting is enabled in accordance to the inflation schedule
    bool public mintEnabled;
    /// @notice Year in which minting can start relative to the initial mint
    uint256 public immutable mintStartYear;
    /// @notice Initial rate of inflation expressed as basis points
    uint256 public immutable initialInflationRate;
    /// @notice Rate of decay of inflation, eg. 2 = 50%, 3 = 33%, etc
    uint256 public inflationRateDecay;
    /// @notice Mapping of years to the amount of tokens minted in that year. Years are relative to the initial mint
    mapping(uint256 year => uint256 amount) public completedMints;

    /// @notice Mapping of Ethereum addresses to Nebula public keys
    mapping(address account => bytes32 nebulaPublicKey) public nebulaKeys;

    /// @notice Create Nebula token with predetermined initial supply
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param initialSupply Initial supply of tokens
    /// @param mintStartYear_ Year in which minting can start
    /// @param initialInflationRate_ Initial rate of inflation expressed as basis points
    /// @param inflationRateDecay_ Rate of decay of inflation, eg. 2 = 50%, 3 = 33%, etc
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint256 mintStartYear_,
        uint256 initialInflationRate_,
        uint256 inflationRateDecay_
    ) ERC20(name, symbol) ERC20Permit(name) Ownable(msg.sender) {
        initialMintTimestamp = block.timestamp;
        _mintInitialSupply(initialSupply);

        transfersEnabled = false;

        mintEnabled = false;
        mintStartYear = mintStartYear_;
        initialInflationRate = initialInflationRate_;
        inflationRateDecay = inflationRateDecay_;

        completedMints[0] = initialSupply;
    }

    /// @notice Check if transfers are permitted. Special cases that are always allowed are: the contract itself, minting and the staking bridge
    /// @param from The sending wallet
    /// @param to The receiving wallet
    modifier checkTransferPermitted(address from, address to) {
        if (!(from == address(this) || from == address(0) || transfersEnabled || to == address(stakingBridge))) {
            require(isAddressUnlocked[from], TransfersDisabled());
        }

        _;
    }

    /// @notice Get years since initial mint
    function getYearsSinceInitialMint() public view returns (uint256) {
        return (block.timestamp - initialMintTimestamp) / (86400 * 365);
    }

    /// @notice Mint new tokens in a given year. Years must be minted in order starting from the first year allowed
    /// @param year The year to mint tokens for relative to the initial mint
    function mintNewTokens(uint256 year) public onlyOwner {
        require(mintEnabled, MintDisabled());
        require(year >= mintStartYear, MintInPast());
        require(getYearsSinceInitialMint() >= year, MintInFuture());
        require(completedMints[year] == 0, MintAlreadyCompleted());

        uint256 mintAmount;

        if (year == mintStartYear) {
            mintAmount = completedMints[0] * initialInflationRate / 10000;
        } else {
            require(completedMints[year - 1] > 0, MintMissing(year - 1));
            mintAmount = (completedMints[year - 1] * (inflationRateDecay - 1)) / inflationRateDecay;
        }

        _mint(address(this), mintAmount);
        completedMints[year] = mintAmount;
        emit MintCompleted(year, mintAmount);
    }

    /// @notice Change the rate of decay of inflation
    /// @param inflationRateDecay_ Integer determining the rate of decay of inflation (2 = 50%, 3 = 33%, etc)
    function setInflationRateDecay(uint256 inflationRateDecay_) public onlyOwner {
        require(inflationRateDecay_ > 1, InflationDecayRateTooLow());
        inflationRateDecay = inflationRateDecay_;
        emit InflationDecayRateChanged(inflationRateDecay_);
    }

    /// @notice Enable minting of new tokens
    function enableMint() public onlyOwner {
        mintEnabled = true;
        emit MintEnabled(true);
    }

    /// @notice Disable minting of new tokens
    function disableMint() public onlyOwner {
        mintEnabled = false;
        emit MintEnabled(false);
    }

    /// @notice Set the staking bridge contract address
    /// @param stakingBridgeAddr staking bridge contract address
    function setStakingBridge(address stakingBridgeAddr) public onlyOwner {
        require(address(stakingBridge) == address(0), StakingBridgeAlreadySet());
        stakingBridge = StakingBridge(stakingBridgeAddr);
        isAddressUnlocked[stakingBridgeAddr] = true; // Allow unstaking
        emit StakingBridgeSet(stakingBridgeAddr);
    }

    /// @notice Issue tokens to recipient
    /// @param recipient Recipient of issued tokens
    /// @param amount Amount of tokens to issue
    function issueTokens(address recipient, uint256 amount) public onlyOwner {
        _update(address(this), recipient, amount);
        emit IssueNeb(recipient, amount);
    }

    /// @notice Whitelist an address that can send tokens while the token is locked
    /// @param addr Permitted sender address
    function addUnlockedAddress(address addr) public onlyOwner {
        isAddressUnlocked[addr] = true;
        emit UnlockAddress(addr, true);
    }

    /// @notice Remove an address from the whitelist of addresses that can send tokens while the token is locked
    /// @param addr Permitted sender address
    function removeUnlockedAddress(address addr) public onlyOwner {
        isAddressUnlocked[addr] = false;
        emit UnlockAddress(addr, false);
    }

    /// @notice Enabled transfersd
    function enableTransfers() public onlyOwner {
        transfersEnabled = true;
        emit TransfersEnabled();
    }

    /// @notice Proxy function to allow unissued NEB to be staked
    /// @param pubKey Nebula public key
    /// @param amount Amount of tokens to stake
    function stake(bytes32 pubKey, uint256 amount) public onlyOwner {
        uint256 maxStake = (totalSupply() * 67000) / 100000;
        require(internalStakedNeb + amount < maxStake, StakingRateExceeded(internalStakedNeb, maxStake));
        stakingBridge.stake(amount, pubKey);
        internalStakedNeb += amount;
    }

    /// @notice Allow the staking bridge to transfer NEB held in the NEB contract
    function approveStakingBridge() public onlyOwner {
        _approve(address(this), address(stakingBridge), type(uint256).max);
    }

    /// @notice Revoke staking bridge ability to transfer NEB held in NEB contract
    function revokeStakingBridgeAllowance() public onlyOwner {
        _approve(address(this), address(stakingBridge), 0);
    }

    /// @notice Proxy function to allow unissued NEB to be unstaked
    /// @param pubKey Nebula public key
    /// @param amount Amount of tokens to unstake
    function removeStake(bytes32 pubKey, uint256 amount) public onlyOwner {
        stakingBridge.removeStake(amount, pubKey);
        internalStakedNeb -= amount;
    }

    /// @notice Register Nebula pub key with Ethereum address
    /// @param nebulaPublicKey Nebula public key
    function registerNebulaKey(bytes32 nebulaPublicKey) public {
        nebulaKeys[msg.sender] = nebulaPublicKey;
        emit RegisterNebulaKey(msg.sender, nebulaPublicKey);
    }

    /// @notice Mint initial supply and assign to token contract
    /// @param initialSupply Initial supply of tokens
    function _mintInitialSupply(uint256 initialSupply) internal {
        super._mint(address(this), initialSupply);
    }

    /// @notice Custom locking for transfer function
    /// @param from Sending address
    /// @param to Recipient address
    /// @param value Transfer amount
    function _update(address from, address to, uint256 value)
        internal
        virtual
        override(ERC20)
        checkTransferPermitted(from, to)
    {
        super._update(from, to, value);
    }
}
