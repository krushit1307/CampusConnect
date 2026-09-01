"""
Escrow Models for Vendor Bidding with Multi-modal Oracle Consensus
Models for escrow contracts with temperature, time, and computer vision validation.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
import uuid


class EscrowStatus(Enum):
    """Escrow contract status."""
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    DISPUTED = "disputed"
    SLASHED = "slashed"
    REFUNDED = "refunded"


class OracleStatus(Enum):
    """Oracle status."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    TIMEOUT = "timeout"


class FoodIntegrityStatus(Enum):
    """Food integrity classification."""
    INTACT = "intact"
    SLIGHTLY_DAMAGED = "slightly_damaged"
    MODERATELY_DAMAGED = "moderately_damaged"
    SEVERELY_DAMAGED = "severely_damaged"
    DESTROYED = "destroyed"


@dataclass
class TemperatureReading:
    """Temperature reading from IoT sensor."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    value: float = 0.0  # Fahrenheit
    timestamp: datetime = field(default_factory=datetime.now)
    sensor_id: str = ""
    is_valid: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'value': self.value,
            'timestamp': self.timestamp.isoformat(),
            'sensor_id': self.sensor_id,
            'is_valid': self.is_valid,
            'metadata': self.metadata
        }


@dataclass
class VisionAnalysis:
    """Computer vision analysis result."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    image_url: str = ""
    classification: FoodIntegrityStatus = FoodIntegrityStatus.INTACT
    confidence_score: float = 0.0
    integrity_score: float = 0.0  # 0-100
    damage_detected: bool = False
    damage_type: str = ""
    damage_percentage: float = 0.0
    processed_at: datetime = field(default_factory=datetime.now)
    raw_predictions: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'image_url': self.image_url,
            'classification': self.classification.value,
            'confidence_score': self.confidence_score,
            'integrity_score': self.integrity_score,
            'damage_detected': self.damage_detected,
            'damage_type': self.damage_type,
            'damage_percentage': self.damage_percentage,
            'processed_at': self.processed_at.isoformat(),
            'raw_predictions': self.raw_predictions,
            'metadata': self.metadata
        }

    def is_acceptable(self, threshold: float = 90.0) -> bool:
        """Check if the food is acceptable for release."""
        return self.integrity_score >= threshold and self.confidence_score >= 0.8


@dataclass
class TimeVerification:
    """Time verification for delivery."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    expected_delivery_time: datetime = field(default_factory=datetime.now)
    actual_delivery_time: datetime = field(default_factory=datetime.now)
    is_on_time: bool = False
    delay_minutes: int = 0
    is_valid: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'expected_delivery_time': self.expected_delivery_time.isoformat(),
            'actual_delivery_time': self.actual_delivery_time.isoformat(),
            'is_on_time': self.is_on_time,
            'delay_minutes': self.delay_minutes,
            'is_valid': self.is_valid,
            'metadata': self.metadata
        }


@dataclass
class OracleConsensus:
    """Multi-modal oracle consensus result."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    temperature_status: OracleStatus = OracleStatus.PENDING
    time_status: OracleStatus = OracleStatus.PENDING
    vision_status: OracleStatus = OracleStatus.PENDING
    consensus_reached: bool = False
    all_approved: bool = False
    rejection_reason: str = ""
    requires_manual_review: bool = False
    consensus_timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'temperature_status': self.temperature_status.value,
            'time_status': self.time_status.value,
            'vision_status': self.vision_status.value,
            'consensus_reached': self.consensus_reached,
            'all_approved': self.all_approved,
            'rejection_reason': self.rejection_reason,
            'requires_manual_review': self.requires_manual_review,
            'consensus_timestamp': self.consensus_timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class EscrowContract:
    """Escrow contract for vendor bidding."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    contract_address: str = ""
    vendor_id: str = ""
    client_id: str = ""
    amount: float = 0.0
    currency: str = "USDC"
    
    # Terms
    expected_delivery_time: datetime = field(default_factory=datetime.now)
    temperature_threshold: float = 140.0  # Fahrenheit
    integrity_threshold: float = 90.0  # 0-100
    max_delay_minutes: int = 15
    
    # Status
    status: EscrowStatus = EscrowStatus.PENDING
    temperature_reading: Optional[TemperatureReading] = None
    vision_analysis: Optional[VisionAnalysis] = None
    time_verification: Optional[TimeVerification] = None
    oracle_consensus: Optional[OracleConsensus] = None
    
    # Blockchain
    tx_hash: str = ""
    block_number: int = 0
    chain_id: int = 137  # Polygon
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    
    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'contract_address': self.contract_address,
            'vendor_id': self.vendor_id,
            'client_id': self.client_id,
            'amount': self.amount,
            'currency': self.currency,
            'expected_delivery_time': self.expected_delivery_time.isoformat(),
            'temperature_threshold': self.temperature_threshold,
            'integrity_threshold': self.integrity_threshold,
            'max_delay_minutes': self.max_delay_minutes,
            'status': self.status.value,
            'temperature_reading': self.temperature_reading.to_dict() if self.temperature_reading else None,
            'vision_analysis': self.vision_analysis.to_dict() if self.vision_analysis else None,
            'time_verification': self.time_verification.to_dict() if self.time_verification else None,
            'oracle_consensus': self.oracle_consensus.to_dict() if self.oracle_consensus else None,
            'tx_hash': self.tx_hash,
            'block_number': self.block_number,
            'chain_id': self.chain_id,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'metadata': self.metadata
        }

    def can_release_funds(self) -> bool:
        """Check if funds can be released."""
        if self.status != EscrowStatus.ACTIVE:
            return False
        
        if not self.oracle_consensus:
            return False
        
        return self.oracle_consensus.all_approved

    def should_slash(self) -> bool:
        """Check if escrow should be slashed."""
        if self.status != EscrowStatus.ACTIVE:
            return False
        
        if not self.oracle_consensus:
            return False
        
        # Slash if consensus not reached or any oracle rejected
        return not self.oracle_consensus.consensus_reached or not self.oracle_consensus.all_approved


@dataclass
class EscrowTransaction:
    """Escrow transaction record."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    escrow_id: str = ""
    from_address: str = ""
    to_address: str = ""
    amount: float = 0.0
    transaction_type: str = "deposit"  # deposit, release, slash, refund
    tx_hash: str = ""
    block_number: int = 0
    status: str = "pending"
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'escrow_id': self.escrow_id,
            'from_address': self.from_address,
            'to_address': self.to_address,
            'amount': self.amount,
            'transaction_type': self.transaction_type,
            'tx_hash': self.tx_hash,
            'block_number': self.block_number,
            'status': self.status,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class EscrowSlashEvent:
    """Escrow slash event."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    escrow_id: str = ""
    slashed_amount: float = 0.0
    reason: str = ""
    oracle_type: str = ""  # temperature, time, vision
    evidence: Dict[str, Any] = field(default_factory=dict)
    slash_timestamp: datetime = field(default_factory=datetime.now)
    tx_hash: str = ""
    block_number: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'escrow_id': self.escrow_id,
            'slashed_amount': self.slashed_amount,
            'reason': self.reason,
            'oracle_type': self.oracle_type,
            'evidence': self.evidence,
            'slash_timestamp': self.slash_timestamp.isoformat(),
            'tx_hash': self.tx_hash,
            'block_number': self.block_number,
            'metadata': self.metadata
        }