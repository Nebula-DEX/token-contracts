// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title VegaSwap
/// @notice Contract for swapping VEGA for NEB
contract VegaSwap is Ownable {
    using SafeERC20 for IERC20;

    /// @notice Event emitted when VEGA is swapped for NEB
    /// @param sender The address that burned VEGA for NEB
    /// @param vegaAmount The amount of VEGA that was burned
    event SwapVega(address indexed sender, uint256 vegaAmount);
    /// @notice Event emitted when leftover NEB is redeemed
    /// @param recipient The address that redeemed leftover NEB
    /// @param nebulaAmount The amount of NEB that was redeemed
    event RedeemLeftoverNebula(address indexed recipient, uint256 nebulaAmount);

    /// @notice Error before redemption of leftover NEB is enabled
    error RedeemLeftoverNotEnabled();
    /// @notice Error if deadline for VEGA swap has passed
    error VegaDeadlinePassed();
    /// @notice Error if deadline for leftover NEB redemption has not begun
    error RedeemLeftoverNotStarted();
    /// @notice Error if deadline for leftover NEB redemption has passed
    error RedeemLeftoverDeadlinePassed();
    /// @notice Error if account is not eligible for leftover NEB redemption, ie. never swapped VEGA or already redeemed leftover NEB
    error IneligibleForLeftoverRedemption();

    /// @notice The VEGA token contract
    IERC20 public immutable vegaToken;
    /// @notice The NEB token contract
    IERC20 public immutable nebulaToken;

    /// @notice The total amount of NEB allocated for the swap program
    uint256 public immutable nebulaAllocation;

    /// @notice The total supply of VEGA tokens (cached for efficiency)
    uint256 public immutable vegaTotalSupply;
    /// @notice The maximum dilution ratio for the swap program between VEGA and NEB
    uint8 public immutable maxDilutionRatio;

    /// @notice The deadline for swapping VEAG for NEB
    uint256 public immutable vegaSwapDeadline;
    /// @notice The deadline for redeeming leftover NEB
    uint256 public immutable nebulaLeftoverDeadline;

    /// @notice The total amount of VEGA swapped for NEB
    uint256 public vegaTotalSwapped;
    /// @notice The total amount of NEB swapped
    uint256 public nebulaTotalSwapped;

    /// @notice The amount of VEGA swapped by each account
    mapping(address account => uint256 amount) public vegaSwapped;
    /// @notice The amount of NEB swapped by each account
    mapping(address account => uint256 amount) public nebulaSwapped;
    /// @notice Whether each account is eligible to redeeming leftover NEB
    mapping(address account => bool elegible) public canRedeemLeftover;

    /// @notice Whether redemption of leftover NEB is enabled
    bool public redeemLeftoverEnabled;

    /// @notice Construct a new VegaSwap contract, burning VEGA for NEB
    /// @param vegaToken_ The address of the VEGA token contract
    /// @param nebulaToken_ The address of the NEB token contract
    /// @param nebulaAllocation_ The total amount of NEB allocated for the swap program
    /// @param maxDilutionRatio_ The maximum dilution ratio for the swap program between VEGA and NEB
    /// @param vegaSwapDeadline_ The deadline for swapping VEGA for NEB
    /// @param nebulaLeftoverDeadline_ The deadline for redeeming leftover NEB
    constructor(
        address vegaToken_,
        address nebulaToken_,
        uint256 nebulaAllocation_,
        uint8 maxDilutionRatio_,
        uint256 vegaSwapDeadline_,
        uint256 nebulaLeftoverDeadline_
    ) Ownable(msg.sender) {
        vegaToken = IERC20(vegaToken_);
        nebulaToken = IERC20(nebulaToken_);

        nebulaAllocation = nebulaAllocation_;
        vegaTotalSupply = vegaToken.totalSupply();
        maxDilutionRatio = maxDilutionRatio_;

        vegaSwapDeadline = vegaSwapDeadline_;
        nebulaLeftoverDeadline = nebulaLeftoverDeadline_;
    }

    /// @notice Permit the redemption of leftover NEB
    function permitRedemptionOfLeftoverNeb() public onlyOwner {
        redeemLeftoverEnabled = true;
    }

    /// @notice Swap VEGA for NEB
    /// @param amount The amount of VEGA to swap. If 0, the full balance of the caller is swapped.
    function swap(uint256 amount) external {
        require(block.timestamp < vegaSwapDeadline, VegaDeadlinePassed());

        if (amount == 0) {
            amount = vegaToken.balanceOf(msg.sender);
        }

        vegaToken.safeTransferFrom(msg.sender, address(this), amount);

        vegaSwapped[msg.sender] += amount;
        vegaTotalSwapped += amount;

        uint256 nebulaAmount = calculateRedeemableNeb(amount);
        nebulaToken.safeTransfer(msg.sender, nebulaAmount);

        nebulaTotalSwapped += nebulaAmount;
        nebulaSwapped[msg.sender] += nebulaAmount;
        canRedeemLeftover[msg.sender] = true;

        emit SwapVega(msg.sender, amount);
    }

    /// @notice Redeem leftover NEB from initial allocation. This is distributed pro rata to VEGA holders who have swapped VEGA for NEB, based on the initial allocation that was not swapped before the deadline
    function redeemRemainder() external {
        require(redeemLeftoverEnabled, RedeemLeftoverNotEnabled());
        require(block.timestamp >= vegaSwapDeadline, VegaDeadlinePassed());
        require(block.timestamp < nebulaLeftoverDeadline, RedeemLeftoverDeadlinePassed());
        require(canRedeemLeftover[msg.sender], IneligibleForLeftoverRedemption());

        uint256 remainder = calculateLeftoverNeb(msg.sender);
        nebulaToken.safeTransfer(msg.sender, remainder);

        nebulaSwapped[msg.sender] += remainder;
        canRedeemLeftover[msg.sender] = false;

        emit RedeemLeftoverNebula(msg.sender, remainder);
    }

    /// @notice Calculate the amount of NEB that can be redeemed for a given amount of VEGA
    function calculateRedeemableNeb(uint256 amount) public view returns (uint256) {
        return nebulaAllocation * amount / vegaTotalSupply;
    }

    /// @notice Calculate the amount of leftover NEB that can be redeemed by an account pro rata
    function calculateLeftoverNeb(address account) public view returns (uint256) {
        if(vegaTotalSwapped == 0) {
            return 0;
        }
        uint256 remainder = nebulaAllocation - nebulaTotalSwapped;
        return (vegaSwapped[account] * remainder) / vegaTotalSwapped;
    }
}
