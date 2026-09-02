"""
Fingerprint Models for Canvas/WebGL Detection
Models for browser fingerprinting and headless detection.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
import uuid


class FingerprintType(Enum):
    """Types of fingerprints."""
    CANVAS = "canvas"
    WEBGL = "webgl"
    AUDIO = "audio"
    FONT = "font"
    COMPOSITE = "composite"


class DeviceClass(Enum):
    """Device classification."""
    DESKTOP = "desktop"
    MOBILE = "mobile"
    TABLET = "tablet"
    HEADLESS = "headless"
    BOT = "bot"
    UNKNOWN = "unknown"


class RiskLevel(Enum):
    """Risk level for fingerprint."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class CanvasFingerprint:
    """Canvas fingerprint data."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    fingerprint_type: FingerprintType = FingerprintType.CANVAS
    hash_value: str = ""
    width: int = 0
    height: int = 0
    pixel_data_hash: str = ""
    webgl_hash: str = ""
    renderer_info: str = ""
    gpu_info: str = ""
    os_info: str = ""
    device_class: DeviceClass = DeviceClass.UNKNOWN
    risk_level: RiskLevel = RiskLevel.LOW
    is_headless: bool = False
    is_bot: bool = False
    confidence_score: float = 0.0
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'session_id': self.session_id,
            'fingerprint_type': self.fingerprint_type.value,
            'hash_value': self.hash_value[:50] + '...' if self.hash_value else '',
            'width': self.width,
            'height': self.height,
            'pixel_data_hash': self.pixel_data_hash[:50] + '...' if self.pixel_data_hash else '',
            'webgl_hash': self.webgl_hash[:50] + '...' if self.webgl_hash else '',
            'renderer_info': self.renderer_info,
            'gpu_info': self.gpu_info,
            'os_info': self.os_info,
            'device_class': self.device_class.value,
            'risk_level': self.risk_level.value,
            'is_headless': self.is_headless,
            'is_bot': self.is_bot,
            'confidence_score': self.confidence_score,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class WebGLFingerprint:
    """WebGL fingerprint data."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    renderer_hash: str = ""
    vendor_hash: str = ""
    shading_language_hash: str = ""
    extensions_hash: str = ""
    max_texture_size: int = 0
    max_vertex_attribs: int = 0
    max_vertex_uniforms: int = 0
    max_fragment_uniforms: int = 0
    max_varying_vectors: int = 0
    renderer_info: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'session_id': self.session_id,
            'renderer_hash': self.renderer_hash[:50] + '...' if self.renderer_hash else '',
            'vendor_hash': self.vendor_hash[:50] + '...' if self.vendor_hash else '',
            'shading_language_hash': self.shading_language_hash[:50] + '...' if self.shading_language_hash else '',
            'extensions_hash': self.extensions_hash[:50] + '...' if self.extensions_hash else '',
            'max_texture_size': self.max_texture_size,
            'max_vertex_attribs': self.max_vertex_attribs,
            'max_vertex_uniforms': self.max_vertex_uniforms,
            'max_fragment_uniforms': self.max_fragment_uniforms,
            'max_varying_vectors': self.max_varying_vectors,
            'renderer_info': self.renderer_info,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class FingerprintAnalysis:
    """Complete fingerprint analysis."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    canvas_fingerprint: Optional[CanvasFingerprint] = None
    webgl_fingerprint: Optional[WebGLFingerprint] = None
    device_class: DeviceClass = DeviceClass.UNKNOWN
    risk_level: RiskLevel = RiskLevel.LOW
    is_headless: bool = False
    is_bot: bool = False
    confidence_score: float = 0.0
    matched_known_bot: bool = False
    known_bot_id: Optional[str] = None
    analysis_timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'session_id': self.session_id,
            'device_class': self.device_class.value,
            'risk_level': self.risk_level.value,
            'is_headless': self.is_headless,
            'is_bot': self.is_bot,
            'confidence_score': self.confidence_score,
            'matched_known_bot': self.matched_known_bot,
            'known_bot_id': self.known_bot_id,
            'analysis_timestamp': self.analysis_timestamp.isoformat(),
            'metadata': self.metadata
        }


@dataclass
class HeadlessDetectionResult:
    """Result of headless detection."""
    detected: bool = False
    confidence: float = 0.0
    signals: List[str] = field(default_factory=list)
    evidence: Dict[str, Any] = field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.LOW
    recommendation: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'detected': self.detected,
            'confidence': self.confidence,
            'signals': self.signals,
            'evidence': self.evidence,
            'risk_level': self.risk_level.value,
            'recommendation': self.recommendation,
            'timestamp': self.timestamp.isoformat()
        }