"""
Proof-of-Skill Models for AI Resume Analyzer
Models for Merkle Tree based skill verification.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
import uuid


class SkillVerificationStatus(Enum):
    """Status of skill verification."""
    PENDING = "pending"
    VERIFIED = "verified"
    FAILED = "failed"
    REVOKED = "revoked"
    EXPIRED = "expired"


class PoSChain(Enum):
    """Supported blockchain chains."""
    POLYGON = "polygon"
    ETHEREUM = "ethereum"
    BSC = "bsc"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"


@dataclass
class ASTNode:
    """Abstract Syntax Tree node for code hashing."""
    type: str
    name: str
    content: str
    children: List['ASTNode'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'type': self.type,
            'name': self.name,
            'content': self.content,
            'children': [c.to_dict() for c in self.children],
            'metadata': self.metadata
        }


@dataclass
class MerkleLeaf:
    """Merkle tree leaf node."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    data: str = ""
    hash: str = ""
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'data': self.data,
            'hash': self.hash,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class MerkleNode:
    """Merkle tree internal node."""
    hash: str
    left: Optional['MerkleNode'] = None
    right: Optional['MerkleNode'] = None
    leaf: Optional[MerkleLeaf] = None
    is_leaf: bool = False

    def is_leaf_node(self) -> bool:
        return self.is_leaf and self.leaf is not None


@dataclass
class MerkleTree:
    """Complete Merkle tree structure."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    root_hash: str = ""
    leaves: List[MerkleLeaf] = field(default_factory=list)
    nodes: List[MerkleNode] = field(default_factory=list)
    depth: int = 0
    leaf_count: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    chain: PoSChain = PoSChain.POLYGON
    tx_hash: str = ""
    block_number: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'root_hash': self.root_hash,
            'leaves': [l.to_dict() for l in self.leaves],
            'depth': self.depth,
            'leaf_count': self.leaf_count,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'chain': self.chain.value,
            'tx_hash': self.tx_hash,
            'block_number': self.block_number,
            'metadata': self.metadata
        }


@dataclass
class SkillProof:
    """Proof of Skill for a user."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    user_address: str = ""
    skill_name: str = ""
    skill_level: str = ""
    merkle_root: str = ""
    merkle_proof: List[str] = field(default_factory=list)
    leaf_hash: str = ""
    tx_hash: str = ""
    chain: PoSChain = PoSChain.POLYGON
    block_number: int = 0
    status: SkillVerificationStatus = SkillVerificationStatus.PENDING
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_address': self.user_address,
            'skill_name': self.skill_name,
            'skill_level': self.skill_level,
            'merkle_root': self.merkle_root,
            'merkle_proof': self.merkle_proof,
            'leaf_hash': self.leaf_hash,
            'tx_hash': self.tx_hash,
            'chain': self.chain.value,
            'block_number': self.block_number,
            'status': self.status.value,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'metadata': self.metadata,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def is_valid(self) -> bool:
        """Check if the proof is still valid."""
        if self.status == SkillVerificationStatus.REVOKED:
            return False
        if self.expires_at and self.expires_at < datetime.now():
            return False
        return True

    def get_verification_badge(self) -> str:
        """Get the verification badge string."""
        if self.status == SkillVerificationStatus.VERIFIED:
            return f"✅ Cryptographically Verified {self.skill_name}"
        elif self.status == SkillVerificationStatus.PENDING:
            return f"⏳ Verifying {self.skill_name}"
        elif self.status == SkillVerificationStatus.FAILED:
            return f"❌ Verification Failed: {self.skill_name}"
        elif self.status == SkillVerificationStatus.REVOKED:
            return f"⚠️ Revoked: {self.skill_name}"
        else:
            return f"📋 {self.skill_name}"


@dataclass
class PoSVerificationRequest:
    """Request for PoS verification."""
    user_id: str = ""
    skill_name: str = ""
    code_content: str = ""
    repository_url: str = ""
    branch: str = "main"
    commit_hash: str = ""
    chain: PoSChain = PoSChain.POLYGON
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PoSVerificationResponse:
    """Response for PoS verification."""
    success: bool = False
    message: str = ""
    proof: Optional[SkillProof] = None
    error: Optional[str] = None
    tx_hash: str = ""
    merkle_root: str = ""
    block_number: int = 0