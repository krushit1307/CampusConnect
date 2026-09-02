"""
FHE Configuration for EcoBuddy AI
Configuration for Fully Homomorphic Encryption (FHE).
"""

from dataclasses import dataclass
from typing import Optional


@dataclass
class FHEConfig:
    """Configuration for FHE engine."""
    
    # FHE scheme
    scheme: str = "tfhe"  # tfhe, seal, ckks, bgv
    
    # Security parameters
    security_level: int = 128  # bits
    polynomial_degree: int = 2048
    coefficient_modulus: int = 2**40
    
    # Key management
    key_directory: str = "keys/"
    key_rotation_days: int = 30
    
    # Encryption settings
    plaintext_modulus: int = 2**32
    ciphertext_modulus: int = 2**40
    
    # Performance
    batch_size: int = 100
    cache_encrypted: bool = True
    cache_ttl_seconds: int = 3600
    
    # Privacy
    enable_noise: bool = True
    noise_std: float = 0.01
    
    @classmethod
    def default(cls) -> 'FHEConfig':
        """Get default FHE configuration."""
        return cls()
    
    @classmethod
    def high_security(cls) -> 'FHEConfig':
        """Get high security configuration."""
        return cls(
            security_level=256,
            polynomial_degree=4096,
            coefficient_modulus=2**60,
            key_rotation_days=14
        )
    
    @classmethod
    def low_latency(cls) -> 'FHEConfig':
        """Get low latency configuration."""
        return cls(
            security_level=128,
            polynomial_degree=1024,
            coefficient_modulus=2**30,
            batch_size=10
        )