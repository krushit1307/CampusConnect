"""
Escrow API Endpoints
REST API for escrow contract management and oracle validation.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, Form
from typing import Optional, List, Dict, Any
from datetime import datetime

from backend.models.escrow_models import (
    EscrowContract, EscrowStatus, OracleConsensus,
    TemperatureReading, TimeVerification
)
from backend.services.escrow_service import EscrowService
from backend.oracle.consensus_oracle import ConsensusOracle

router = APIRouter(prefix="/api/escrow", tags=["escrow"])

# Initialize services
_escrow_service = EscrowService()
_consensus_oracle = ConsensusOracle()


@router.post("/contract")
async def create_escrow_contract(
    vendor_id: str = Form(...),
    client_id: str = Form(...),
    amount: float = Form(...),
    expected_delivery_time: datetime = Form(...),
    temperature_threshold: float = Form(140.0),
    integrity_threshold: float = Form(90.0),
    max_delay_minutes: int = Form(15),
    currency: str = Form("USDC")
) -> Dict[str, Any]:
    """
    Create a new escrow contract.
    """
    try:
        contract = _escrow_service.create_escrow_contract(
            vendor_id=vendor_id,
            client_id=client_id,
            amount=amount,
            expected_delivery_time=expected_delivery_time,
            temperature_threshold=temperature_threshold,
            integrity_threshold=integrity_threshold,
            max_delay_minutes=max_delay_minutes,
            currency=currency
        )
        return {
            'success': True,
            'data': contract.to_dict()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contract/{contract_id}/activate")
async def activate_contract(
    contract_id: str,
    contract_address: str = Form(...),
    tx_hash: str = Form(...),
    block_number: int = Form(...)
) -> Dict[str, Any]:
    """
    Activate an escrow contract on the blockchain.
    """
    try:
        contract = _escrow_service.activate_contract(
            contract_id, contract_address, tx_hash, block_number
        )
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        return {
            'success': True,
            'data': contract.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/contract/{contract_id}/evaluate")
async def evaluate_escrow(
    contract_id: str,
    temperature: float = Form(...),
    temperature_sensor_id: str = Form("sensor_001"),
    image: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Evaluate an escrow contract with temperature and vision data.
    """
    try:
        # Read image
        image_data = await image.read()
        
        # Evaluate
        result = _escrow_service.evaluate_contract(
            contract_id=contract_id,
            temperature=temperature,
            temperature_sensor_id=temperature_sensor_id,
            image_data=image_data,
            image_url=image.filename
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Contract not found")
        
        return {
            'success': True,
            'data': result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contract/{contract_id}")
async def get_escrow_contract(contract_id: str) -> Dict[str, Any]:
    """
    Get an escrow contract by ID.
    """
    try:
        contract = _escrow_service.get_contract(contract_id)
        if not contract:
            raise HTTPException(status_code=404, detail="Contract not found")
        return {
            'success': True,
            'data': contract.to_dict()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contracts/vendor/{vendor_id}")
async def get_vendor_contracts(vendor_id: str) -> Dict[str, Any]:
    """
    Get all contracts for a vendor.
    """
    try:
        contracts = _escrow_service.get_contracts_by_vendor(vendor_id)
        return {
            'success': True,
            'data': [c.to_dict() for c in contracts],
            'count': len(contracts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contracts/client/{client_id}")
async def get_client_contracts(client_id: str) -> Dict[str, Any]:
    """
    Get all contracts for a client.
    """
    try:
        contracts = _escrow_service.get_contracts_by_client(client_id)
        return {
            'success': True,
            'data': [c.to_dict() for c in contracts],
            'count': len(contracts)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/consensus/simulate")
async def simulate_consensus(
    temp_approved: bool = Form(...),
    vision_approved: bool = Form(...),
    time_approved: bool = Form(...)
) -> Dict[str, Any]:
    """
    Simulate a consensus scenario.
    """
    try:
        result = _consensus_oracle.simulate_consensus_scenario(
            temp_approved, vision_approved, time_approved
        )
        return {
            'success': True,
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_escrow_statistics() -> Dict[str, Any]:
    """
    Get escrow statistics.
    """
    try:
        stats = _escrow_service.get_statistics()
        consensus_stats = _consensus_oracle.get_consensus_statistics()
        return {
            'success': True,
            'data': {
                'escrow': stats,
                'consensus': consensus_stats
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))