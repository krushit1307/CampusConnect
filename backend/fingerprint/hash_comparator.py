"""
Hash Comparator for EcoBuddy AI
Compares canvas/WebGL hashes to detect headless bots.
"""

import logging
import hashlib
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

from backend.models.fingerprint_models import (
    CanvasFingerprint, WebGLFingerprint, DeviceClass, RiskLevel
)

logger = logging.getLogger(__name__)


class HashComparator:
    """
    Compares canvas/WebGL hashes against known patterns and databases.
    """

    # Known desktop hashes (simplified)
    KNOWN_DESKTOP_HASHES = {
        'chrome_win': 'a1b2c3d4e5f6g7h8i9j0',
        'firefox_win': 'b2c3d4e5f6g7h8i9j0k1',
        'safari_mac': 'c3d4e5f6g7h8i9j0k1l2',
        'edge_win': 'd4e5f6g7h8i9j0k1l2m3'
    }

    # Known mobile hashes
    KNOWN_MOBILE_HASHES = {
        'iphone_14': 'e5f6g7h8i9j0k1l2m3n4',
        'iphone_15': 'f6g7h8i9j0k1l2m3n4o5',
        'samsung_s23': 'g7h8i9j0k1l2m3n4o5p6',
        'pixel_7': 'h8i9j0k1l2m3n4o5p6q7'
    }

    # Known headless hashes
    KNOWN_HEADLESS_HASHES = {
        'headless_chrome': 'abcdef1234567890',
        'puppeteer': 'fedcba0987654321',
        'playwright': '1234567890abcdef',
        'selenium': '0987654321fedcba'
    }

    # WebGL renderer patterns
    DESKTOP_RENDERER_PATTERNS = [
        'ANGLE', 'Direct3D', 'OpenGL', 'NVIDIA', 'AMD', 'Intel'
    ]

    HEADLESS_RENDERER_PATTERNS = [
        'SwiftShader', 'Software Renderer', 'Virtual GPU', 'llvmpipe'
    ]

    def __init__(self):
        self._match_cache: Dict[str, Dict[str, Any]] = {}
        self._statistics: Dict[str, Any] = {
            'total_comparisons': 0,
            'matches_found': 0,
            'headless_detected': 0
        }

    def compare_canvas_hash(
        self,
        fingerprint: CanvasFingerprint
    ) -> Dict[str, Any]:
        """
        Compare canvas hash against known patterns.
        
        Args:
            fingerprint: CanvasFingerprint object
        
        Returns:
            Comparison result
        """
        result = {
            'matched': False,
            'device_type': 'unknown',
            'confidence': 0.0,
            'matches': []
        }

        hash_value = fingerprint.hash_value[:12]

        # Check against desktop hashes
        for device, known_hash in self.KNOWN_DESKTOP_HASHES.items():
            if hash_value == known_hash:
                result['matched'] = True
                result['device_type'] = 'desktop'
                result['confidence'] = 0.9
                result['matches'].append({'device': device, 'type': 'desktop'})

        # Check against mobile hashes
        for device, known_hash in self.KNOWN_MOBILE_HASHES.items():
            if hash_value == known_hash:
                result['matched'] = True
                result['device_type'] = 'mobile'
                result['confidence'] = 0.85
                result['matches'].append({'device': device, 'type': 'mobile'})

        # Check against headless hashes
        for device, known_hash in self.KNOWN_HEADLESS_HASHES.items():
            if hash_value == known_hash:
                result['matched'] = True
                result['device_type'] = 'headless'
                result['confidence'] = 0.95
                result['matches'].append({'device': device, 'type': 'headless'})

        self._statistics['total_comparisons'] += 1
        if result['matched']:
            self._statistics['matches_found'] += 1
            if result['device_type'] == 'headless':
                self._statistics['headless_detected'] += 1

        return result

    def compare_webgl_hash(
        self,
        fingerprint: WebGLFingerprint
    ) -> Dict[str, Any]:
        """
        Compare WebGL hash against known patterns.
        
        Args:
            fingerprint: WebGLFingerprint object
        
        Returns:
            Comparison result
        """
        result = {
            'matched': False,
            'device_type': 'unknown',
            'confidence': 0.0,
            'matches': []
        }

        renderer_info = fingerprint.renderer_info
        renderer = renderer_info.get('renderer', '').lower()
        vendor = renderer_info.get('vendor', '').lower()

        # Check renderer patterns
        for pattern in self.DESKTOP_RENDERER_PATTERNS:
            if pattern.lower() in renderer:
                result['matched'] = True
                result['device_type'] = 'desktop'
                result['confidence'] = 0.7
                result['matches'].append({'pattern': pattern, 'type': 'desktop'})

        for pattern in self.HEADLESS_RENDERER_PATTERNS:
            if pattern.lower() in renderer:
                result['matched'] = True
                result['device_type'] = 'headless'
                result['confidence'] = 0.85
                result['matches'].append({'pattern': pattern, 'type': 'headless'})

        # Check vendor patterns
        if 'nvidia' in vendor or 'amd' in vendor or 'intel' in vendor:
            result['device_type'] = 'desktop'
            result['confidence'] = max(result['confidence'], 0.6)
        elif 'software' in renderer:
            result['device_type'] = 'headless'
            result['confidence'] = max(result['confidence'], 0.8)

        self._statistics['total_comparisons'] += 1
        if result['matched']:
            self._statistics['matches_found'] += 1
            if result['device_type'] == 'headless':
                self._statistics['headless_detected'] += 1

        return result

    def compare_both(
        self,
        canvas_fp: CanvasFingerprint,
        webgl_fp: WebGLFingerprint
    ) -> Dict[str, Any]:
        """
        Compare both canvas and WebGL fingerprints.
        
        Args:
            canvas_fp: Canvas fingerprint
            webgl_fp: WebGL fingerprint
        
        Returns:
            Combined comparison result
        """
        canvas_result = self.compare_canvas_hash(canvas_fp)
        webgl_result = self.compare_webgl_hash(webgl_fp)

        combined_result = {
            'matched': False,
            'device_type': 'unknown',
            'confidence': 0.0,
            'canvas_matches': canvas_result['matches'],
            'webgl_matches': webgl_result['matches']
        }

        # Combine results
        if canvas_result['matched'] or webgl_result['matched']:
            combined_result['matched'] = True

            # Determine device type
            if canvas_result['device_type'] == 'headless' or webgl_result['device_type'] == 'headless':
                combined_result['device_type'] = 'headless'
            elif canvas_result['device_type'] == 'desktop' or webgl_result['device_type'] == 'desktop':
                combined_result['device_type'] = 'desktop'
            elif canvas_result['device_type'] == 'mobile' or webgl_result['device_type'] == 'mobile':
                combined_result['device_type'] = 'mobile'
            else:
                combined_result['device_type'] = 'unknown'

            # Calculate confidence
            confidence = max(
                canvas_result.get('confidence', 0),
                webgl_result.get('confidence', 0)
            )
            combined_result['confidence'] = confidence

        return combined_result

    def get_statistics(self) -> Dict[str, Any]:
        """Get comparator statistics."""
        return self._statistics

    def reset_statistics(self) -> None:
        """Reset statistics."""
        self._statistics = {
            'total_comparisons': 0,
            'matches_found': 0,
            'headless_detected': 0
        }

    def add_known_hash(self, hash_value: str, device_type: str, device_name: str) -> None:
        """
        Add a known hash to the database.
        
        Args:
            hash_value: Hash value
            device_type: Type of device
            device_name: Name of the device
        """
        if device_type == 'desktop':
            self.KNOWN_DESKTOP_HASHES[device_name] = hash_value[:12]
        elif device_type == 'mobile':
            self.KNOWN_MOBILE_HASHES[device_name] = hash_value[:12]
        elif device_type == 'headless':
            self.KNOWN_HEADLESS_HASHES[device_name] = hash_value[:12]