"""
Temperature Oracle for Escrow Slashing
IoT temperature validation for food delivery escrow contracts.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from backend.models.escrow_models import (
    TemperatureReading, OracleStatus, EscrowContract
)

logger = logging.getLogger(__name__)


class TemperatureOracle:
    """
    Oracle for validating temperature readings.
    Ensures food temperature meets safety standards.
    """

    TEMPERATURE_THRESHOLD = 140.0  # Fahrenheit
    TEMPERATURE_TOLERANCE = 5.0  # Degrees tolerance

    def __init__(self):
        self._readings: Dict[str, TemperatureReading] = {}

    def validate_temperature(
        self,
        reading: TemperatureReading,
        threshold: float = None
    ) -> Dict[str, Any]:
        """
        Validate a temperature reading.
        
        Args:
            reading: TemperatureReading object
            threshold: Custom temperature threshold
        
        Returns:
            Validation result
        """
        if threshold is None:
            threshold = self.TEMPERATURE_THRESHOLD

        # Check if reading is valid
        if not reading.is_valid:
            return {
                'valid': False,
                'status': OracleStatus.REJECTED.value,
                'message': 'Invalid temperature reading',
                'reading': reading.value,
                'threshold': threshold
            }

        # Check temperature against threshold
        is_hot_enough = reading.value >= threshold - self.TEMPERATURE_TOLERANCE

        return {
            'valid': is_hot_enough,
            'status': OracleStatus.APPROVED.value if is_hot_enough else OracleStatus.REJECTED.value,
            'message': f'Temperature {reading.value}°F is {"hot enough" if is_hot_enough else "too cold"}',
            'reading': reading.value,
            'threshold': threshold,
            'tolerance': self.TEMPERATURE_TOLERANCE
        }

    def get_temperature_status(
        self,
        reading: TemperatureReading,
        contract: EscrowContract
    ) -> OracleStatus:
        """
        Get temperature oracle status for a contract.
        
        Args:
            reading: Temperature reading
            contract: Escrow contract
        
        Returns:
            Oracle status
        """
        result = self.validate_temperature(reading, contract.temperature_threshold)
        return OracleStatus(result['status'])

    def validate_temperature_log(
        self,
        readings: list,
        contract: EscrowContract
    ) -> Dict[str, Any]:
        """
        Validate a series of temperature readings.
        
        Args:
            readings: List of temperature readings
            contract: Escrow contract
        
        Returns:
            Validation result
        """
        if not readings:
            return {
                'valid': False,
                'status': OracleStatus.REJECTED.value,
                'message': 'No temperature readings provided'
            }

        # Check all readings
        results = []
        all_valid = True
        
        for reading in readings:
            result = self.validate_temperature(reading, contract.temperature_threshold)
            results.append(result)
            if not result['valid']:
                all_valid = False

        # Check if readings are within time window
        time_window = 10  # minutes
        timestamps = [r.timestamp for r in readings]
        if len(timestamps) > 1:
            time_diff = max(timestamps) - min(timestamps)
            if time_diff > timedelta(minutes=time_window):
                return {
                    'valid': False,
                    'status': OracleStatus.REJECTED.value,
                    'message': f'Temperature readings span more than {time_window} minutes',
                    'readings_count': len(readings)
                }

        return {
            'valid': all_valid,
            'status': OracleStatus.APPROVED.value if all_valid else OracleStatus.REJECTED.value,
            'message': f'{len(readings)} temperature readings {"all valid" if all_valid else "some invalid"}',
            'readings_count': len(readings),
            'details': results
        }

    def create_temperature_reading(
        self,
        value: float,
        sensor_id: str = None,
        metadata: Dict[str, Any] = None
    ) -> TemperatureReading:
        """
        Create a temperature reading.
        
        Args:
            value: Temperature value
            sensor_id: Sensor ID
            metadata: Additional metadata
        
        Returns:
            TemperatureReading object
        """
        reading = TemperatureReading(
            value=value,
            sensor_id=sensor_id or f"sensor_{datetime.now().timestamp()}",
            is_valid=True,
            metadata=metadata or {}
        )
        self._readings[reading.id] = reading
        logger.info(f"Created temperature reading: {value}°F from sensor {reading.sensor_id}")
        return reading

    def get_reading(self, reading_id: str) -> Optional[TemperatureReading]:
        """Get a temperature reading by ID."""
        return self._readings.get(reading_id)

    def get_recent_readings(self, minutes: int = 10) -> list:
        """
        Get recent temperature readings.
        
        Args:
            minutes: Time window in minutes
        
        Returns:
            List of readings
        """
        cutoff = datetime.now() - timedelta(minutes=minutes)
        return [
            r for r in self._readings.values()
            if r.timestamp >= cutoff
        ]

    def is_temperature_stable(self, readings: list, tolerance: float = 5.0) -> bool:
        """
        Check if temperature readings are stable.
        
        Args:
            readings: List of readings
            tolerance: Temperature tolerance
        
        Returns:
            True if stable
        """
        if len(readings) < 2:
            return True
        
        values = [r.value for r in readings]
        avg = sum(values) / len(values)
        return all(abs(v - avg) <= tolerance for v in values)