// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ParametricInsurance
 * @notice A decentralized parametric insurance smart contract for student events.
 * @dev Payouts are triggered autonomously based on TWAP Oracle weather data to prevent flash loan arbitrage.
 */
contract ParametricInsurance {
    address public owner;
    address public oracleAddress;
    
    // Mapping from event ID to policy details
    struct Policy {
        uint256 premiumPaid;
        uint256 coverageAmount;
        bool isActive;
        bool isClaimed;
        uint256 eventTimestamp;
        int256 latitude;
        int256 longitude;
    }
    
    mapping(string => Policy) public policies;
    
    event PolicyCreated(string eventId, uint256 premium, uint256 coverage);
    event PayoutTriggered(string eventId, uint256 amount, uint256 twapProbability);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can call");
        _;
    }
    
    constructor(address _oracleAddress) {
        owner = msg.sender;
        oracleAddress = _oracleAddress;
    }
    
    /**
     * @notice Allows a club to purchase parametric insurance for an event.
     * @param eventId Unique identifier for the event
     * @param coverageAmount The amount to be paid out if triggered (e.g., 5000 USD equivalent in wei)
     * @param eventTime The scheduled timestamp of the event
     * @param lat Latitude of the event (multiplied by 1e6 for precision)
     * @param lon Longitude of the event (multiplied by 1e6 for precision)
     */
    function purchasePolicy(
        string memory eventId,
        uint256 coverageAmount,
        uint256 eventTime,
        int256 lat,
        int256 lon
    ) external payable {
        require(msg.value > 0, "Premium must be > 0");
        // In production: require(msg.value == (coverageAmount * 2) / 100); // 2% premium
        
        // Flash Loan / Arbitrage Prevention: Must buy at least 1 hour before event, replacing the 72-hour lockup
        require(eventTime >= block.timestamp + 1 hours, "Must purchase at least 1 hour before event");
        require(!policies[eventId].isActive, "Policy already exists");
        
        policies[eventId] = Policy({
            premiumPaid: msg.value,
            coverageAmount: coverageAmount,
            isActive: true,
            isClaimed: false,
            eventTimestamp: eventTime,
            latitude: lat,
            longitude: lon
        });
        
        emit PolicyCreated(eventId, msg.value, coverageAmount);
    }
    
    /**
     * @notice Called by the trusted Oracle to trigger a payout if TWAP weather conditions are met.
     * @param eventId The event to check
     * @param twapRainProbability The Time-Weighted Average probability of rain over the preceding 24 hours (0-100)
     */
    function reportWeatherAndTrigger(
        string memory eventId,
        uint256 twapRainProbability
    ) external onlyOracle {
        Policy storage policy = policies[eventId];
        
        require(policy.isActive, "Policy does not exist");
        require(!policy.isClaimed, "Policy already claimed");
        require(block.timestamp >= policy.eventTimestamp, "Event has not occurred yet");
        
        // Payout logic changed: Trigger condition is TWAP probability > 50%
        // Dilutes instantaneous spikes from hackers using flash loans when a storm forms.
        if (twapRainProbability > 50) {
            policy.isClaimed = true;
            policy.isActive = false;
            
            // In a real implementation, this would transfer from a dedicated pool
            // payable(msg.sender).transfer(policy.coverageAmount); // Simplified for artifact
            
            emit PayoutTriggered(eventId, policy.coverageAmount, twapRainProbability);
        } else {
            // Flash loan arbitrage neutralization: Payout $0
            policy.isActive = false; // Expire without payout
        }
    }
    
    /**
     * @notice Allows the owner to update the oracle address.
     */
    function setOracleAddress(address _newOracle) external onlyOwner {
        oracleAddress = _newOracle;
    }
    
    /**
     * @notice Retrieve contract balance for pool health monitoring.
     */
    function getPoolBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
