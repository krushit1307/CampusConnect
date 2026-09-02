"""
Fingerprint Middleware for EcoBuddy AI
Middleware for fingerprint collection and validation.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import Request, Response
import json

from backend.services.fingerprint_service import FingerprintService
from backend.models.fingerprint_models import RiskLevel

logger = logging.getLogger(__name__)


class FingerprintMiddleware:
    """
    Middleware for collecting and validating browser fingerprints.
    """

    def __init__(self):
        self.fingerprint_service = FingerprintService()
        self.blocked_risk_levels = [RiskLevel.CRITICAL, RiskLevel.HIGH]
        self.exempt_paths = [
            '/api/fingerprint/collect',
            '/api/health',
            '/api/auth/login',
            '/api/auth/register'
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

        # Skip exempt paths
        if path in self.exempt_paths:
            return await call_next(request)

        # Check for fingerprint header
        fingerprint_header = request.headers.get('X-Fingerprint')
        session_id = request.headers.get('X-Session-Id', '')

        if fingerprint_header:
            try:
                fingerprint_data = json.loads(fingerprint_header)
                canvas_data = fingerprint_data.get('canvas', {})
                webgl_data = fingerprint_data.get('webgl', {})

                if canvas_data or webgl_data:
                    # Analyze fingerprint
                    analysis = self.fingerprint_service.analyze_fingerprints(
                        canvas_data, webgl_data, session_id
                    )

                    # Check if should block
                    if self._should_block(analysis):
                        request.state.blocked = True
                        request.state.block_reason = f"Headless browser detected: {analysis.risk_level.value}"
                        logger.warning(f"Blocked request from session {session_id}: {analysis.risk_level.value}")

                        # Add to request state
                        request.state.fingerprint_analysis = analysis

            except Exception as e:
                logger.error(f"Fingerprint processing failed: {e}")

        # Add fingerprint service to request state
        request.state.fingerprint_service = self.fingerprint_service

        response = await call_next(request)

        # Check if blocked
        if hasattr(request.state, 'blocked') and request.state.blocked:
            return Response(
                content=json.dumps({
                    'error': 'Blocked',
                    'message': request.state.block_reason,
                    'status': 403
                }),
                status_code=403,
                media_type='application/json'
            )

        return response

    def _should_block(self, analysis) -> bool:
        """Check if request should be blocked."""
        if analysis.is_headless:
            return True
        if analysis.is_bot:
            return True
        if analysis.risk_level in self.blocked_risk_levels:
            return True
        return False

    def add_exempt_path(self, path: str) -> None:
        """Add a path to exempt list."""
        if path not in self.exempt_paths:
            self.exempt_paths.append(path)

    def remove_exempt_path(self, path: str) -> bool:
        """Remove a path from exempt list."""
        if path in self.exempt_paths:
            self.exempt_paths.remove(path)
            return True
        return False

    def get_exempt_paths(self) -> list:
        """Get exempt paths."""
        return self.exempt_paths