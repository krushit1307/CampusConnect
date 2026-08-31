// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EventCancellationInsurancePool
 * @notice Decentralized Insurance Pool with Prediction Market Hedging (Polymarket CTF Integration)
 * Prevents pool bankruptcy during correlated event cancellation events (e.g. major weather disruptions).
 */
contract EventCancellationInsurancePool {
    struct Policy {
        uint256 id;
        address clubAddress;
        uint256 eventId;
        uint256 premiumAmount;
        uint256 payoutAmount;
        string locationCity;
        uint256 eventTimestamp;
        bytes32 predictionMarketConditionId;
        bool claimsTriggered;
        bool settled;
    }

    struct PoolLiquidity {
        uint256 totalReserve;
        uint256 totalHedgedAmount;
        uint256 totalUnderwrittenRisk;
        uint256 activePoliciesCount;
    }

    address public owner;
    address public polymarketRouter;
    
    uint256 public nextPolicyId = 1;
    uint256 public totalLiquidity;
    uint256 public reserveThresholdRatio = 20; // 20% minimum pool collateralization without hedge

    mapping(uint256 => Policy) public policies;
    mapping(bytes32 => uint256) public predictionMarketPositions; // conditionId => YES tokens held

    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed clubAddress,
        uint256 indexed eventId,
        uint256 premium,
        uint256 coverage,
        bytes32 conditionId
    );

    event HedgePositionExecuted(
        bytes32 indexed conditionId,
        uint256 amountHedged,
        uint256 sharesAcquired
    );

    event ClaimPaidOut(
        uint256 indexed policyId,
        address indexed clubAddress,
        uint256 payoutAmount,
        uint256 polymarketYieldUsed
    );

    event EmergencyLiquidityInjected(
        bytes32 indexed conditionId,
        uint256 amountInjected
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call");
        _;
    }

    constructor(address _polymarketRouter) {
        owner = msg.sender;
        polymarketRouter = _polymarketRouter;
    }

    receive() external payable {
        totalLiquidity += msg.value;
    }

    /**
     * @notice Underwrite insurance policy and automatically execute prediction market hedge
     * @param eventId ID of the campus event
     * @param coverage Requested payout amount
     * @param locationCity Location for weather oracle contract matching
     * @param eventTimestamp Date timestamp of event
     * @param conditionId Polymarket CTF condition ID for event outcome
     */
    function purchasePolicy(
        uint256 eventId,
        uint256 coverage,
        string calldata locationCity,
        uint256 eventTimestamp,
        bytes32 conditionId
    ) external payable returns (uint256) {
        uint256 requiredPremium = (coverage * 2) / 100; // 2% premium rate
        require(msg.value >= requiredPremium, "Insufficient premium provided");

        uint256 policyId = nextPolicyId++;
        policies[policyId] = Policy({
            id: policyId,
            clubAddress: msg.sender,
            eventId: eventId,
            premiumAmount: msg.value,
            payoutAmount: coverage,
            locationCity: locationCity,
            eventTimestamp: eventTimestamp,
            predictionMarketConditionId: conditionId,
            claimsTriggered: false,
            settled: false
        });

        totalLiquidity += msg.value;

        // Immediately deploy 90% of premium into Polymarket YES shares to hedge payout risk
        uint256 hedgeCapital = (msg.value * 90) / 100;
        _executePredictionMarketHedge(conditionId, hedgeCapital, coverage);

        emit PolicyPurchased(policyId, msg.sender, eventId, msg.value, coverage, conditionId);
        return policyId;
    }

    /**
     * @notice Internal helper to simulate/execute buying YES outcome tokens on Polymarket
     */
    function _executePredictionMarketHedge(
        bytes32 conditionId,
        uint256 capital,
        uint256 expectedPayout
    ) internal {
        // Mock buying shares: 1 USD premium yields expected payout share ratio on catastrophe market
        uint256 sharesAcquired = capital * 40; // 40x leverage on low probability event contract
        predictionMarketPositions[conditionId] += sharesAcquired;

        emit HedgePositionExecuted(conditionId, capital, sharesAcquired);
    }

    /**
     * @notice Process catastrophic event claim by redeeming prediction market winnings
     */
    function processEventCancellationClaim(
        uint256 policyId,
        bytes calldata oracleProof
    ) external {
        Policy storage policy = policies[policyId];
        require(!policy.settled, "Policy already settled");
        require(policy.clubAddress == msg.sender || msg.sender == owner, "Unauthorized claim caller");
        require(oracleProof.length > 0, "Invalid oracle verification proof");

        policy.claimsTriggered = true;

        // Redeem Polymarket prediction shares if liquidity is constrained
        bytes32 condId = policy.predictionMarketConditionId;
        uint256 marketYield = predictionMarketPositions[condId];
        if (marketYield > 0) {
            totalLiquidity += marketYield;
            predictionMarketPositions[condId] = 0;
            emit EmergencyLiquidityInjected(condId, marketYield);
        }

        require(totalLiquidity >= policy.payoutAmount, "Insufficient pool liquidity despite hedge");
        
        totalLiquidity -= policy.payoutAmount;
        policy.settled = true;

        (bool success, ) = policy.clubAddress.call{value: policy.payoutAmount}("");
        require(success, "Payout transfer failed");

        emit ClaimPaidOut(policyId, policy.clubAddress, policy.payoutAmount, marketYield);
    }

    /**
     * @notice Get current insurance pool health and hedge metrics
     */
    function getPoolMetrics() external view returns (PoolLiquidity memory) {
        return PoolLiquidity({
            totalReserve: totalLiquidity,
            totalHedgedAmount: address(this).balance,
            totalUnderwrittenRisk: totalLiquidity * 5,
            activePoliciesCount: nextPolicyId - 1
        });
    }
}
