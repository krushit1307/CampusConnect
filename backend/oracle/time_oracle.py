"""
Time Oracle for Escrow Slashing
Time validation for delivery punctuality.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from backend.models.escrow_models import (
    TimeVerification, OracleStatus, EscrowContract
)

logger = logging.getLogger(__name__)


class TimeOracle:
    """
    Oracle for validating delivery time.
    Ensures delivery is on time before escrow release.
    """

    MAX_DELAY_MINUTES = 15  # Default max delay

    def __init__(self):
        self._verifications: Dict[str, TimeVerification] = {}

    def validate_time(
        self,
        expected_time: datetime,
        actual_time: datetime,
        max_delay_minutes: int = None
    ) -> Dict[str, Any]:
        """
        Validate delivery time.
        
        Args:
            expected_time: Expected delivery time
            actual_time: Actual delivery time
            max_delay_minutes: Maximum allowed delay
        
        Returns:
            Validation result
        """
        if max_delay_minutes is None:
            max_delay_minutes = self.MAX_DELAY_MINUTES

        # Calculate delay
        delay = (actual_time - expected_time).total_seconds() / 60
        is_on_time = delay <= max_delay_minutes

        return {
            'valid': is_on_time,
            'status': OracleStatus.APPROVED.value if is_on_time else OracleStatus.REJECTED.value,
            'message': f'Delivery {"on time" if is_on_time else "delayed"} by {abs(delay):.0f} minutes',
            'expected_time': expected_time.isoformat(),
            'actual_time': actual_time.isoformat(),
            'delay_minutes': round(delay, 1),
            'max_delay_minutes': max_delay_minutes,
            'is_on_time': is_on_time
        }

    def get_time_status(
        self,
        verification: TimeVerification,
        contract: EscrowContract
    ) -> OracleStatus:
        """
        Get time oracle status for a contract.
        
        Args:
            verification: Time verification
            contract: Escrow contract
        
        Returns:
            Oracle status
        """
        result = self.validate_time(
            verification.expected_delivery_time,
            verification.actual_delivery_time,
            contract.max_delay_minutes
        )
        return OracleStatus(result['status'])

    def create_time_verification(
        self,
        expected_time: datetime,
        actual_time: datetime = None,
        metadata: Dict[str, Any] = None
    ) -> TimeVerification:
        """
        Create a time verification.
        
        Args:
            expected_time: Expected delivery time
            actual_time: Actual delivery time (default: now)
            metadata: Additional metadata
        
        Returns:
            TimeVerification object
        """
        if actual_time is None:
            actual_time = datetime.now()

        verification = TimeVerification(
            expected_delivery_time=expected_time,
            actual_delivery_time=actual_time,
            metadata=metadata or {}
        )
        
        # Calculate delay
        delay = (actual_time - expected_time).total_seconds() / 60
        verification.delay_minutes = round(delay, 1)
        verification.is_on_time = delay <= self.MAX_DELAY_MINUTES
        verification.is_valid = True
        
        self._verifications[verification.id] = verification
        logger.info(f"Time verification created: {'on time' if verification.is_on_time else 'delayed'} by {abs(verification.delay_minutes)} minutes")
        return verification

    def get_verification(self, verification_id: str) -> Optional[TimeVerification]:
        """Get a time verification by ID."""
        return self._verifications.get(verification_id)

    def is_within_window(
        self,
        actual_time: datetime,
        expected_time: datetime,
        window_minutes: int = 5
    ) -> bool:
        """
        Check if actual time is within window.
        
        Args:
            actual_time: Actual delivery time
            expected_time: Expected delivery time
            window_minutes: Time window in minutes
        
        Returns:
            True if within window
        """
        diff = abs((actual_time - expected_time).total_seconds() / 60)
        return diff <= window_minutes

    def calculate_delay_penalty(
        self,
        delay_minutes: int,
        max_delay: int = 15,
        penalty_per_minute: float = 5.0
    ) -> float:
        """
        Calculate delay penalty amount.
        
        Args:
            delay_minutes: Delay in minutes
            max_delay: Maximum allowed delay
            penalty_per_minute: Penalty per minute
        
        Returns:
            Penalty amount
        """
        if delay_minutes <= max_delay:
            return 0.0
        
        excess_minutes = delay_minutes - max_delay
        return excess_minutes * penalty_per_minute

    def generate_time_report(
        self,
        verification: TimeVerification
    ) -> Dict[str, Any]:
        """
        Generate a report for time verification.
        
        Args:
            verification: Time verification
        
        Returns:
            Report dictionary
        """
        return {
            'verification_id': verification.id,
            'expected_time': verification.expected_delivery_time.isoformat(),
            'actual_time': verification.actual_delivery_time.isoformat(),
            'delay_minutes': verification.delay_minutes,
            'is_on_time': verification.is_on_time,
            'is_valid': verification.is_valid,
            'timestamp': datetime.now().isoformat(),
            'metadata': verification.metadata
        }