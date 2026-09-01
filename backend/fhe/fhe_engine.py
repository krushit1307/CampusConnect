"""
FHE Engine for EcoBuddy AI
Core Fully Homomorphic Encryption operations for secure density aggregation.
"""

import base64
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import hashlib
import struct

from .fhe_config import FHEConfig
from .key_manager import FHEKeyManager

logger = logging.getLogger(__name__)


class FHEEngine:
    """
    Fully Homomorphic Encryption engine for secure data processing.
    Allows mathematical operations on encrypted data without decryption.
    """

    def __init__(self, config: Optional[FHEConfig] = None):
        self.config = config or FHEConfig.default()
        self.key_manager = FHEKeyManager(config)
        self._operation_cache: Dict[str, bytes] = {}
        self._ensure_active_key()

    def _ensure_active_key(self) -> None:
        """Ensure an active key exists."""
        active_key = self.key_manager.get_active_key()
        if not active_key:
            active_key = self.key_manager.generate_key_pair(
                f"fhe_key_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            )
            logger.info(f"Created initial FHE key: {active_key}")

    def encrypt(self, value: int, key_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Encrypt an integer value using FHE.
        
        Args:
            value: Integer to encrypt
            key_id: Optional key ID (uses active key if not provided)
        
        Returns:
            Encrypted result with metadata
        """
        if key_id is None:
            key_id = self.key_manager.get_active_key()
        
        if not key_id:
            raise ValueError("No active FHE key available")

        public_key = self.key_manager.get_public_key(key_id)
        if not public_key:
            raise ValueError(f"Public key not found for {key_id}")

        # Mock FHE encryption
        # In production, use a real FHE library like TenSEAL
        import random
        
        # Generate ciphertext (mock)
        noise = random.randint(1, 1000)
        ciphertext = self._mock_encrypt(value, public_key, noise)
        
        return {
            'ciphertext': ciphertext,
            'key_id': key_id,
            'timestamp': datetime.now().isoformat(),
            'algorithm': 'mock_fhe_v1',
            'metadata': {
                'security_level': self.config.security_level,
                'noise_added': noise
            }
        }

    def decrypt(self, ciphertext: bytes, key_id: Optional[str] = None) -> int:
        """
        Decrypt a ciphertext using FHE.
        
        Args:
            ciphertext: Encrypted data
            key_id: Optional key ID (uses active key if not provided)
        
        Returns:
            Decrypted integer value
        """
        if key_id is None:
            key_id = self.key_manager.get_active_key()
        
        if not key_id:
            raise ValueError("No active FHE key available")

        private_key = self.key_manager.get_private_key(key_id)
        if not private_key:
            raise ValueError(f"Private key not found for {key_id}")

        # Mock FHE decryption
        value = self._mock_decrypt(ciphertext, private_key)
        return value

    def add(self, ciphertexts: List[bytes], key_id: Optional[str] = None) -> bytes:
        """
        Add multiple ciphertexts homomorphically.
        
        Args:
            ciphertexts: List of encrypted values
            key_id: Optional key ID
        
        Returns:
            Encrypted sum
        """
        if not ciphertexts:
            raise ValueError("No ciphertexts to add")

        if key_id is None:
            key_id = self.key_manager.get_active_key()

        # Homomorphic addition
        # In production, use library's add operation
        result = self._mock_homomorphic_add(ciphertexts, key_id)
        
        # Cache result
        cache_key = hashlib.md5(b''.join(ciphertexts)).hexdigest()
        self._operation_cache[cache_key] = result
        
        return result

    def multiply(self, ciphertext: bytes, scalar: int, key_id: Optional[str] = None) -> bytes:
        """
        Multiply a ciphertext by a scalar homomorphically.
        
        Args:
            ciphertext: Encrypted value
            scalar: Integer multiplier
            key_id: Optional key ID
        
        Returns:
            Encrypted product
        """
        if key_id is None:
            key_id = self.key_manager.get_active_key()

        # Homomorphic multiplication
        result = self._mock_homomorphic_multiply(ciphertext, scalar, key_id)
        return result

    def average(self, ciphertexts: List[bytes], key_id: Optional[str] = None) -> bytes:
        """
        Calculate average of multiple ciphertexts homomorphically.
        
        Args:
            ciphertexts: List of encrypted values
            key_id: Optional key ID
        
        Returns:
            Encrypted average
        """
        if not ciphertexts:
            raise ValueError("No ciphertexts to average")

        if key_id is None:
            key_id = self.key_manager.get_active_key()

        # Calculate sum
        total = self.add(ciphertexts, key_id)
        
        # Divide by count (homomorphic division)
        count = len(ciphertexts)
        result = self._mock_homomorphic_divide(total, count, key_id)
        
        return result

    def batch_encrypt(self, values: List[int], key_id: Optional[str] = None) -> List[bytes]:
        """
        Encrypt multiple values in batch.
        
        Args:
            values: List of integers to encrypt
            key_id: Optional key ID
        
        Returns:
            List of ciphertexts
        """
        results = []
        for value in values:
            result = self.encrypt(value, key_id)
            results.append(result['ciphertext'])
        return results

    def batch_decrypt(self, ciphertexts: List[bytes], key_id: Optional[str] = None) -> List[int]:
        """
        Decrypt multiple ciphertexts in batch.
        
        Args:
            ciphertexts: List of encrypted values
            key_id: Optional key ID
        
        Returns:
            List of decrypted integers
        """
        results = []
        for ciphertext in ciphertexts:
            value = self.decrypt(ciphertext, key_id)
            results.append(value)
        return results

    def aggregate_by_building(self, readings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregate density readings by building using FHE.
        
        Args:
            readings: List of density readings (encrypted or raw)
        
        Returns:
            Aggregated results
        """
        buildings = {}
        
        for reading in readings:
            building = reading.get('building', 'unknown')
            if building not in buildings:
                buildings[building] = []
            
            if reading.get('is_encrypted', False):
                buildings[building].append(reading['ciphertext'])
            else:
                # Encrypt raw values
                value = reading.get('density_score', 0)
                encrypted = self.encrypt(int(value))
                buildings[building].append(encrypted['ciphertext'])

        results = {}
        for building, ciphertexts in buildings.items():
            if ciphertexts:
                total_ciphertext = self.add(ciphertexts)
                avg_ciphertext = self.average(ciphertexts)
                
                results[building] = {
                    'total_ciphertext': total_ciphertext,
                    'avg_ciphertext': avg_ciphertext,
                    'count': len(ciphertexts),
                    'is_encrypted': True
                }

        return results

    def get_aggregated_summary(self, agg_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get a summary of aggregated results (for decryption by admin).
        
        Args:
            agg_results: Results from aggregation
        
        Returns:
            Summary with encrypted values
        """
        summary = {
            'timestamp': datetime.now().isoformat(),
            'building_summary': {},
            'total_buildings': len(agg_results),
            'total_readings': sum(r['count'] for r in agg_results.values()),
            'encrypted': True
        }

        for building, data in agg_results.items():
            summary['building_summary'][building] = {
                'total_ciphertext': base64.b64encode(data['total_ciphertext']).decode('utf-8'),
                'avg_ciphertext': base64.b64encode(data['avg_ciphertext']).decode('utf-8'),
                'count': data['count']
            }

        return summary

    def _mock_encrypt(self, value: int, public_key: str, noise: int) -> bytes:
        """Mock FHE encryption."""
        import random
        
        # Simple mock encryption: value + noise + key hash
        key_hash = int(public_key[:8], 16) if public_key else 0
        encrypted = value + noise + (key_hash % 1000)
        
        # Convert to bytes
        encrypted_bytes = struct.pack('>I', encrypted)
        return encrypted_bytes

    def _mock_decrypt(self, ciphertext: bytes, private_key: str) -> int:
        """Mock FHE decryption."""
        encrypted = struct.unpack('>I', ciphertext)[0]
        key_hash = int(private_key[:8], 16) if private_key else 0
        
        # Extract value
        value = encrypted - (key_hash % 1000)
        return max(0, value)

    def _mock_homomorphic_add(self, ciphertexts: List[bytes], key_id: str) -> bytes:
        """Mock homomorphic addition."""
        # Decrypt all, add, re-encrypt
        values = []
        for ct in ciphertexts:
            val = self.decrypt(ct, key_id)
            values.append(val)
        
        total = sum(values)
        result = self.encrypt(total, key_id)
        return result['ciphertext']

    def _mock_homomorphic_multiply(self, ciphertext: bytes, scalar: int, key_id: str) -> bytes:
        """Mock homomorphic multiplication."""
        value = self.decrypt(ciphertext, key_id)
        product = value * scalar
        result = self.encrypt(product, key_id)
        return result['ciphertext']

    def _mock_homomorphic_divide(self, ciphertext: bytes, divisor: int, key_id: str) -> bytes:
        """Mock homomorphic division."""
        value = self.decrypt(ciphertext, key_id)
        avg = value // divisor if divisor > 0 else 0
        result = self.encrypt(avg, key_id)
        return result['ciphertext']

    def get_encryption_stats(self) -> Dict[str, Any]:
        """Get encryption statistics."""
        return {
            'active_key': self.key_manager.get_active_key(),
            'cache_size': len(self._operation_cache),
            'config': {
                'scheme': self.config.scheme,
                'security_level': self.config.security_level,
                'polynomial_degree': self.config.polynomial_degree
            }
        }

    def clear_cache(self) -> None:
        """Clear operation cache."""
        self._operation_cache.clear()
        logger.info("Cleared FHE operation cache")