// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ParametricInsurance
 * @notice A decentralized parametric insurance smart contract with 2-of-3 Multi-Oracle Consensus.
 */
contract ParametricInsurance {
    address public owner;
    
    // The three designated independent consensus oracles
    address public noaaOracle;
    address public accuweatherOracle;
    address public iotRainGaugeOracle;

    struct Policy {
        uint256 premiumPaid;
        uint256 coverageAmount;
        bool isActive;
        bool isClaimed;
        uint256 eventTimestamp;
        int256 latitude;
        int256 longitude;
    }

    struct RainReport {
        uint256 precipitationInches; // Represented as fixed-point decimal: 100 = 1.0 inch
        bool hasReported;
    }

    mapping(string => Policy) public policies;
    
    // Mapping: eventId => oracleAddress => RainReport
    mapping(string => mapping(address => RainReport)) public rainReports;

    event PolicyCreated(string eventId, uint256 premium, uint256 coverage);
    event PayoutTriggered(string eventId, uint256 amount);
    event PrecipitationReported(string eventId, address indexed oracle, uint256 precipitation);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    modifier onlyAuthorizedOracle() {
        require(
            msg.sender == noaaOracle || 
            msg.sender == accuweatherOracle || 
            msg.sender == iotRainGaugeOracle,
            "Only authorized consensus oracles can report"
        );
        _;
    }

    constructor(
        address _noaaOracle,
        address _accuweatherOracle,
        address _iotRainGaugeOracle
    ) {
        owner = msg.sender;
        noaaOracle = _noaaOracle;
        accuweatherOracle = _accuweatherOracle;
        iotRainGaugeOracle = _iotRainGaugeOracle;
    }

    /**
     * @notice Allows a club to purchase parametric weather insurance for an event.
     */
    function purchasePolicy(
        string memory eventId,
        uint256 coverageAmount,
        int256 lat,
        int256 lon
    ) external payable {
        require(!policies[eventId].isActive, "Policy already exists");
        require(msg.value >= (coverageAmount * 5) / 100, "Premium must be at least 5% of coverage");

        policies[eventId] = Policy({
            premiumPaid: msg.value,
            coverageAmount: coverageAmount,
            isActive: true,
            isClaimed: false,
            eventTimestamp: block.timestamp,
            latitude: lat,
            longitude: lon
        });

        emit PolicyCreated(eventId, msg.value, coverageAmount);
    }

    /**
     * @notice Oracles submit weather readings. Consensus is evaluated on each submission.
     */
    function reportPrecipitation(
        string memory eventId,
        uint256 precipitationInches
    ) external onlyAuthorizedOracle {
        Policy storage policy = policies[eventId];
        require(policy.isActive, "Policy is not active");
        require(!policy.isClaimed, "Policy already claimed");

        RainReport storage report = rainReports[eventId][msg.sender];
        require(!report.hasReported, "Oracle has already reported for this event");

        report.precipitationInches = precipitationInches;
        report.hasReported = true;

        emit PrecipitationReported(eventId, msg.sender, precipitationInches);

        // Evaluate 2-of-3 threshold consensus
        checkConsensusAndTrigger(eventId);
    }

    /**
     * @dev Payout is triggered if at least 2 out of the 3 independent oracles confirm 'precipitation > 1.0 inches' (fixed-point 100)
     */
    function checkConsensusAndTrigger(string memory eventId) internal {
        Policy storage policy = policies[eventId];

        uint256 consensusCount = 0;
        address[3] memory oracles = [noaaOracle, accuweatherOracle, iotRainGaugeOracle];

        for (uint256 i = 0; i < 3; i++) {
            RainReport memory report = rainReports[eventId][oracles[i]];
            // Threshold condition: precipitation > 1.0 inches (represented as 100)
            if (report.hasReported && report.precipitationInches > 100) {
                consensusCount++;
            }
        }

        // Payout ONLY triggered if 2-of-3 consensus is satisfied
        if (consensusCount >= 2) {
            policy.isClaimed = true;
            policy.isActive = false;

            // Trigger payout (simulated transfer logic)
            payable(owner).transfer(policy.coverageAmount); // Refund/Payout transfer simulated

            emit PayoutTriggered(eventId, policy.coverageAmount);
        }
    }

    /**
     * @notice Allows owner to update oracle addresses if needed.
     */
    function setOracles(
        address _noaaOracle,
        address _accuweatherOracle,
        address _iotRainGaugeOracle
    ) external onlyOwner {
        noaaOracle = _noaaOracle;
        accuweatherOracle = _accuweatherOracle;
        iotRainGaugeOracle = _iotRainGaugeOracle;
    }

    receive() external payable {}
}
