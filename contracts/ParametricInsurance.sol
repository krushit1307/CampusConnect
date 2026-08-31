// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ParametricInsurance
 * @notice A decentralized parametric insurance smart contract for student events.
 * @dev Replaces the hard time-lock with a TWAP (Time-Weighted Average Price) Oracle architecture to prevent flash loan arbitrage.
 */
contract ParametricInsurance {
    address public owner;
    address public oracleAddress;
    
    // TWAP state
    struct Observation {
        uint32 timestamp;
        uint224 cumulativeProbability;
    }
    
    mapping(uint256 => Observation) public observations;
    uint256 public observationCount;
    
    uint256 public probabilityCumulative;
    uint32 public blockTimestampLast;
    uint256 public lastProbability; // The most recently reported instantaneous probability (0-100)

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
    event WeatherUpdated(uint256 probability, uint256 timestamp);
    
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
        
        // Initialize first observation
        observations[0] = Observation({
            timestamp: uint32(block.timestamp),
            cumulativeProbability: 0
        });
        observationCount = 1;
        blockTimestampLast = uint32(block.timestamp);
    }
    
    /**
     * @notice Oracle calls this periodically to update the instantaneous rain probability.
     * @param instantaneousProbability Probability of rain (0 to 100)
     */
    function updateWeatherProbability(uint256 instantaneousProbability) external onlyOracle {
        require(instantaneousProbability <= 100, "Probability must be <= 100");
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast;
        
        if (timeElapsed > 0) {
            probabilityCumulative += lastProbability * timeElapsed;
        }
        
        lastProbability = instantaneousProbability;
        blockTimestampLast = blockTimestamp;
        
        observations[observationCount] = Observation({
            timestamp: blockTimestamp,
            cumulativeProbability: uint224(probabilityCumulative)
        });
        observationCount++;
        
        emit WeatherUpdated(instantaneousProbability, blockTimestamp);
    }

    /**
     * @notice Calculates the Time-Weighted Average probability over the specified period (e.g., 24 hours = 86400).
     */
    function getTWAP(uint32 period) public view returns (uint256) {
        require(observationCount > 0, "No observations");
        uint32 currentTime = uint32(block.timestamp);
        
        if (period == 0) return lastProbability;
        
        uint32 targetTime = currentTime - period;
        
        // If we don't have observations going that far back, just calculate from the first one
        if (observations[0].timestamp >= targetTime) {
            uint32 timeElapsed = currentTime - observations[0].timestamp;
            if (timeElapsed == 0) return lastProbability;
            
            // Calculate what cumulative would be right now
            uint256 currentCumulativeCalc = probabilityCumulative + (lastProbability * (currentTime - blockTimestampLast));
            return currentCumulativeCalc / timeElapsed;
        }

        // Binary search to find the observation at or just before targetTime
        uint256 low = 0;
        uint256 high = observationCount - 1;
        
        while (low < high) {
            uint256 mid = (low + high + 1) / 2;
            if (observations[mid].timestamp <= targetTime) {
                low = mid;
            } else {
                high = mid - 1;
            }
        }
        
        Observation memory targetObs = observations[low];
        
        // Linear interpolation if the targetObs is strictly before targetTime
        uint256 targetCumulative = targetObs.cumulativeProbability;
        if (targetObs.timestamp < targetTime && low + 1 < observationCount) {
            Observation memory nextObs = observations[low + 1];
            uint256 timeDelta = nextObs.timestamp - targetObs.timestamp;
            uint256 probDelta = nextObs.cumulativeProbability - targetObs.cumulativeProbability;
            
            uint256 timePassed = targetTime - targetObs.timestamp;
            targetCumulative += (probDelta * timePassed) / timeDelta;
        } else if (targetObs.timestamp < targetTime && low + 1 == observationCount) {
            // We are between the last observation and now
            uint256 timePassed = targetTime - targetObs.timestamp;
            targetCumulative += (lastProbability * timePassed);
        }
        
        uint256 currentCumulative = probabilityCumulative + (lastProbability * (currentTime - blockTimestampLast));
        
        return (currentCumulative - targetCumulative) / period;
    }

    /**
     * @notice Allows a club to purchase parametric insurance for an event.
     * Premium is dynamically adjusted based on the current 24-hour TWAP probability.
     */
    function purchasePolicy(
        string memory eventId,
        uint256 coverageAmount,
        int256 lat,
        int256 lon
    ) external payable {
        require(!policies[eventId].isActive, "Policy already exists");
        
        // Dynamic Premium Calculation
        // Calculate the 24-hour TWAP (86400 seconds)
        uint256 twapProb = getTWAP(86400); // 0-100
        
        // Premium is proportional to the probability, e.g., if TWAP prob is 50%, premium is 50% of coverage
        uint256 requiredPremium = (coverageAmount * twapProb) / 100;
        // Ensure some minimum premium (e.g. 2%)
        if (requiredPremium < (coverageAmount * 2) / 100) {
            requiredPremium = (coverageAmount * 2) / 100;
        }
        
        require(msg.value >= requiredPremium, "Insufficient premium based on current TWAP");
        
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
     * @notice Called by the trusted Oracle to trigger a payout if weather conditions are met.
     */
    function reportWeatherAndTrigger(
        string memory eventId
    ) external onlyOracle {
        Policy storage policy = policies[eventId];
        
        require(policy.isActive, "Policy does not exist");
        require(!policy.isClaimed, "Policy already claimed");
        
        // Payout logic changed: evaluate the 24-hour TWAP
        uint256 twapRainProbability = getTWAP(86400);
        
        // Trigger condition: 24-hour TWAP probability > 60%
        // A flash loan hacker creating a sudden spike won't drag the 24h TWAP above 60%
        if (twapRainProbability > 60) {
            policy.isClaimed = true;
            policy.isActive = false;
            
            // In a real implementation, this would transfer from a dedicated pool
            // payable(msg.sender).transfer(policy.coverageAmount); // Simplified for artifact
            
            emit PayoutTriggered(eventId, policy.coverageAmount, twapRainProbability);
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
