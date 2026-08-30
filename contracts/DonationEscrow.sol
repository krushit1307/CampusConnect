// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DonationEscrow
 * @dev Enforces milestone-based verification for crypto donations.
 * If the club satisfies the milestone verified by the Oracle before the deadline, funds are released.
 * If the deadline passes without verification, funds are returned directly to the donor.
 */
contract DonationEscrow is Ownable {
    IERC20 public immutable usdcToken;

    struct Escrow {
        address donor;
        address recipient;
        address oracle;
        uint256 amount;
        uint256 milestoneDate;
        bool isVerified;
        bool isResolved;
    }

    mapping(uint256 => Escrow) public escrows;
    uint256 public escrowCounter;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed donor,
        address indexed recipient,
        address oracle,
        uint256 amount,
        uint256 milestoneDate
    );
    event EscrowReleased(uint256 indexed escrowId, address indexed recipient, uint256 amount);
    event EscrowReverted(uint256 indexed escrowId, address indexed donor, uint256 amount);

    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }

    /**
     * @notice Locks USDC into a new escrow agreement.
     */
    function createEscrow(
        address _recipient,
        address _oracle,
        uint256 _amount,
        uint256 _milestoneDate
    ) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than zero");
        require(_milestoneDate > block.timestamp, "Milestone date must be in the future");
        require(_recipient != address(0), "Invalid recipient address");
        require(_oracle != address(0), "Invalid oracle address");

        require(
            usdcToken.transferFrom(msg.sender, address(this), _amount),
            "USDC transfer to escrow contract failed"
        );

        uint256 escrowId = escrowCounter++;
        escrows[escrowId] = Escrow({
            donor: msg.sender,
            recipient: _recipient,
            oracle: _oracle,
            amount: _amount,
            milestoneDate: _milestoneDate,
            isVerified: false,
            isResolved: false
        });

        emit EscrowCreated(escrowId, msg.sender, _recipient, _oracle, _amount, _milestoneDate);
        return escrowId;
    }

    /**
     * @notice Oracle triggers milestone verification to release the funds.
     */
    function verifyMilestone(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(msg.sender == escrow.oracle, "Only the designated Oracle can verify");
        require(!escrow.isResolved, "Escrow already resolved");
        require(block.timestamp <= escrow.milestoneDate, "Milestone date has already passed");

        escrow.isVerified = true;
        escrow.isResolved = true;

        require(
            usdcToken.transfer(escrow.recipient, escrow.amount),
            "Transfer to recipient failed"
        );

        emit EscrowReleased(_escrowId, escrow.recipient, escrow.amount);
    }

    /**
     * @notice Reverts the donation if the milestone passes without verification.
     */
    function revertDonation(uint256 _escrowId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(!escrow.isResolved, "Escrow already resolved");
        require(block.timestamp > escrow.milestoneDate, "Milestone date has not yet passed");
        require(!escrow.isVerified, "Milestone was already verified");

        escrow.isResolved = true;

        require(
            usdcToken.transfer(escrow.donor, escrow.amount),
            "Refund transfer to donor failed"
        );

        emit EscrowReverted(_escrowId, escrow.donor, escrow.amount);
    }
}
