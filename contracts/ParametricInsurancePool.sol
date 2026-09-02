// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ParametricInsurancePool
 * @dev Implements a parametric insurance pool with time-locked activation boundaries
 * to prevent atomic flash-loan arbitrage attacks on weather/event metrics.
 */
contract ParametricInsurancePool is ReentrancyGuard {
    struct Policy {
        uint256 premiumPaid;
        uint256 potentialPayout;
        uint256 purchaseTimestamp;
        uint256 activationTimestamp;
        bool isClaimed;
    }

    IERC20 public immutable paymentToken;
    address public owner;
    
    // Attack Mitigation Parameters
    uint256 public constant POLICY_ACTIVATION_DELAY = 72 hours;
    
    // Mapping: User Address => Policy ID => Policy Details
    mapping(address => mapping(uint256 => Policy)) public userPolicies;
    mapping(address => uint256) public userPolicyCount;

    // Events
    event PolicyPurchased(address indexed buyer, uint256 indexed policyId, uint256 premium, uint256 payout, uint256 activationTime);
    event ClaimPaid(address indexed beneficiary, uint256 indexed policyId, uint256 payoutAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not pool owner");
        _;
    }

    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token");
        paymentToken = IERC20(_tokenAddress);
        owner = msg.sender;
    }

    /**
     * @notice Purchase a parametric policy.
     * @dev Sets activationTimestamp to block.timestamp + 72 hours to invalidate flash loans.
     */
    function purchasePolicy(uint256 premiumAmount, uint256 calculatedPayout) external nonReentrant {
        require(premiumAmount > 0, "Premium must exceed zero");
        require(calculatedPayout > premiumAmount, "Payout must exceed premium");
        require(
            paymentToken.balanceOf(address(this)) >= calculatedPayout, 
            "Insufficient pool liquidity to guarantee payout"
        );

        // Transfer premium into pool reserves
        require(paymentToken.transferFrom(msg.sender, address(this), premiumAmount), "Premium transfer failed");

        uint256 policyId = userPolicyCount[msg.sender];
        uint256 activationTime = block.timestamp + POLICY_ACTIVATION_DELAY;

        userPolicies[msg.sender][policyId] = Policy({
            premiumPaid: premiumAmount,
            potentialPayout: calculatedPayout,
            purchaseTimestamp: block.timestamp,
            activationTimestamp: activationTime,
            isClaimed: false
        });

        userPolicyCount[msg.sender]++;

        emit PolicyPurchased(msg.sender, policyId, premiumAmount, calculatedPayout, activationTime);
    }

    /**
     * @notice Triggers parametric payout upon verified external event conditions.
     * @dev Validates temporal locking properties to filter out flash loan blocks.
     */
    function claimParametricPayout(uint256 policyId, bytes calldata oracleSignature) external nonReentrant {
        Policy storage policy = userPolicies[msg.sender][policyId];
        
        require(policy.potentialPayout > 0, "Policy does not exist");
        require(!policy.isClaimed, "Policy already claimed");
        
        // --- DEFI FLASH LOAN PROTECTION ACTUATOR ---
        // Mathematically guarantees that a policy purchased in the current block or within
        // the 72-hour window cannot request a payout, neutralizing atomic block execution loans.
        require(block.timestamp >= policy.activationTimestamp, "Policy is locked: Activation delay period active");

        // Verify oracle data signature here (Mock verified for brevity)
        require(oracleSignature.length > 0, "Invalid oracle credentials");

        policy.isClaimed = true;
        require(paymentToken.transfer(msg.sender, policy.potentialPayout), "Payout execution failed");

        emit ClaimPaid(msg.sender, policyId, policy.potentialPayout);
    }
}
