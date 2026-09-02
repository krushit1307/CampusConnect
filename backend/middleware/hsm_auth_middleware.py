"""
HSM Authentication Middleware for EcoBuddy AI
Middleware for enforcing hardware-based authentication.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime

from backend.auth.hsm_integration import HSMManager
from backend.auth.fido2_manager import FIDO2Manager
from backend.auth.challenge_handler import ChallengeHandler

logger = logging.getLogger(__name__)


class HSMAuthMiddleware:
    """
    Middleware for enforcing HSM/FIDO2 authentication.
    """

    def __init__(self):
        self.hsm_manager = HSMManager()
        self.fido2_manager = FIDO2Manager()
        self.challenge_handler = ChallengeHandler()
        self.required_paths = [
            '/api/escrow/transfer',
            '/api/escrow/release',
            '/api/escrow/slash',
            '/api/admin/funds',
            '/api/vendor/payout'
        ]

    async def __call__(self, request: Request, call_next):
        """
        Process request through middleware.
        
        Args:
            request: FastAPI request
            call_next: Next middleware
        
        Returns:
            Response
        """
        path = request.url.path
        
        # Check if path requires hardware auth
        requires_hardware = any(path.startswith(p) for p in self.required_paths)
        
        if requires_hardware:
            # Validate hardware authentication
            auth_valid = await self.validate_hardware_auth(request)
            
            if not auth_valid:
                raise HTTPException(
                    status_code=401,
                    detail="Hardware authentication required for this operation"
                )
        
        # Add HSM info to request state
        request.state.hsm_available = self.hsm_manager.is_available()
        request.state.hsm_info = self.hsm_manager.get_hsm_info()
        
        return await call_next(request)

    async def validate_hardware_auth(self, request: Request) -> bool:
        """
        Validate hardware authentication.
        
        Args:
            request: FastAPI request
        
        Returns:
            True if valid
        """
        # Check for hardware auth header
        auth_header = request.headers.get('X-Hardware-Auth')
        if not auth_header:
            return False

        # Check for challenge ID
        challenge_id = request.headers.get('X-Challenge-Id')
        if not challenge_id:
            return False

        # Check for signature
        signature = request.headers.get('X-Signature')
        if not signature:
            return False

        # Get user ID from JWT
        user_id = await self._get_user_id(request)
        if not user_id:
            return False

        # Verify challenge
        result = self.challenge_handler.verify_challenge(
            challenge_id=challenge_id,
            user_id=user_id,
            signature=signature
        )

        if result.success and result.hardware_verified:
            # Add verification to request state
            request.state.hardware_verified = True
            request.state.verification_token = result.token
            return True

        return False

    async def _get_user_id(self, request: Request) -> Optional[str]:
        """
        Extract user ID from request.
        
        Args:
            request: FastAPI request
        
        Returns:
            User ID
        """
        # Check Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
            try:
                # Decode JWT - in production, use proper validation
                payload = jwt.decode(token, options={'verify_signature': False})
                return payload.get('sub')
            except:
                pass

        # Check session
        session_id = request.cookies.get('session_id')
        if session_id:
            # In production, validate session
            return session_id

        return None

    def get_required_paths(self) -> list:
        """Get paths that require hardware authentication."""
        return self.required_paths

    def add_required_path(self, path: str) -> None:
        """Add a path to the required list."""
        if path not in self.required_paths:
            self.required_paths.append(path)