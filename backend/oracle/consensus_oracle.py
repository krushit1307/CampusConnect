"""
Consensus Oracle for Escrow Slashing
Multi-modal consensus engine for temperature, time, and vision validation.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid

from backend.models.escrow_models import (
    OracleConsensus, OracleStatus, EscrowContract,
    TemperatureReading, VisionAnalysis, TimeVerification,
    EscrowStatus
)
from backend.oracle.temperature_oracle import TemperatureOracle
from backend.oracle.vision_oracle import VisionOracle
from backend.oracle.time_oracle import TimeOracle

logger = logging.getLogger(__name__)


class ConsensusOracle:
    """
    Multi-modal consensus engine for escrow validation.
    Requires ALL three oracles to approve before funds release.
    """

    def __init__(self):
        self.temperature_oracle = TemperatureOracle()
        self.vision_oracle = VisionOracle()
        self.time_oracle = TimeOracle()
        self._consensus_results: Dict[str, OracleConsensus] = {}

    def evaluate_escrow(
        self,
        contract: EscrowContract,
        temperature_reading: TemperatureReading,
        vision_analysis: VisionAnalysis,
        time_verification: TimeVerification
    ) -> OracleConsensus:
        """
        Evaluate all three oracles for an escrow contract.
        
        Args:
            contract: Escrow contract
            temperature_reading: Temperature reading
            vision_analysis: Vision analysis
            time_verification: Time verification
        
        Returns:
            OracleConsensus result
        """
        # Get individual oracle statuses
        temp_status = self.temperature_oracle.get_temperature_status(
            temperature_reading, contract
        )
        vision_status = self.vision_oracle.get_vision_status(
            vision_analysis, contract
        )
        time_status = self.time_oracle.get_time_status(
            time_verification, contract
        )

        # Create consensus
        consensus = OracleConsensus(
            temperature_status=temp_status,
            vision_status=vision_status,
            time_status=time_status
        )

        # Determine if consensus is reached
        all_approved = (
            temp_status == OracleStatus.APPROVED and
            vision_status == OracleStatus.APPROVED and
            time_status == OracleStatus.APPROVED
        )

        consensus.all_approved = all_approved
        consensus.consensus_reached = all_approved

        # Check for rejection reasons
        rejection_reasons = []
        if temp_status != OracleStatus.APPROVED:
            rejection_reasons.append(f"Temperature: {temp_status.value}")
        if vision_status != OracleStatus.APPROVED:
            rejection_reasons.append(f"Vision: {vision_status.value}")
        if time_status != OracleStatus.APPROVED:
            rejection_reasons.append(f"Time: {time_status.value}")

        if rejection_reasons:
            consensus.rejection_reason = "; ".join(rejection_reasons)

        # Check if manual review is needed
        consensus.requires_manual_review = (
            temp_status == OracleStatus.TIMEOUT or
            vision_status == OracleStatus.TIMEOUT or
            time_status == OracleStatus.TIMEOUT
        )

        # Store consensus
        self._consensus_results[consensus.id] = consensus

        logger.info(f"Consensus evaluated: {'APPROVED' if all_approved else 'REJECTED'} - {consensus.rejection_reason}")
        return consensus

    def get_consensus(self, consensus_id: str) -> Optional[OracleConsensus]:
        """Get a consensus result by ID."""
        return self._consensus_results.get(consensus_id)

    def get_consensus_summary(self, consensus: OracleConsensus) -> Dict[str, Any]:
        """
        Get a summary of the consensus result.
        
        Args:
            consensus: OracleConsensus object
        
        Returns:
            Summary dictionary
        """
        return {
            'consensus_reached': consensus.consensus_reached,
            'all_approved': consensus.all_approved,
            'temperature_approved': consensus.temperature_status == OracleStatus.APPROVED,
            'vision_approved': consensus.vision_status == OracleStatus.APPROVED,
            'time_approved': consensus.time_status == OracleStatus.APPROVED,
            'rejection_reason': consensus.rejection_reason,
            'requires_manual_review': consensus.requires_manual_review,
            'timestamp': consensus.consensus_timestamp.isoformat()
        }

    def get_oracle_status_emoji(self, status: OracleStatus) -> str:
        """
        Get emoji for oracle status.
        
        Args:
            status: Oracle status
        
        Returns:
            Emoji string
        """
        if status == OracleStatus.APPROVED:
            return '✅'
        elif status == OracleStatus.REJECTED:
            return '❌'
        elif status == OracleStatus.TIMEOUT:
            return '⏰'
        else:
            return '⏳'

    def get_oracle_status_color(self, status: OracleStatus) -> str:
        """
        Get color for oracle status.
        
        Args:
            status: Oracle status
        
        Returns:
            Color hex
        """
        if status == OracleStatus.APPROVED:
            return '#22c55e'
        elif status == OracleStatus.REJECTED:
            return '#ef4444'
        elif status == OracleStatus.TIMEOUT:
            return '#f59e0b'
        else:
            return '#94a3b8'

    def generate_consensus_report(
        self,
        consensus: OracleConsensus,
        contract: EscrowContract
    ) -> Dict[str, Any]:
        """
        Generate a detailed consensus report.
        
        Args:
            consensus: OracleConsensus object
            contract: Escrow contract
        
        Returns:
            Report dictionary
        """
        return {
            'consensus_id': consensus.id,
            'contract_id': contract.id,
            'vendor_id': contract.vendor_id,
            'client_id': contract.client_id,
            'amount': contract.amount,
            'currency': contract.currency,
            'oracle_status': {
                'temperature': consensus.temperature_status.value,
                'vision': consensus.vision_status.value,
                'time': consensus.time_status.value
            },
            'all_approved': consensus.all_approved,
            'consensus_reached': consensus.consensus_reached,
            'rejection_reason': consensus.rejection_reason,
            'requires_manual_review': consensus.requires_manual_review,
            'timestamp': consensus.consensus_timestamp.isoformat(),
            'recommendation': self._get_recommendation(consensus)
        }

    def _get_recommendation(self, consensus: OracleConsensus) -> str:
        """
        Get recommendation based on consensus.
        
        Args:
            consensus: OracleConsensus object
        
        Returns:
            Recommendation string
        """
        if consensus.all_approved:
            return "✅ Release funds - All oracles approved"
        elif consensus.temperature_status == OracleStatus.REJECTED:
            return "❌ Slash funds - Temperature too low"
        elif consensus.vision_status == OracleStatus.REJECTED:
            return "❌ Slash funds - Food integrity compromised"
        elif consensus.time_status == OracleStatus.REJECTED:
            return "❌ Slash funds - Delivery delayed"
        elif consensus.requires_manual_review:
            return "🔄 Manual review required - Oracle timeout"
        else:
            return "⚠️ Investigation required - Mixed oracle results"

    def get_consensus_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about consensus results.
        
        Returns:
            Statistics dictionary
        """
        results = list(self._consensus_results.values())
        
        if not results:
            return {
                'total': 0,
                'approved': 0,
                'rejected': 0,
                'manual_review': 0
            }

        approved = sum(1 for c in results if c.all_approved)
        rejected = sum(1 for c in results if not c.all_approved and not c.requires_manual_review)
        manual = sum(1 for c in results if c.requires_manual_review)

        return {
            'total': len(results),
            'approved': approved,
            'rejected': rejected,
            'manual_review': manual,
            'approval_rate': (approved / len(results)) * 100 if results else 0,
            'rejection_rate': (rejected / len(results)) * 100 if results else 0
        }

    def simulate_consensus_scenario(
        self,
        temp_approved: bool,
        vision_approved: bool,
        time_approved: bool
    ) -> Dict[str, Any]:
        """
        Simulate a consensus scenario for testing.
        
        Args:
            temp_approved: Temperature approval
            vision_approved: Vision approval
            time_approved: Time approval
        
        Returns:
            Simulation result
        """
        temp_status = OracleStatus.APPROVED if temp_approved else OracleStatus.REJECTED
        vision_status = OracleStatus.APPROVED if vision_approved else OracleStatus.REJECTED
        time_status = OracleStatus.APPROVED if time_approved else OracleStatus.REJECTED

        consensus = OracleConsensus(
            temperature_status=temp_status,
            vision_status=vision_status,
            time_status=time_status
        )

        all_approved = temp_approved and vision_approved and time_approved
        consensus.all_approved = all_approved
        consensus.consensus_reached = all_approved

        return {
            'temperature': temp_status.value,
            'vision': vision_status.value,
            'time': time_status.value,
            'all_approved': all_approved,
            'consensus_reached': all_approved,
            'result': 'APPROVED' if all_approved else 'REJECTED',
            'recommendation': self._get_recommendation(consensus)
        }