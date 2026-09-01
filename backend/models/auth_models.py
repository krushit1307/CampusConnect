"""
Authentication Models for HSM/FIDO2 Integration
Models for hardware-based authentication and token validation.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime
import uuid


class AuthMethod(Enum):
    """Authentication methods."""
    JWT = "jwt"
    FIDO2 = "fido2"
    HSM = "hsm"
    BIOMETRIC = "biometric"
    HYBRID = "hybrid"


class HardwareType(Enum):
    """Hardware security types."""
    YUBIKEY = "yubikey"
    SOLO_KEY = "solokey"
    NITROKEY = "nitrokey"
    GOOGLE_TITAN = "google_titan"
    APPLE_SECURE_ENCLAVE = "apple_secure_enclave"
    ANDROID_STRONGBOX = "android_strongbox"
    TPM = "tpm"
    CUSTOM = "custom"


class ChallengeStatus(Enum):
    """Challenge status."""
    PENDING = "pending"
    COMPLETED = "completed"
    EXPIRED = "expired"
    REVOKED = "revoked"
    FAILED = "failed"


@dataclass
class HardwareDevice:
    """Hardware security device registration."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    device_name: str = ""
    hardware_type: HardwareType = HardwareType.YUBIKEY
    credential_id: str = ""
    public_key: str = ""
    counter: int = 0
    is_active: bool = True
    registered_at: datetime = field(default_factory=datetime.now)
    last_used_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'device_name': self.device_name,
            'hardware_type': self.hardware_type.value,
            'credential_id': self.credential_id,
            'public_key': self.public_key[:50] + '...' if self.public_key else '',
            'counter': self.counter,
            'is_active': self.is_active,
            'registered_at': self.registered_at.isoformat(),
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'metadata': self.metadata
        }


@dataclass
class AuthChallenge:
    """Authentication challenge for hardware verification."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    challenge: str = ""
    expires_at: datetime = field(default_factory=lambda: datetime.now())
    status: ChallengeStatus = ChallengeStatus.PENDING
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'challenge': self.challenge,
            'expires_at': self.expires_at.isoformat(),
            'status': self.status.value,
            'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'metadata': self.metadata
        }


@dataclass
class AuthSession:
    """Enhanced authentication session."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    session_token: str = ""
    auth_method: AuthMethod = AuthMethod.HYBRID
    hardware_device_id: Optional[str] = None
    challenge_id: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: datetime = field(default_factory=lambda: datetime.now())
    ip_address: str = ""
    user_agent: str = ""
    is_valid: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'session_token': self.session_token[:20] + '...' if self.session_token else '',
            'auth_method': self.auth_method.value,
            'hardware_device_id': self.hardware_device_id,
            'challenge_id': self.challenge_id,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'expires_at': self.expires_at.isoformat(),
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'is_valid': self.is_valid,
            'metadata': self.metadata
        }


@dataclass
class AuthAuditLog:
    """Audit log for authentication events."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    action: str = ""
    auth_method: AuthMethod = AuthMethod.JWT
    success: bool = False
    ip_address: str = ""
    user_agent: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'action': self.action,
            'auth_method': self.auth_method.value,
            'success': self.success,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'details': self.details,
            'timestamp': self.timestamp.isoformat()
        }


@dataclass
class EscrowAuthRequest:
    """Escrow authentication request."""
    user_id: str = ""
    escrow_id: str = ""
    amount: float = 0.0
    recipient: str = ""
    require_hardware: bool = True
    challenge_timeout_seconds: int = 60
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EscrowAuthResponse:
    """Escrow authentication response."""
    success: bool = False
    message: str = ""
    challenge_id: Optional[str] = None
    requires_hardware: bool = True
    hardware_verified: bool = False
    session_id: Optional[str] = None
    token: Optional[str] = None
    expires_at: Optional[datetime] = None
    error: Optional[str] = None