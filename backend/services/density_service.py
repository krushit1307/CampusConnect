"""
Density Service for EcoBuddy AI
Manages density readings, aggregation, and FHE operations.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json

from backend.models.density_models import (
    DensityReading, EncryptedDensityReading, AggregatedDensity,
    DensityLevel, DensityQuery, DensityAlert, PrivacyLevel
)
from backend.fhe.fhe_engine import FHEEngine
from backend.fhe.key_manager import FHEKeyManager

logger = logging.getLogger(__name__)


class DensityService:
    """
    Service for managing density readings with FHE encryption.
    """

    def __init__(self):
        self.fhe_engine = FHEEngine()
        self.key_manager = FHEKeyManager()
        self._readings: Dict[str, DensityReading] = {}
        self._encrypted_readings: Dict[str, EncryptedDensityReading] = {}
        self._alerts: List[DensityAlert] = []

    def process_reading(
        self,
        device_id: str,
        density_score: float,
        location: str,
        building: str,
        floor: int = 0,
        room: str = "",
        encrypt: bool = True,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Process a density reading from an IoT device.
        
        Args:
            device_id: Device ID
            density_score: Density score (0-100)
            location: Location name
            building: Building name
            floor: Floor number
            room: Room name
            encrypt: Whether to encrypt the reading
            metadata: Additional metadata
        
        Returns:
            Processed reading result
        """
        # Determine density level
        level = self._get_density_level(density_score)

        # Create reading
        reading = DensityReading(
            device_id=device_id,
            location=location,
            building=building,
            floor=floor,
            room=room,
            density_score=density_score,
            density_level=level,
            timestamp=datetime.now(),
            metadata=metadata or {}
        )

        # Encrypt if requested
        if encrypt:
            encrypted = self.fhe_engine.encrypt(int(density_score))
            reading.is_encrypted = True
            reading.ciphertext = encrypted['ciphertext']
            reading.encrypted_value = encrypted['ciphertext'].hex()
            reading.privacy_level = PrivacyLevel.ENCRYPTED

        self._readings[reading.id] = reading

        # Check for alerts
        self._check_alert(reading)

        logger.info(f"Processed reading from {device_id}: {density_score} ({level.value})")
        return reading.to_dict()

    def _get_density_level(self, score: float) -> DensityLevel:
        """Get density level from score."""
        if score < 10:
            return DensityLevel.EMPTY
        elif score < 30:
            return DensityLevel.LOW
        elif score < 60:
            return DensityLevel.MEDIUM
        elif score < 85:
            return DensityLevel.HIGH
        else:
            return DensityLevel.CRITICAL

    def _check_alert(self, reading: DensityReading) -> None:
        """Check if reading triggers an alert."""
        if reading.density_score >= 80:
            severity = "critical" if reading.density_score >= 90 else "warning"
            alert = DensityAlert(
                location=reading.location,
                building=reading.building,
                floor=reading.floor,
                room=reading.room,
                density_score=reading.density_score,
                threshold=80.0,
                severity=severity,
                timestamp=datetime.now()
            )
            self._alerts.append(alert)
            logger.warning(f"🚨 Density alert: {alert.location} - {alert.density_score}%")

    def get_building_density(
        self,
        building: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get density data for a building.
        
        Args:
            building: Building name
            start_time: Start time
            end_time: End time
        
        Returns:
            Density data
        """
        readings = self._get_readings(building, start_time, end_time)
        
        if not readings:
            return {
                'building': building,
                'total_density': 0,
                'average_density': 0,
                'readings_count': 0,
                'floor_data': {}
            }

        # Aggregated data
        total = sum(r.density_score for r in readings)
        avg = total / len(readings) if readings else 0

        # Floor breakdown
        floors = {}
        for r in readings:
            if r.floor not in floors:
                floors[r.floor] = []
            floors[r.floor].append(r.density_score)

        floor_data = {}
        for floor, scores in floors.items():
            floor_data[floor] = {
                'average': sum(scores) / len(scores) if scores else 0,
                'max': max(scores) if scores else 0,
                'min': min(scores) if scores else 0,
                'count': len(scores)
            }

        return {
            'building': building,
            'total_density': total,
            'average_density': avg,
            'readings_count': len(readings),
            'floor_data': floor_data,
            'timestamp': datetime.now().isoformat()
        }

    def get_encrypted_building_density(
        self,
        building: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get encrypted density data for a building.
        
        Args:
            building: Building name
            start_time: Start time
            end_time: End time
        
        Returns:
            Encrypted density data
        """
        readings = self._get_readings(building, start_time, end_time)
        
        if not readings:
            return {
                'building': building,
                'encrypted': True,
                'readings_count': 0,
                'ciphertexts': []
            }

        # Encrypt all readings
        ciphertexts = []
        for r in readings:
            if r.is_encrypted:
                ciphertexts.append(r.ciphertext)
            else:
                encrypted = self.fhe_engine.encrypt(int(r.density_score))
                ciphertexts.append(encrypted['ciphertext'])

        # Homomorphic operations
        total_ciphertext = self.fhe_engine.add(ciphertexts)
        avg_ciphertext = self.fhe_engine.average(ciphertexts)

        return {
            'building': building,
            'encrypted': True,
            'readings_count': len(readings),
            'total_ciphertext': total_ciphertext.hex(),
            'avg_ciphertext': avg_ciphertext.hex(),
            'timestamp': datetime.now().isoformat()
        }

    def _get_readings(
        self,
        building: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[DensityReading]:
        """Get readings filtered by building and time."""
        readings = [r for r in self._readings.values() if r.building == building]
        
        if start_time:
            readings = [r for r in readings if r.timestamp >= start_time]
        if end_time:
            readings = [r for r in readings if r.timestamp <= end_time]
        
        return readings

    def get_alerts(self, acknowledged: bool = False) -> List[Dict[str, Any]]:
        """Get density alerts."""
        alerts = [a for a in self._alerts if a.acknowledged == acknowledged]
        return [a.to_dict() for a in alerts]

    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge a density alert."""
        for alert in self._alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                return True
        return False

    def get_statistics(self) -> Dict[str, Any]:
        """Get density service statistics."""
        total = len(self._readings)
        encrypted = sum(1 for r in self._readings.values() if r.is_encrypted)
        
        alerts = len(self._alerts)
        unacknowledged = sum(1 for a in self._alerts if not a.acknowledged)

        return {
            'total_readings': total,
            'encrypted_readings': encrypted,
            'encryption_rate': (encrypted / total * 100) if total > 0 else 0,
            'total_alerts': alerts,
            'unacknowledged_alerts': unacknowledged,
            'buildings': list(set(r.building for r in self._readings.values()))
        }

    def decrypt_aggregated_data(self, ciphertext: bytes) -> int:
        """
        Decrypt aggregated data (admin only).
        
        Args:
            ciphertext: Encrypted aggregated data
        
        Returns:
            Decrypted value
        """
        return self.fhe_engine.decrypt(ciphertext)