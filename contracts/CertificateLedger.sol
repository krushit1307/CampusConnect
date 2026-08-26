// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateLedger
 * @notice Immutable ledger that anchors daily Merkle roots of certificate
 *         batches issued by CampusConnect. Anyone can mathematically verify
 *         that a certificate hash belongs to an anchored batch via
 *         `verifyRoot` / `getBatch`, without trusting CampusConnect.
 *
 * @dev Deploy on a low-cost public chain (e.g. Polygon PoS) and submit one
 *      `anchorDay` transaction per UTC day containing the Merkle root of
 *      every certificate issued that day.
 */
contract CertificateLedger {
    struct Batch {
        bytes32 root;
        uint256 blockNumber;
        uint256 timestamp;
        uint256 certificateCount;
    }

    /// @notice UTC day (YYYYMMDD, e.g. 20260804) => anchored batch.
    mapping(uint256 day => Batch) public batches;

    address public owner;
    bool public paused;

    event RootAnchored(
        uint256 indexed day,
        bytes32 indexed root,
        uint256 certificateCount,
        uint256 blockNumber,
        uint256 timestamp
    );
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event Paused(bool paused);

    modifier onlyOwner() {
        require(msg.sender == owner, "CertificateLedger: not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Anchors the Merkle root of a daily certificate batch.
     * @param day UTC day as YYYYMMDD (e.g. 20260804 for 2026-08-04).
     * @param root Merkle root of the day's certificate leaf hashes.
     * @param certificateCount Number of certificates in the batch.
     * @return blockNumber of the anchoring transaction.
     */
    function anchorDay(
        uint256 day,
        bytes32 root,
        uint256 certificateCount
    ) external onlyOwner returns (uint256 blockNumber) {
        require(!paused, "CertificateLedger: paused");
        require(root != bytes32(0), "CertificateLedger: empty root");
        require(day > 0, "CertificateLedger: invalid day");
        require(batches[day].root == bytes32(0), "CertificateLedger: day already anchored");

        batches[day] = Batch({
            root: root,
            blockNumber: block.number,
            timestamp: block.timestamp,
            certificateCount: certificateCount
        });

        emit RootAnchored(day, root, certificateCount, block.number, block.timestamp);
        return block.number;
    }

    /**
     * @notice Returns true when `root` is the root anchored for `day`.
     */
    function verifyRoot(uint256 day, bytes32 root) external view returns (bool) {
        return batches[day].root == root;
    }

    /**
     * @notice Returns the full anchored batch for a day (zero-root batch when
     *         the day was never anchored).
     */
    function getBatch(uint256 day) external view returns (Batch memory) {
        return batches[day];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "CertificateLedger: zero address");
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit Paused(value);
    }
}
