// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VendorSlaEscrow
 * @dev Manages USDC escrows for Event Vendors with automated SLA slashing via Chainlink Oracles.
 * If the delivery drone registers an arrival time past the SLA deadline, the vendor is slashed 10%.
 * Settlement is absolute, irreversible, and executes in milliseconds on Polygon.
 */
contract VendorSlaEscrow is ChainlinkClient, ReentrancyGuard {
    using Chainlink for Chainlink.Request;

    IERC20 public immutable usdcToken;
    
    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    struct Escrow {
        address clubWallet;
        address vendorWallet;
        uint256 amount;
        uint256 slaDeadline;
        bool isResolved;
    }

    mapping(bytes32 => bytes32) public requestToEscrowId; // Maps Chainlink Request ID to Escrow ID
    mapping(bytes32 => Escrow) public escrows;

    event EscrowCreated(bytes32 indexed escrowId, address clubWallet, address vendorWallet, uint256 amount, uint256 slaDeadline);
    event OracleRequestSent(bytes32 indexed requestId, bytes32 indexed escrowId);
    event EscrowResolved(bytes32 indexed escrowId, uint256 vendorPayout, uint256 clubRefund, uint256 arrivalTime);

    /**
     * @param _usdcAddress The Polygon address of the USDC ERC20 token
     * @param _oracle The address of the Chainlink Oracle Node
     * @param _jobId The Job ID for the external Drone API adapter
     * @param _fee The LINK fee required to fulfill the request
     * @param _linkAddress The address of the LINK token
     */
    constructor(address _usdcAddress, address _oracle, bytes32 _jobId, uint256 _fee, address _linkAddress) {
        setChainlinkToken(_linkAddress);
        usdcToken = IERC20(_usdcAddress);
        oracle = _oracle;
        jobId = _jobId;
        fee = _fee;
    }

    /**
     * @dev Clubs deposit USDC into this contract when booking a vendor.
     */
    function createEscrow(bytes32 _escrowId, address _vendorWallet, uint256 _amount, uint256 _slaDeadline) external nonReentrant {
        require(escrows[_escrowId].amount == 0, "Escrow ID already exists");
        require(usdcToken.transferFrom(msg.sender, address(this), _amount), "USDC transfer failed");

        escrows[_escrowId] = Escrow({
            clubWallet: msg.sender,
            vendorWallet: _vendorWallet,
            amount: _amount,
            slaDeadline: _slaDeadline,
            isResolved: false
        });

        emit EscrowCreated(_escrowId, msg.sender, _vendorWallet, _amount, _slaDeadline);
    }

    /**
     * @dev Triggers the Chainlink Oracle to fetch the definitive drone arrival timestamp from the CampusConnect API.
     */
    function triggerSlaResolution(bytes32 _escrowId, string memory _deliveryId) external returns (bytes32 requestId) {
        require(escrows[_escrowId].amount > 0, "Escrow does not exist");
        require(!escrows[_escrowId].isResolved, "Escrow already resolved");

        Chainlink.Request memory req = buildChainlinkRequest(jobId, address(this), this.fulfillSlaResolution.selector);
        
        // Target the CampusConnect Drone Telemetry Edge Function
        req.add("get", string(abi.encodePacked("https://api.campusconnect.edu/v1/drone-telemetry/", _deliveryId)));
        req.add("path", "data,arrival_timestamp"); // JSON path to the timestamp
        
        requestId = sendChainlinkRequestTo(oracle, req, fee);
        requestToEscrowId[requestId] = _escrowId;
        
        emit OracleRequestSent(requestId, _escrowId);
        return requestId;
    }

    /**
     * @dev Callback function utilized by the Chainlink Oracle Node.
     * Determines the SLA violation mathematically and executes immediate USDC disbursement.
     */
    function fulfillSlaResolution(bytes32 _requestId, uint256 _arrivalTimestamp) public recordChainlinkFulfillment(_requestId) nonReentrant {
        bytes32 escrowId = requestToEscrowId[_requestId];
        Escrow storage escrow = escrows[escrowId];
        
        require(escrow.amount > 0, "Escrow does not exist");
        require(!escrow.isResolved, "Escrow already resolved");

        escrow.isResolved = true;

        uint256 vendorPayout;
        uint256 clubRefund;

        // SLA Logic: If drone arrives after the deadline, slash 10%
        if (_arrivalTimestamp > escrow.slaDeadline) {
            uint256 slashAmount = (escrow.amount * 10) / 100; // 10% Slash
            vendorPayout = escrow.amount - slashAmount;
            clubRefund = slashAmount;
        } else {
            vendorPayout = escrow.amount;
            clubRefund = 0;
        }

        // Execute Absolute Decentralized Settlement
        if (vendorPayout > 0) {
            require(usdcToken.transfer(escrow.vendorWallet, vendorPayout), "Vendor payout failed");
        }
        if (clubRefund > 0) {
            require(usdcToken.transfer(escrow.clubWallet, clubRefund), "Club refund failed");
        }

        emit EscrowResolved(escrowId, vendorPayout, clubRefund, _arrivalTimestamp);
    }
}
