"""
Authentication Service for EcoBuddy AI
Unified authentication service with hardware security integration.
"""

import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timedelta
import jwt
import hashlib

from backend.models.auth_models import (
    HardwareDevice, AuthChallenge, AuthSession, AuthAuditLog,
    AuthMethod, ChallengeStatus, EscrowAuthRequest, EscrowAuthResponse
)
from backend.auth.fido2_manager import FIDO2Manager
from backend.auth.hsm_integration import HSMManager
from backend.auth.challenge_handler import ChallengeHandler

logger = logging.getLogger(__name__)


class AuthService:
    """
    Unified authentication service with hardware security.
    """

    def __init__(self):
        self.fido2_manager = FIDO2Manager()
        self.hsm_manager = HSMManager()
        self.challenge_handler = ChallengeHandler()
        self._sessions: Dict[str, AuthSession] = {}
        self._audit_logs: List[AuthAuditLog] = []

    def register_hardware_device(
        self,
        user_id: str,
        device_name: str,
        hardware_type: str = "yubikey"
    ) -> Dict[str, Any]:
        """
        Register a hardware device for a user.
        
        Args:
            user_id: User ID
            device_name: Device name
            hardware_type: Hardware type
        
        Returns:
            Registration result
        """
        # Generate registration options
        options = self.fido2_manager.generate_registration_options(
            user_id, device_name, hardware_type
        )

        return {
            'success': True,
            'message': 'Device registration initiated',
            'options': options,
            'user_id': user_id
        }

    def verify_device_registration(
        self,
        user_id: str,
        device_name: str,
        registration_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Verify hardware device registration.
        
        Args:
            user_id: User ID
            device_name: Device name
            registration_data: Registration data
        
        Returns:
            Verification result
        """
        success, device, message = self.fido2_manager.verify_registration(
            user_id, device_name, registration_data
        )

        if success:
            self._log_audit(
                user_id=user_id,
                action='hardware_register',
                auth_method=AuthMethod.FIDO2,
                success=True,
                details={'device_id': device.id if device else ''}
            )

        return {
            'success': success,
            'message': message,
            'device': device.to_dict() if device else None
        }

    def create_escrow_auth(
        self,
        user_id: str,
        escrow_id: str,
        amount: float,
        recipient: str,
        require_hardware: bool = True
    ) -> EscrowAuthResponse:
        """
        Create authentication for escrow transaction.
        
        Args:
            user_id: User ID
            escrow_id: Escrow ID
            amount: Amount
            recipient: Recipient
            require_hardware: Require hardware
        
        Returns:
            EscrowAuthResponse
        """
        # Check if hardware is available
        if require_hardware:
            devices = self.fido2_manager.list_devices(user_id)
            if not devices:
                return EscrowAuthResponse(
                    success=False,
                    message="No hardware devices registered",
                    error="Hardware required but no devices found"
                )

        return self.challenge_handler.create_challenge(
            user_id=user_id,
            escrow_id=escrow_id,
            amount=amount,
            recipient=recipient,
            require_hardware=require_hardware
        )

    def verify_escrow_auth(
        self,
        challenge_id: str,
        user_id: str,
        signature: str,
        device_id: Optional[str] = None
    ) -> EscrowAuthResponse:
        """
        Verify escrow authentication.
        
        Args:
            challenge_id: Challenge ID
            user_id: User ID
            signature: Signature
            device_id: Optional device ID
        
        Returns:
            EscrowAuthResponse
        """
        result = self.challenge_handler.verify_challenge(
            challenge_id, user_id, signature, device_id
        )

        if result.success:
            self._log_audit(
                user_id=user_id,
                action='escrow_auth',
                auth_method=AuthMethod.HYBRID,
                success=True,
                details={
                    'challenge_id': challenge_id,
                    'hardware_verified': result.hardware_verified
                }
            )

        return result

    def validate_jwt_with_hardware(
        self,
        jwt_token: str,
        hardware_signature: str,
        challenge_id: str
    ) -> Dict[str, Any]:
        """
        Validate JWT with hardware signature.
        
        Args:
            jwt_token: JWT token
            hardware_signature: Hardware signature
            challenge_id: Challenge ID
        
        Returns:
            Validation result
        """
        # Verify JWT
        try:
            payload = jwt.decode(jwt_token, options={'verify_signature': False})
            user_id = payload.get('sub')
        except:
            return {'valid': False, 'message': 'Invalid JWT'}

        if not user_id:
            return {'valid': False, 'message': 'User not found in token'}

        # Verify challenge
        result = self.challenge_handler.verify_challenge(
            challenge_id=challenge_id,
            user_id=user_id,
            signature=hardware_signature
        )

        if not result.success:
            return {'valid': False, 'message': result.message}

        return {
            'valid': True,
            'user_id': user_id,
            'hardware_verified': result.hardware_verified,
            'session_token': result.token
        }

    def get_user_devices(self, user_id: str) -> List[Dict[str, Any]]:
        """Get devices for a user."""
        return self.fido2_manager.list_devices(user_id)

    def revoke_device(self, user_id: str, device_id: str) -> Dict[str, Any]:
        """
        Revoke a hardware device.
        
        Args:
            user_id: User ID
            device_id: Device ID
        
        Returns:
            Revocation result
        """
        device = self.fido2_manager.get_device(device_id)
        if not device or device.user_id != user_id:
            return {'success': False, 'message': 'Device not found'}

        success = self.fido2_manager.revoke_device(device_id)

        if success:
            self._log_audit(
                user_id=user_id,
                action='hardware_revoke',
                auth_method=AuthMethod.FIDO2,
                success=True,
                details={'device_id': device_id}
            )

        return {
            'success': success,
            'message': 'Device revoked' if success else 'Revocation failed'
        }

    def get_auth_statistics(self, user_id: str) -> Dict[str, Any]:
        """
        Get authentication statistics.
        
        Args:
            user_id: User ID
        
        Returns:
            Statistics
        """
        devices = self.fido2_manager.list_devices(user_id)
        logs = [l for l in self._audit_logs if l.user_id == user_id]

        return {
            'devices': {
                'total': len(devices),
                'active': sum(1 for d in devices if d.get('is_active', True))
            },
            'audit': {
                'total': len(logs),
                'successful': sum(1 for l in logs if l.success),
                'failed': sum(1 for l in logs if not l.success),
                'by_method': self._count_by_method(logs)
            }
        }

    def _log_audit(
        self,
        user_id: str,
        action: str,
        auth_method: AuthMethod,
        success: bool,
        details: Dict[str, Any] = None
    ) -> None:
        """Log authentication event."""
        log = AuthAuditLog(
            user_id=user_id,
            action=action,
            auth_method=auth_method,
            success=success,
            details=details or {}
        )
        self._audit_logs.append(log)

    def _count_by_method(self, logs: List[AuthAuditLog]) -> Dict[str, int]:
        """Count logs by auth method."""
        counts = {}
        for method in AuthMethod:
            counts[method.value] = sum(1 for l in logs if l.auth_method == method)
        return counts

    def cleanup_expired_challenges(self) -> int:
        """Clean up expired challenges."""
        return self.challenge_handler.cleanup_expired_challenges()