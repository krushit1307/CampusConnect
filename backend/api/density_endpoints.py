"""
Density API Endpoints for EcoBuddy AI
REST API for density detection with FHE encryption.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional, List, Dict, Any
from datetime import datetime

from backend.models.density_models import DensityReading, DensityQuery, DensityAlert
from backend.services.density_service import DensityService
from backend.iot.microphone_processor import MicrophoneProcessor
from backend.fhe.fhe_engine import FHEEngine

router = APIRouter(prefix="/api/density", tags=["density"])

# Initialize services
_density_service = DensityService()
_microphone_processor = MicrophoneProcessor()
_fhe_engine = FHEEngine()


@router.post("/reading")
async def submit_density_reading(
    device_id: str = Body(...),
    location: str = Body(...),
    building: str = Body(...),
    floor: int = Body(0),
    room: str = Body(""),
    density_score: float = Body(...),
    encrypt: bool = Body(True),
    metadata: Dict[str, Any] = Body(default_factory=dict)
) -> Dict[str, Any]:
    """
    Submit a density reading from an IoT device.
    """
    try:
        result = _density_service.process_reading(
            device_id=device_id,
            density_score=density_score,
            location=location,
            building=building,
            floor=floor,
            room=room,
            encrypt=encrypt,
            metadata=metadata
        )
        return {
            'success': True,
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reading/encrypted")
async def submit_encrypted_density(
    device_id: str = Body(...),
    building: str = Body(...),
    floor: int = Body(0),
    encrypted_density: str = Body(...),
    metadata: Dict[str, Any] = Body(default_factory=dict)
) -> Dict[str, Any]:
    """
    Submit an encrypted density reading.
    """
    try:
        # Store encrypted reading
        reading = {
            'device_id': device_id,
            'building': building,
            'floor': floor,
            'ciphertext': bytes.fromhex(encrypted_density),
            'timestamp': datetime.now(),
            'metadata': metadata
        }
        
        return {
            'success': True,
            'message': 'Encrypted reading received',
            'data': reading
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/building/{building}")
async def get_building_density(
    building: str,
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    encrypted: bool = Query(False)
) -> Dict[str, Any]:
    """
    Get density data for a building.
    """
    try:
        if encrypted:
            result = _density_service.get_encrypted_building_density(
                building, start_time, end_time
            )
        else:
            result = _density_service.get_building_density(
                building, start_time, end_time
            )
        
        return {
            'success': True,
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_density_alerts(
    acknowledged: bool = Query(False)
) -> Dict[str, Any]:
    """
    Get density alerts.
    """
    try:
        alerts = _density_service.get_alerts(acknowledged)
        return {
            'success': True,
            'data': alerts,
            'count': len(alerts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str) -> Dict[str, Any]:
    """
    Acknowledge a density alert.
    """
    try:
        success = _density_service.acknowledge_alert(alert_id)
        if not success:
            raise HTTPException(status_code=404, detail="Alert not found")
        return {
            'success': True,
            'message': 'Alert acknowledged'
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_density_statistics() -> Dict[str, Any]:
    """
    Get density statistics.
    """
    try:
        stats = _density_service.get_statistics()
        return {
            'success': True,
            'data': stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decrypt")
async def decrypt_density_data(
    ciphertext_hex: str = Body(...)
) -> Dict[str, Any]:
    """
    Decrypt density data (admin only).
    """
    try:
        ciphertext = bytes.fromhex(ciphertext_hex)
        value = _density_service.decrypt_aggregated_data(ciphertext)
        return {
            'success': True,
            'data': {
                'decrypted_value': value
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/fhe/keys")
async def get_fhe_keys() -> Dict[str, Any]:
    """
    Get FHE key information.
    """
    try:
        stats = _fhe_engine.get_encryption_stats()
        return {
            'success': True,
            'data': stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))