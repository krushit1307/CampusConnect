// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AlumniSeminarSBT
 * @dev Soulbound Token (SBT) implementation for University Alumni Seminars.
 * These tokens are strictly non-transferable and serve as cryptographic proof of attendance.
 */
contract AlumniSeminarSBT is ERC1155, Ownable {
    using Strings for uint256;

    // Mapping from token ID to seminar metadata URI
    mapping(uint256 => string) private _tokenURIs;
    
    // Mapping to track which wallets have received which token to prevent double-minting
    mapping(uint256 => mapping(address => bool)) public hasMinted;

    // Counter for unique seminar series
    uint256 public nextSeminarId;

    event SeminarCreated(uint256 indexed seminarId, string uri);
    event SBTMinted(uint256 indexed seminarId, address indexed student, bytes32 hashedIdentity);

    constructor() ERC1155("") Ownable(msg.sender) {}

    /**
     * @notice Registers a new High-Value Alumni Seminar.
     * @param _uri The IPFS URI containing metadata (Course Name, Alumni Signature, etc.)
     */
    function createSeminar(string memory _uri) external onlyOwner returns (uint256) {
        uint256 seminarId = nextSeminarId++;
        _tokenURIs[seminarId] = _uri;
        
        emit SeminarCreated(seminarId, _uri);
        return seminarId;
    }

    /**
     * @notice Mints a Soulbound Token to a student who achieved 100% attendance.
     * @param studentWallet The Web3 address of the student.
     * @param seminarId The ID of the seminar.
     * @param hashedIdentity A cryptographic hash of the student's real-world identity for verification.
     */
    function mintCredential(
        address studentWallet, 
        uint256 seminarId, 
        bytes32 hashedIdentity
    ) external onlyOwner {
        require(seminarId < nextSeminarId, "Seminar does not exist");
        require(!hasMinted[seminarId][studentWallet], "Student already holds this credential");

        hasMinted[seminarId][studentWallet] = true;
        
        // Mint exactly 1 token (non-fungible context within the ERC1155 standard)
        _mint(studentWallet, seminarId, 1, "");

        emit SBTMinted(seminarId, studentWallet, hashedIdentity);
    }

    /**
     * @notice Returns the metadata URI for a specific seminar.
     */
    function uri(uint256 seminarId) public view override returns (string memory) {
        return _tokenURIs[seminarId];
    }

    /**
     * @dev Hook that is called before any token transfer. This includes minting and burning.
     * We override this to enforce the SOULBOUND property (non-transferable).
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Reject any actual peer-to-peer transfers
        require(
            from == address(0) || to == address(0),
            "AlumniSeminarSBT: Tokens are Soulbound and cannot be transferred."
        );
        
        super._update(from, to, ids, values);
    }
}
