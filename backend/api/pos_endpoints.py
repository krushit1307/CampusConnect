"""
Proof-of-Skill API Endpoints
REST API for skill verification and proof management.
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Optional, List, Dict, Any
from datetime import datetime

from backend.models.proof_of_skill import (
    PoSVerificationRequest, PoSVerificationResponse,
    SkillProof, SkillVerificationStatus, PoSChain
)
from backend.services.pos_service import PoSService

router = APIRouter(prefix="/api/pos", tags=["proof-of-skill"])

# Initialize service
_pos_service = PoSService()


@router.post("/verify")
async def verify_skill(
    request: PoSVerificationRequest
) -> PoSVerificationResponse:
    """
    Verify a skill using Proof-of-Skill.
    """
    try:
        return _pos_service.verify_code_skill(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify/{proof_id}")
async def verify_proof(proof_id: str) -> Dict[str, Any]:
    """
    Verify a skill proof.
    """
    try:
        result = _pos_service.verify_skill_proof(proof_id)
        if not result.get('valid'):
            raise HTTPException(status_code=404, detail="Proof not found or invalid")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/proofs/{proof_id}")
async def get_proof(proof_id: str) -> Dict[str, Any]:
    """
    Get skill proof details.
    """
    try:
        proof = _pos_service._proofs.get(proof_id)
        if not proof:
            raise HTTPException(status_code=404, detail="Proof not found")
        return proof.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/skills")
async def get_user_skills(user_id: str) -> Dict[str, Any]:
    """
    Get verified skills for a user.
    """
    try:
        skills = _pos_service.get_user_skills(user_id)
        badges = []
        for skill in skills:
            badge = _pos_service.get_skill_badge(user_id, skill['skill'])
            if badge:
                badges.append(badge)
        
        return {
            'success': True,
            'data': {
                'user_id': user_id,
                'verified_skills': skills,
                'badges': badges,
                'total': len(skills)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/badge/{skill_name}")
async def get_skill_badge(user_id: str, skill_name: str) -> Dict[str, Any]:
    """
    Get a skill badge for a user.
    """
    try:
        badge = _pos_service.get_skill_badge(user_id, skill_name)
        if not badge:
            raise HTTPException(status_code=404, detail="Skill badge not found")
        return {
            'success': True,
            'data': badge
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/revoke/{proof_id}")
async def revoke_skill_proof(
    proof_id: str,
    reason: Optional[str] = Body(None)
) -> Dict[str, Any]:
    """
    Revoke a skill proof.
    """
    try:
        result = _pos_service.revoke_skill_proof(proof_id, reason or "")
        if not result.get('success'):
            raise HTTPException(status_code=400, detail=result.get('message'))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_verification_stats() -> Dict[str, Any]:
    """
    Get verification statistics.
    """
    try:
        return {
            'success': True,
            'data': _pos_service.get_verification_stats()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/merkle-tree/{proof_id}")
async def get_merkle_tree(proof_id: str) -> Dict[str, Any]:
    """
    Get Merkle tree for a proof.
    """
    try:
        tree = _pos_service.get_merkle_tree(proof_id)
        if not tree:
            raise HTTPException(status_code=404, detail="Merkle tree not found")
        return {
            'success': True,
            'data': tree
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/report/{user_id}")
async def generate_verification_report(user_id: str) -> Dict[str, Any]:
    """
    Generate a verification report for a user.
    """
    try:
        report = _pos_service.generate_verification_report(user_id)
        return {
            'success': True,
            'data': report
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chains")
async def get_supported_chains() -> Dict[str, Any]:
    """
    Get supported blockchain chains.
    """
    return {
        'success': True,
        'data': {
            'chains': [{'id': c.value, 'name': c.value.title()} for c in PoSChain],
            'default': PoSChain.POLYGON.value
        }
    }


@router.post("/deploy-contract")
async def deploy_merkle_contract(
    chain: PoSChain = PoSChain.POLYGON,
    owner_address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deploy a Merkle root storage contract.
    """
    try:
        client = _pos_service.get_blockchain_client(chain)
        result = client.deploy_merkle_contract(owner_address)
        return {
            'success': result.get('success', False),
            'data': result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/contract-info")
async def get_contract_info(
    chain: PoSChain = PoSChain.POLYGON,
    contract_address: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get contract information.
    """
    try:
        client = _pos_service.get_blockchain_client(chain)
        if contract_address:
            client.contract_address = contract_address
            client._load_contract()
        
        return {
            'success': True,
            'data': {
                'chain': chain.value,
                'contract_address': client.contract_address,
                'connected': client.is_connected(),
                'chain_info': client.get_chain_info(),
                'root_count': client.get_merkle_root_count() if client.is_connected() else 0
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))