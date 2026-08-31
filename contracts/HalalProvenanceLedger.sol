// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title HalalProvenanceLedger
 * @dev Append-only provenance ledger for religiously certified meat served at campus events (#5284).
 *
 * A caterer claiming Halal or Kosher compliance must publish, per lot of meat, the
 * carton lot number, the digest of the certificate issued by an accredited board,
 * and that board's signature over the claim. Records are chained by digest and can
 * never be updated or deleted, so an attendee scanning the QR code at the food
 * table reads the same trail the caterer committed to before service began.
 *
 * Deployed on Polygon: anchoring cost per lot has to stay negligible relative to a
 * catering order, otherwise caterers route around the system.
 */
contract HalalProvenanceLedger is Ownable {
    /// @dev Standards the ledger accepts. Kept on-chain so a Kosher board cannot vouch for a Halal claim.
    enum DietaryStandard { HALAL, KOSHER }

    struct CertificationBoard {
        string name;
        DietaryStandard standard;
        bytes publicKey;
        bool accredited;
    }

    struct LotRecord {
        bytes32 eventId;
        bytes32 catererId;
        DietaryStandard standard;
        string lotNumber;
        bytes32 facilityId;
        bytes32 boardId;
        bytes32 certificateHash;
        bytes boardSignature;
        uint64 slaughterDate;
        bytes32 previousHash;
        bytes32 entryHash;
        uint256 anchoredAt;
        address submittedBy;
    }

    /// @dev Accredited boards, keyed by slug hash (e.g. keccak256("ifanca")).
    mapping(bytes32 => CertificationBoard) public boards;

    /// @dev Every record ever anchored, keyed by its own entry digest.
    mapping(bytes32 => LotRecord) private recordsByHash;

    /// @dev Per-event append-only list of entry digests, in submission order.
    mapping(bytes32 => bytes32[]) private eventChain;

    /// @dev Caterers permitted to anchor. The registry is the trust boundary.
    mapping(address => bool) public authorizedCaterers;

    event BoardAccredited(bytes32 indexed boardId, string name, DietaryStandard standard);
    event BoardRevoked(bytes32 indexed boardId);
    event CatererAuthorized(address indexed caterer);
    event CatererRevoked(address indexed caterer);
    event LotAnchored(
        bytes32 indexed eventId,
        bytes32 indexed entryHash,
        bytes32 indexed boardId,
        string lotNumber,
        bytes32 certificateHash,
        bytes32 previousHash
    );

    error NotAuthorizedCaterer();
    error BoardNotAccredited();
    error StandardMismatch();
    error RecordAlreadyAnchored();
    error BrokenChain(bytes32 expectedPreviousHash);
    error EmptyLotNumber();
    error UnknownRecord();

    modifier onlyCaterer() {
        if (!authorizedCaterers[msg.sender]) revert NotAuthorizedCaterer();
        _;
    }

    /// @notice Registers or re-accredits a certification board.
    function accreditBoard(
        bytes32 boardId,
        string calldata name,
        DietaryStandard standard,
        bytes calldata publicKey
    ) external onlyOwner {
        boards[boardId] = CertificationBoard(name, standard, publicKey, true);
        emit BoardAccredited(boardId, name, standard);
    }

    /**
     * @notice Withdraws a board's accreditation.
     * @dev Records already anchored under the board stay readable on purpose: an
     * attendee who ate that food is entitled to see what was claimed at the time,
     * and rewriting history is exactly what this ledger exists to prevent.
     */
    function revokeBoard(bytes32 boardId) external onlyOwner {
        boards[boardId].accredited = false;
        emit BoardRevoked(boardId);
    }

    function authorizeCaterer(address caterer) external onlyOwner {
        authorizedCaterers[caterer] = true;
        emit CatererAuthorized(caterer);
    }

    function revokeCaterer(address caterer) external onlyOwner {
        authorizedCaterers[caterer] = false;
        emit CatererRevoked(caterer);
    }

    /**
     * @notice Anchors one lot of certified meat for an event.
     * @param entryHash Digest computed off-chain over the record payload; also the storage key.
     * @param previousHash Entry digest of the event's previous lot, or bytes32(0) for the first.
     *
     * @dev Reverts rather than branching when the chain head does not match. A record
     * appended out of order would leave the attendee's replay unverifiable, which is
     * worse than a failed submission the caterer has to retry.
     */
    function anchorLot(
        bytes32 eventId,
        bytes32 catererId,
        DietaryStandard standard,
        string calldata lotNumber,
        bytes32 facilityId,
        bytes32 boardId,
        bytes32 certificateHash,
        bytes calldata boardSignature,
        uint64 slaughterDate,
        bytes32 previousHash,
        bytes32 entryHash
    ) external onlyCaterer {
        if (bytes(lotNumber).length == 0) revert EmptyLotNumber();
        if (recordsByHash[entryHash].entryHash != bytes32(0)) revert RecordAlreadyAnchored();

        CertificationBoard memory board = boards[boardId];
        if (!board.accredited) revert BoardNotAccredited();
        if (board.standard != standard) revert StandardMismatch();

        bytes32[] storage chain = eventChain[eventId];
        bytes32 expectedPrevious = chain.length == 0 ? bytes32(0) : chain[chain.length - 1];
        if (previousHash != expectedPrevious) revert BrokenChain(expectedPrevious);

        recordsByHash[entryHash] = LotRecord({
            eventId: eventId,
            catererId: catererId,
            standard: standard,
            lotNumber: lotNumber,
            facilityId: facilityId,
            boardId: boardId,
            certificateHash: certificateHash,
            boardSignature: boardSignature,
            slaughterDate: slaughterDate,
            previousHash: previousHash,
            entryHash: entryHash,
            anchoredAt: block.timestamp,
            submittedBy: msg.sender
        });
        chain.push(entryHash);

        emit LotAnchored(eventId, entryHash, boardId, lotNumber, certificateHash, previousHash);
    }

    /// @notice Entry digests anchored for an event, in submission order.
    function getEventChain(bytes32 eventId) external view returns (bytes32[] memory) {
        return eventChain[eventId];
    }

    /// @notice Current chain head for an event, as encoded in the table QR code.
    function getChainHead(bytes32 eventId) external view returns (bytes32) {
        bytes32[] storage chain = eventChain[eventId];
        return chain.length == 0 ? bytes32(0) : chain[chain.length - 1];
    }

    /// @notice Full record behind one entry digest, for the attendee-facing trail.
    function getRecord(bytes32 entryHash) external view returns (LotRecord memory) {
        LotRecord memory record = recordsByHash[entryHash];
        if (record.entryHash == bytes32(0)) revert UnknownRecord();
        return record;
    }

    function getLotCount(bytes32 eventId) external view returns (uint256) {
        return eventChain[eventId].length;
    }
}
