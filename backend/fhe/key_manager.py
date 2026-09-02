"""
FHE Key Manager for EcoBuddy AI
Manages FHE public/private keys with rotation and secure storage.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import hashlib

from .fhe_config import FHEConfig

logger = logging.getLogger(__name__)


class FHEKeyManager:
    """
    Manages FHE keys with secure storage and rotation.
    """

    def __init__(self, config: Optional[FHEConfig] = None):
        self.config = config or FHEConfig.default()
        self._key_store: Dict[str, Any] = {}
        self._key_cache: Dict[str, Any] = {}
        self._load_keys()

    def _load_keys(self) -> None:
        """Load keys from storage."""
        try:
            os.makedirs(self.config.key_directory, exist_ok=True)
            
            key_file = os.path.join(self.config.key_directory, "keys.json")
            if os.path.exists(key_file):
                with open(key_file, 'r') as f:
                    self._key_store = json.load(f)
                    
            logger.info(f"Loaded {len(self._key_store)} keys from storage")
        except Exception as e:
            logger.error(f"Failed to load keys: {e}")
            self._key_store = {}

    def _save_keys(self) -> None:
        """Save keys to storage."""
        try:
            key_file = os.path.join(self.config.key_directory, "keys.json")
            with open(key_file, 'w') as f:
                json.dump(self._key_store, f, indent=2, default=str)
            logger.info(f"Saved {len(self._key_store)} keys to storage")
        except Exception as e:
            logger.error(f"Failed to save keys: {e}")

    def generate_key_pair(self, key_id: str) -> Dict[str, Any]:
        """
        Generate a new FHE key pair.
        
        Args:
            key_id: Unique key identifier
        
        Returns:
            Key pair dictionary
        """
        # In production, use a real FHE library like TenSEAL or PySEAL
        # For this implementation, we use a mock FHE scheme
        import random
        
        public_key = hashlib.sha256(f"{key_id}_public_{random.random()}".encode()).hexdigest()
        private_key = hashlib.sha256(f"{key_id}_private_{random.random()}".encode()).hexdigest()
        
        key_pair = {
            'key_id': key_id,
            'public_key': public_key,
            'private_key': private_key,
            'created_at': datetime.now().isoformat(),
            'expires_at': (datetime.now() + timedelta(days=self.config.key_rotation_days)).isoformat(),
            'is_active': True,
            'algorithm': 'mock_fhe_v1',
            'metadata': {
                'security_level': self.config.security_level,
                'polynomial_degree': self.config.polynomial_degree
            }
        }
        
        self._key_store[key_id] = key_pair
        self._save_keys()
        
        logger.info(f"Generated key pair: {key_id}")
        return key_pair

    def get_public_key(self, key_id: str) -> Optional[str]:
        """
        Get public key by ID.
        
        Args:
            key_id: Key identifier
        
        Returns:
            Public key string
        """
        if key_id in self._key_store:
            return self._key_store[key_id]['public_key']
        return None

    def get_private_key(self, key_id: str) -> Optional[str]:
        """
        Get private key by ID.
        
        Args:
            key_id: Key identifier
        
        Returns:
            Private key string
        """
        if key_id in self._key_store:
            return self._key_store[key_id]['private_key']
        return None

    def get_active_key(self) -> Optional[str]:
        """
        Get the currently active key ID.
        
        Returns:
            Active key ID
        """
        for key_id, key_data in self._key_store.items():
            if key_data.get('is_active', False):
                return key_id
        return None

    def rotate_key(self, current_key_id: str) -> str:
        """
        Rotate to a new key.
        
        Args:
            current_key_id: Current key ID
        
        Returns:
            New key ID
        """
        # Deactivate current key
        if current_key_id in self._key_store:
            self._key_store[current_key_id]['is_active'] = False
        
        # Generate new key
        new_key_id = f"fhe_key_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.generate_key_pair(new_key_id)
        
        logger.info(f"Rotated key from {current_key_id} to {new_key_id}")
        return new_key_id

    def revoke_key(self, key_id: str) -> bool:
        """
        Revoke a key.
        
        Args:
            key_id: Key identifier
        
        Returns:
            True if successful
        """
        if key_id in self._key_store:
            self._key_store[key_id]['is_active'] = False
            self._key_store[key_id]['revoked_at'] = datetime.now().isoformat()
            self._save_keys()
            logger.info(f"Revoked key: {key_id}")
            return True
        return False

    def get_key_info(self, key_id: str) -> Optional[Dict[str, Any]]:
        """Get information about a key."""
        return self._key_store.get(key_id)

    def list_keys(self) -> List[Dict[str, Any]]:
        """List all keys."""
        return list(self._key_store.values())

    def cleanup_expired_keys(self) -> int:
        """
        Clean up expired keys.
        
        Returns:
            Number of keys cleaned
        """
        count = 0
        now = datetime.now()
        
        for key_id, key_data in list(self._key_store.items()):
            expires_at = key_data.get('expires_at')
            if expires_at:
                try:
                    expiry = datetime.fromisoformat(expires_at)
                    if expiry < now:
                        del self._key_store[key_id]
                        count += 1
                except:
                    pass
        
        if count > 0:
            self._save_keys()
            logger.info(f"Cleaned up {count} expired keys")
        
        return count