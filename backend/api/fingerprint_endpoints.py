"""
Fingerprint API Endpoints for EcoBuddy AI
REST API for fingerprint collection and analysis.
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Body
from typing import Optional, Dict, Any
from datetime import datetime

from backend.services.fingerprint_service import FingerprintService
from backend.models.fingerprint_models import RiskLevel

router = APIRouter(prefix="/api/fingerprint", tags=["fingerprint"])

# Initialize service
_fingerprint_service = FingerprintService()


@router.post("/collect")
async def collect_fingerprint(
    request: Request,
    canvas: Dict[str, Any] = Body(default_factory=dict),
    webgl: Dict[str, Any] = Body(default_factory=dict),
    session_id: str = Body(...)
) -> Dict[str, Any]:
    """
    Collect and analyze browser fingerprint.
    """
    try:
        analysis = _fingerprint_service.analyze_fingerprints(
            canvas, webgl, session_id
        )

        return {
            'success': True,
            'data': {
                'analysis_id': analysis.id,
                'device_class': analysis.device_class.value,
                'risk_level': analysis.risk_level.value,
                'is_headless': analysis.is_headless,
                'is_bot': analysis.is_bot,
                'confidence': analysis.confidence_score
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/analysis/{analysis_id}")
async def get_analysis(analysis_id: str) -> Dict[str, Any]:
    """
    Get fingerprint analysis by ID.
    """
    try:
        analysis = _fingerprint_service.get_analysis(analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        return {
            'success': True,
            'data': analysis.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}")
async def get_session_fingerprints(session_id: str) -> Dict[str, Any]:
    """
    Get all fingerprints for a session.
    """
    try:
        fingerprints = _fingerprint_service.get_session_fingerprints(session_id)
        return {
            'success': True,
            'data': [f.to_dict() for f in fingerprints],
            'count': len(fingerprints)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/risk")
async def get_session_risk(session_id: str) -> Dict[str, Any]:
    """
    Get risk assessment for a session.
    """
    try:
        assessment = _fingerprint_service.get_risk_assessment(session_id)
        return {
            'success': True,
            'data': assessment
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/block/{fingerprint_id}")
async def block_fingerprint(fingerprint_id: str) -> Dict[str, Any]:
    """
    Block a fingerprint.
    """
    try:
        result = _fingerprint_service.block_fingerprint(fingerprint_id)
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
async def get_fingerprint_statistics() -> Dict[str, Any]:
    """
    Get fingerprint statistics.
    """
    try:
        stats = _fingerprint_service.get_statistics()
        return {
            'success': True,
            'data': stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))