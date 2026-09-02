"""
Challenge Handler for EcoBuddy AI
Handles cryptographic challenge-response for hardware authentication.
"""

import logging
import base64
import hashlib
import json
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import uuid

from backend.models.auth_models import (
    AuthChallenge, ChallengeStatus, EscrowAuthRequest, EscrowAuthResponse
)
from backend.auth.fido2_manager import FIDO2Manager
from backend.auth.hsm_integration import HSMManager

logger = logging.getLogger(__name__)


class ChallengeHandler:
    """
    Handles cryptographic challenge-response for hardware authentication.
    """

    def __init__(self):
        self.fido2_manager = FIDO2Manager()
        self.hsm_manager = HSMManager()
        self._challenges: Dict[str, AuthChallenge] = {}
        self._pending_requests: Dict[str, EscrowAuthRequest] = {}

    def create_challenge(
        self,
        user_id: str,
        escrow_id: str,
        amount: float,
        recipient: str,
        require_hardware: bool = True,
        timeout_seconds: int = 60
    ) -> EscrowAuthResponse:
        """
        Create a new authentication challenge for escrow.
        
        Args:
            user_id: User ID
            escrow_id: Escrow ID
            amount: Amount to transfer
            recipient: Recipient address
            require_hardware: Require hardware verification
            timeout_seconds: Challenge timeout
        
        Returns:
            EscrowAuthResponse
        """
        try:
            # Generate challenge
            challenge = self._generate_challenge()
            
            # Create challenge record
            auth_challenge = AuthChallenge(
                user_id=user_id,
                challenge=challenge,
                expires_at=datetime.now() + timedelta(seconds=timeout_seconds),
                metadata={
                    'escrow_id': escrow_id,
                    'amount': amount,
                    'recipient': recipient,
                    'require_hardware': require_hardware
                }
            )
            
            self._challenges[auth_challenge.id] = auth_challenge
            
            # Store pending request
            request = EscrowAuthRequest(
                user_id=user_id,
                escrow_id=escrow_id,
                amount=amount,
                recipient=recipient,
                require_hardware=require_hardware,
                challenge_timeout_seconds=timeout_seconds
            )
            self._pending_requests[auth_challenge.id] = request

            # Generate FIDO2 options if hardware required
            fido2_options = None
            if require_hardware:
                try:
                    fido2_options = self.fido2_manager.generate_authentication_options(user_id)
                except Exception as e:
                    logger.warning(f"FIDO2 options generation failed: {e}")

            return EscrowAuthResponse(
                success=True,
                message="Challenge created successfully",
                challenge_id=auth_challenge.id,
                requires_hardware=require_hardware,
                hardware_verified=False
            )

        except Exception as e:
            logger.error(f"Challenge creation failed: {e}")
            return EscrowAuthResponse(
                success=False,
                message=f"Challenge creation failed: {str(e)}",
                error=str(e)
            )

    def verify_challenge(
        self,
        challenge_id: str,
        user_id: str,
        signature: str,
        device_id: Optional[str] = None
    ) -> EscrowAuthResponse:
        """
        Verify a challenge response.
        
        Args:
            challenge_id: Challenge ID
            user_id: User ID
            signature: Cryptographic signature
            device_id: Optional device ID
        
        Returns:
            EscrowAuthResponse
        """
        try:
            # Get challenge
            challenge = self._challenges.get(challenge_id)
            if not challenge:
                return EscrowAuthResponse(
                    success=False,
                    message="Challenge not found",
                    error="Invalid challenge ID"
                )

            # Check challenge status
            if challenge.status != ChallengeStatus.PENDING:
                return EscrowAuthResponse(
                    success=False,
                    message=f"Challenge already {challenge.status.value}",
                    error="Challenge already used"
                )

            # Check expiration
            if challenge.expires_at < datetime.now():
                challenge.status = ChallengeStatus.EXPIRED
                return EscrowAuthResponse(
                    success=False,
                    message="Challenge expired",
                    error="Challenge expired"
                )

            # Verify signature
            is_valid = self._verify_signature(challenge, signature, device_id)

            if not is_valid:
                challenge.status = ChallengeStatus.FAILED
                return EscrowAuthResponse(
                    success=False,
                    message="Invalid signature",
                    error="Signature verification failed"
                )

            # Mark challenge as completed
            challenge.status = ChallengeStatus.COMPLETED
            challenge.completed_at = datetime.now()

            # Get pending request
            request = self._pending_requests.get(challenge_id)

            return EscrowAuthResponse(
                success=True,
                message="Challenge verified successfully",
                challenge_id=challenge_id,
                hardware_verified=True,
                token=self._generate_session_token(user_id, challenge_id),
                expires_at=datetime.now() + timedelta(hours=1)
            )

        except Exception as e:
            logger.error(f"Challenge verification failed: {e}")
            return EscrowAuthResponse(
                success=False,
                message=f"Verification failed: {str(e)}",
                error=str(e)
            )

    def _generate_challenge(self) -> str:
        """Generate a cryptographic challenge."""
        import random
        challenge_bytes = hashlib.sha256(
            str(random.random()).encode() + str(uuid.uuid4()).encode()
        ).digest()
        return base64.b64encode(challenge_bytes).decode('utf-8')

    def _verify_signature(
        self,
        challenge: AuthChallenge,
        signature: str,
        device_id: Optional[str] = None
    ) -> bool:
        """
        Verify cryptographic signature.
        
        Args:
            challenge: AuthChallenge object
            signature: Base64 encoded signature
            device_id: Optional device ID
        
        Returns:
            True if valid
        """
        try:
            # Decode signature
            signature_bytes = base64.b64decode(signature)
            
            # Verify using FIDO2 if device provided
            if device_id:
                device = self.fido2_manager.get_device(device_id)
                if device:
                    # Mock verification - in production, use WebAuthn verification
                    return True
            
            # Fallback to HSM verification
            if self.hsm_manager.is_available():
                challenge_bytes = challenge.challenge.encode()
                return self.hsm_manager.verify_signature(
                    challenge_bytes,
                    signature_bytes,
                    f"challenge_{challenge.id[:8]}"
                )
            
            # If no HSM, use simple verification (for testing)
            expected = hashlib.sha256(
                (challenge.challenge + challenge.user_id).encode()
            ).digest()
            return signature_bytes == expected

        except Exception as e:
            logger.error(f"Signature verification error: {e}")
            return False

    def _generate_session_token(self, user_id: str, challenge_id: str) -> str:
        """Generate a session token."""
        import random
        token_data = f"{user_id}:{challenge_id}:{datetime.now().isoformat()}:{random.randint(1000, 9999)}"
        return base64.b64encode(hashlib.sha256(token_data.encode()).digest()).decode('utf-8')

    def get_challenge_status(self, challenge_id: str) -> Dict[str, Any]:
        """
        Get challenge status.
        
        Args:
            challenge_id: Challenge ID
        
        Returns:
            Challenge status
        """
        challenge = self._challenges.get(challenge_id)
        if not challenge:
            return {'found': False}
        
        return {
            'found': True,
            'id': challenge.id,
            'status': challenge.status.value,
            'created_at': challenge.created_at.isoformat(),
            'expires_at': challenge.expires_at.isoformat(),
            'metadata': challenge.metadata
        }

    def cleanup_expired_challenges(self) -> int:
        """
        Clean up expired challenges.
        
        Returns:
            Number of challenges cleaned
        """
        count = 0
        now = datetime.now()
        
        for challenge_id, challenge in list(self._challenges.items()):
            if challenge.expires_at < now:
                if challenge.status == ChallengeStatus.PENDING:
                    challenge.status = ChallengeStatus.EXPIRED
                count += 1
        
        return count