"""
FIDO2/WebAuthn Manager for EcoBuddy AI
Manages FIDO2 hardware token registration and authentication.
"""

import logging
import base64
import hashlib
import json
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import uuid

from backend.models.auth_models import (
    HardwareDevice, HardwareType, AuthChallenge, ChallengeStatus
)

logger = logging.getLogger(__name__)


class FIDO2Manager:
    """
    Manages FIDO2/WebAuthn hardware token operations.
    """

    def __init__(self):
        self._devices: Dict[str, HardwareDevice] = {}
        self._challenges: Dict[str, AuthChallenge] = {}
        self._rp_id = "ecobuddy.ai"
        self._rp_name = "EcoBuddy AI"

    def generate_registration_options(
        self,
        user_id: str,
        device_name: str,
        hardware_type: HardwareType = HardwareType.YUBIKEY
    ) -> Dict[str, Any]:
        """
        Generate registration options for a new hardware device.
        
        Args:
            user_id: User ID
            device_name: Device name
            hardware_type: Hardware type
        
        Returns:
            Registration options
        """
        # Generate challenge
        challenge = self._generate_challenge()
        
        # Create user ID
        user_handle = base64.urlsafe_b64encode(
            hashlib.sha256(user_id.encode()).digest()
        ).decode('utf-8').rstrip('=')

        return {
            'challenge': challenge,
            'rp': {
                'id': self._rp_id,
                'name': self._rp_name
            },
            'user': {
                'id': user_handle,
                'name': user_id,
                'displayName': user_id
            },
            'pubKeyCredParams': [
                {'type': 'public-key', 'alg': -7},  # ES256
                {'type': 'public-key', 'alg': -257},  # RS256
            ],
            'authenticatorSelection': {
                'authenticatorAttachment': 'cross-platform',
                'residentKey': 'preferred',
                'userVerification': 'required'
            },
            'attestation': 'direct',
            'timeout': 60000,
            'excludeCredentials': []
        }

    def verify_registration(
        self,
        user_id: str,
        device_name: str,
        registration_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[HardwareDevice], str]:
        """
        Verify hardware device registration.
        
        Args:
            user_id: User ID
            device_name: Device name
            registration_data: Registration data from client
        
        Returns:
            Tuple of (success, device, message)
        """
        try:
            # Validate registration data
            if not self._validate_registration_data(registration_data):
                return False, None, "Invalid registration data"

            # Extract credential
            credential_id = registration_data.get('id', '')
            public_key = registration_data.get('publicKey', '')
            
            if not credential_id or not public_key:
                return False, None, "Missing credential information"

            # Create device
            device = HardwareDevice(
                user_id=user_id,
                device_name=device_name,
                hardware_type=self._detect_hardware_type(registration_data),
                credential_id=credential_id,
                public_key=public_key,
                registered_at=datetime.now()
            )

            # Store device
            self._devices[device.id] = device

            logger.info(f"Registered FIDO2 device for user {user_id}: {device_name}")
            return True, device, "Device registered successfully"

        except Exception as e:
            logger.error(f"Registration verification failed: {e}")
            return False, None, f"Registration failed: {str(e)}"

    def generate_authentication_options(
        self,
        user_id: str,
        device_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate authentication options for hardware verification.
        
        Args:
            user_id: User ID
            device_id: Optional device ID
        
        Returns:
            Authentication options
        """
        # Get user devices
        devices = self._get_user_devices(user_id)
        
        if not devices:
            raise ValueError("No hardware devices registered")

        # Filter by device ID if provided
        if device_id:
            devices = [d for d in devices if d.id == device_id]
            if not devices:
                raise ValueError("Device not found")

        # Generate challenge
        challenge = self._generate_challenge()
        
        # Create challenge record
        auth_challenge = AuthChallenge(
            user_id=user_id,
            challenge=challenge,
            expires_at=datetime.now() + timedelta(seconds=60),
            metadata={'device_ids': [d.id for d in devices]}
        )
        self._challenges[auth_challenge.id] = auth_challenge

        return {
            'challenge': challenge,
            'rpId': self._rp_id,
            'timeout': 60000,
            'userVerification': 'required',
            'allowCredentials': [
                {
                    'type': 'public-key',
                    'id': base64.urlsafe_b64encode(d.credential_id.encode()).decode('utf-8').rstrip('='),
                    'transports': ['usb', 'nfc', 'ble']
                }
                for d in devices
            ]
        }

    def verify_authentication(
        self,
        user_id: str,
        auth_data: Dict[str, Any]
    ) -> Tuple[bool, Optional[HardwareDevice], str]:
        """
        Verify hardware authentication.
        
        Args:
            user_id: User ID
            auth_data: Authentication data from client
        
        Returns:
            Tuple of (success, device, message)
        """
        try:
            # Get challenge
            challenge_id = auth_data.get('challengeId', '')
            challenge = self._challenges.get(challenge_id)
            
            if not challenge:
                return False, None, "Invalid challenge"

            if challenge.status != ChallengeStatus.PENDING:
                return False, None, "Challenge already used"

            if challenge.expires_at < datetime.now():
                challenge.status = ChallengeStatus.EXPIRED
                return False, None, "Challenge expired"

            # Validate authentication
            credential_id = auth_data.get('credentialId', '')
            device = self._find_device_by_credential(user_id, credential_id)
            
            if not device:
                return False, None, "Device not found"

            # Update device counter
            device.counter += 1
            device.last_used_at = datetime.now()

            # Mark challenge as completed
            challenge.status = ChallengeStatus.COMPLETED
            challenge.completed_at = datetime.now()

            logger.info(f"FIDO2 authentication successful for user {user_id}")
            return True, device, "Authentication successful"

        except Exception as e:
            logger.error(f"Authentication verification failed: {e}")
            return False, None, f"Authentication failed: {str(e)}"

    def _generate_challenge(self) -> str:
        """Generate a cryptographic challenge."""
        return base64.urlsafe_b64encode(
            hashlib.sha256(str(uuid.uuid4()).encode()).digest()
        ).decode('utf-8').rstrip('=')

    def _validate_registration_data(self, data: Dict[str, Any]) -> bool:
        """Validate registration data."""
        required_fields = ['id', 'publicKey', 'attestationObject', 'clientDataJSON']
        return all(field in data for field in required_fields)

    def _detect_hardware_type(self, data: Dict[str, Any]) -> HardwareType:
        """Detect hardware type from registration data."""
        # In production, parse attestation statement
        # For now, use default
        return HardwareType.YUBIKEY

    def _get_user_devices(self, user_id: str) -> list:
        """Get devices for a user."""
        return [d for d in self._devices.values() if d.user_id == user_id and d.is_active]

    def _find_device_by_credential(self, user_id: str, credential_id: str) -> Optional[HardwareDevice]:
        """Find device by credential ID."""
        for device in self._devices.values():
            if device.user_id == user_id and device.credential_id == credential_id:
                return device
        return None

    def revoke_device(self, device_id: str) -> bool:
        """Revoke a hardware device."""
        device = self._devices.get(device_id)
        if device:
            device.is_active = False
            logger.info(f"Revoked device: {device_id}")
            return True
        return False

    def get_device(self, device_id: str) -> Optional[HardwareDevice]:
        """Get device by ID."""
        return self._devices.get(device_id)

    def list_devices(self, user_id: str) -> List[Dict[str, Any]]:
        """List devices for a user."""
        devices = self._get_user_devices(user_id)
        return [d.to_dict() for d in devices]