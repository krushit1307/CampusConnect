"""
Density Models for EcoBuddy AI
Models for acoustic density detection with FHE encryption.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
import uuid


class DensityLevel(Enum):
    """Density level classification."""
    EMPTY = "empty"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class PrivacyLevel(Enum):
    """Privacy level for data."""
    RAW = "raw"
    AGGREGATED = "aggregated"
    ENCRYPTED = "encrypted"
    HOMOMORPHIC = "homomorphic"


@dataclass
class DensityReading:
    """Density reading from IoT microphone."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str = ""
    location: str = ""
    building: str = ""
    floor: int = 0
    room: str = ""
    density_score: float = 0.0  # 0-100
    density_level: DensityLevel = DensityLevel.EMPTY
    encrypted_value: str = ""
    ciphertext: bytes = b""
    timestamp: datetime = field(default_factory=datetime.now)
    is_encrypted: bool = False
    privacy_level: PrivacyLevel = PrivacyLevel.RAW
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'device_id': self.device_id,
            'location': self.location,
            'building': self.building,
            'floor': self.floor,
            'room': self.room,
            'density_score': self.density_score,
            'density_level': self.density_level.value,
            'encrypted_value': self.encrypted_value,
            'timestamp': self.timestamp.isoformat(),
            'is_encrypted': self.is_encrypted,
            'privacy_level': self.privacy_level.value,
            'metadata': self.metadata
        }


@dataclass
class EncryptedDensityReading:
    """Encrypted density reading."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    ciphertext: bytes = b""
    device_id: str = ""
    building: str = ""
    floor: int = 0
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'ciphertext': self.ciphertext.hex(),
            'device_id': self.device_id,
            'building': self.building,
            'floor': self.floor,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class AggregatedDensity:
    """Aggregated density data."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    building: str = ""
    floor: Optional[int] = None
    total_density: float = 0.0
    average_density: float = 0.0
    max_density: float = 0.0
    min_density: float = 0.0
    reading_count: int = 0
    encrypted_total: bytes = b""
    is_encrypted: bool = False
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'building': self.building,
            'floor': self.floor,
            'total_density': self.total_density,
            'average_density': self.average_density,
            'max_density': self.max_density,
            'min_density': self.min_density,
            'reading_count': self.reading_count,
            'is_encrypted': self.is_encrypted,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class DensityQuery:
    """Density query request."""
    building: str = ""
    floor: Optional[int] = None
    room: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    aggregate_by: str = "building"  # building, floor, room
    include_encrypted: bool = True
    privacy_level: PrivacyLevel = PrivacyLevel.HOMOMORPHIC


@dataclass
class DensityAlert:
    """Density alert for overcrowding."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    location: str = ""
    building: str = ""
    floor: int = 0
    room: str = ""
    density_score: float = 0.0
    threshold: float = 80.0
    severity: str = "warning"  # warning, critical, emergency
    timestamp: datetime = field(default_factory=datetime.now)
    acknowledged: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'location': self.location,
            'building': self.building,
            'floor': self.floor,
            'room': self.room,
            'density_score': self.density_score,
            'threshold': self.threshold,
            'severity': self.severity,
            'timestamp': self.timestamp.isoformat(),
            'acknowledged': self.acknowledged,
            'metadata': self.metadata
        }