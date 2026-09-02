"""
Authentication API Endpoints for EcoBuddy AI
REST API for hardware-based authentication.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Body, Header
from typing import Optional, Dict, Any
from datetime import datetime

from backend.models.auth_models import AuthMethod
from backend.services.auth_service import AuthService
from backend.middleware.hsm_auth_middleware import HSMAuthMiddleware

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Initialize services
_auth_service = AuthService()
_auth_middleware = HSMAuthMiddleware()


@router.post("/device/register")
async def register_hardware_device(
    user_id: str = Body(...),
    device_name: str = Body(...),
    hardware_type: str = Body("yubikey")
) -> Dict[str, Any]:
    """
    Register a hardware device for authentication.
    """
    try:
        result = _auth_service.register_hardware_device(
            user_id, device_name, hardware_type
        )
        return {
            'success': True,
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/device/verify")
async def verify_device_registration(
    user_id: str = Body(...),
    device_name: str = Body(...),
    registration_data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Verify hardware device registration.
    """
    try:
        result = _auth_service.verify_device_registration(
            user_id, device_name, registration_data
        )
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['message'])
        return {
            'success': True,
            'data': result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/escrow/challenge")
async def create_escrow_challenge(
    user_id: str = Body(...),
    escrow_id: str = Body(...),
    amount: float = Body(...),
    recipient: str = Body(...),
    require_hardware: bool = Body(True)
) -> Dict[str, Any]:
    """
    Create an escrow authentication challenge.
    """
    try:
        result = _auth_service.create_escrow_auth(
            user_id, escrow_id, amount, recipient, require_hardware
        )
        if not result.success:
            raise HTTPException(status_code=400, detail=result.message)
        return {
            'success': True,
            'data': {
                'challenge_id': result.challenge_id,
                'requires_hardware': result.requires_hardware,
                'message': result.message
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/escrow/verify")
async def verify_escrow_challenge(
    challenge_id: str = Body(...),
    user_id: str = Body(...),
    signature: str = Body(...),
    device_id: Optional[str] = Body(None)
) -> Dict[str, Any]:
    """
    Verify escrow authentication challenge.
    """
    try:
        result = _auth_service.verify_escrow_auth(
            challenge_id, user_id, signature, device_id
        )
        if not result.success:
            raise HTTPException(status_code=401, detail=result.message)
        return {
            'success': True,
            'data': {
                'verified': True,
                'hardware_verified': result.hardware_verified,
                'token': result.token,
                'expires_at': result.expires_at.isoformat() if result.expires_at else None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/device/list")
async def list_devices(user_id: str = Query(...)) -> Dict[str, Any]:
    """
    List hardware devices for a user.
    """
    try:
        devices = _auth_service.get_user_devices(user_id)
        return {
            'success': True,
            'data': devices,
            'count': len(devices)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/device/{device_id}")
async def revoke_device(
    device_id: str,
    user_id: str = Query(...)
) -> Dict[str, Any]:
    """
    Revoke a hardware device.
    """
    try:
        result = _auth_service.revoke_device(user_id, device_id)
        if not result['success']:
            raise HTTPException(status_code=404, detail=result['message'])
        return {
            'success': True,
            'message': result['message']
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_auth_statistics(user_id: str = Query(...)) -> Dict[str, Any]:
    """
    Get authentication statistics.
    """
    try:
        stats = _auth_service.get_auth_statistics(user_id)
        return {
            'success': True,
            'data': stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenge/status/{challenge_id}")
async def get_challenge_status(challenge_id: str) -> Dict[str, Any]:
    """
    Get challenge status.
    """
    try:
        status = _auth_service.challenge_handler.get_challenge_status(challenge_id)
        if not status.get('found'):
            raise HTTPException(status_code=404, detail="Challenge not found")
        return {
            'success': True,
            'data': status
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hsm/status")
async def get_hsm_status() -> Dict[str, Any]:
    """
    Get HSM status.
    """
    try:
        hsm_manager = _auth_service.hsm_manager
        return {
            'success': True,
            'data': {
                'available': hsm_manager.is_available(),
                'info': hsm_manager.get_hsm_info()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))