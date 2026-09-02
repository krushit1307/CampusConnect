"""
Canvas Analyzer for EcoBuddy AI
Analyzes Canvas/WebGL fingerprints for headless bot detection.
"""

import logging
import hashlib
import json
import base64
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

from backend.models.fingerprint_models import (
    CanvasFingerprint, WebGLFingerprint, FingerprintAnalysis,
    DeviceClass, RiskLevel
)

logger = logging.getLogger(__name__)


class CanvasAnalyzer:
    """
    Analyzes Canvas and WebGL fingerprints for bot detection.
    """

    # Known headless patterns
    HEADLESS_PATTERNS = {
        'canvas': [
            'headless_chrome',
            'aws_lambda',
            'puppeteer',
            'selenium',
            'phantomjs',
            'headless',
            'aws',
            'digitalocean',
            'ec2',
            'container'
        ],
        'webgl': [
            'swiftshader',
            'software_renderer',
            'virtual_gpu',
            'llvmpipe',
            'vulkan',
            'direct3d'
        ],
        'renderer': [
            'ANGLE',
            'SwiftShader',
            'VirtualBox',
            'VMware',
            'Hyper-V'
        ]
    }

    # Known bot hashes (simplified)
    BOT_HASHES = {
        'headless_chrome': 'a1b2c3d4e5f6',
        'aws_lambda': 'f6e5d4c3b2a1',
        'puppeteer': '1a2b3c4d5e6f'
    }

    def __init__(self):
        self._known_hashes: Dict[str, Dict[str, Any]] = {}
        self._load_known_hashes()

    def _load_known_hashes(self) -> None:
        """Load known hashes for comparison."""
        # In production, load from database
        self._known_hashes = {
            'headless_chrome': {
                'canvas_hash': 'abc123def456',
                'webgl_hash': '789ghi012jkl',
                'device': 'headless_chrome',
                'risk': RiskLevel.HIGH
            },
            'aws_lambda': {
                'canvas_hash': 'mno345pqr678',
                'webgl_hash': 'stu901vwx234',
                'device': 'aws_lambda',
                'risk': RiskLevel.CRITICAL
            },
            'puppeteer': {
                'canvas_hash': 'yzabc789def0',
                'webgl_hash': '123ghi456jkl',
                'device': 'puppeteer',
                'risk': RiskLevel.HIGH
            }
        }

    def analyze_canvas_fingerprint(
        self,
        canvas_data: Dict[str, Any],
        session_id: str
    ) -> CanvasFingerprint:
        """
        Analyze canvas fingerprint data.
        
        Args:
            canvas_data: Canvas data from client
            session_id: Session ID
        
        Returns:
            CanvasFingerprint object
        """
        # Extract data
        hash_value = canvas_data.get('hash', '')
        pixel_hash = canvas_data.get('pixelHash', '')
        width = canvas_data.get('width', 0)
        height = canvas_data.get('height', 0)
        renderer_info = canvas_data.get('rendererInfo', '')
        gpu_info = canvas_data.get('gpuInfo', '')
        os_info = canvas_data.get('osInfo', '')

        # Create fingerprint
        fingerprint = CanvasFingerprint(
            session_id=session_id,
            hash_value=hash_value,
            width=width,
            height=height,
            pixel_data_hash=pixel_hash,
            renderer_info=renderer_info,
            gpu_info=gpu_info,
            os_info=os_info
        )

        # Analyze for headless detection
        self._analyze_canvas_fingerprint(fingerprint)

        return fingerprint

    def analyze_webgl_fingerprint(
        self,
        webgl_data: Dict[str, Any],
        session_id: str
    ) -> WebGLFingerprint:
        """
        Analyze WebGL fingerprint data.
        
        Args:
            webgl_data: WebGL data from client
            session_id: Session ID
        
        Returns:
            WebGLFingerprint object
        """
        # Extract data
        renderer_hash = webgl_data.get('rendererHash', '')
        vendor_hash = webgl_data.get('vendorHash', '')
        shader_hash = webgl_data.get('shaderHash', '')
        extensions_hash = webgl_data.get('extensionsHash', '')
        renderer_info = webgl_data.get('rendererInfo', {})

        # Create fingerprint
        fingerprint = WebGLFingerprint(
            session_id=session_id,
            renderer_hash=renderer_hash,
            vendor_hash=vendor_hash,
            shading_language_hash=shader_hash,
            extensions_hash=extensions_hash,
            max_texture_size=webgl_data.get('maxTextureSize', 0),
            max_vertex_attribs=webgl_data.get('maxVertexAttribs', 0),
            renderer_info=renderer_info
        )

        return fingerprint

    def analyze_both(
        self,
        canvas_data: Dict[str, Any],
        webgl_data: Dict[str, Any],
        session_id: str
    ) -> FingerprintAnalysis:
        """
        Analyze both canvas and WebGL fingerprints.
        
        Args:
            canvas_data: Canvas data
            webgl_data: WebGL data
            session_id: Session ID
        
        Returns:
            FingerprintAnalysis object
        """
        canvas_fp = self.analyze_canvas_fingerprint(canvas_data, session_id)
        webgl_fp = self.analyze_webgl_fingerprint(webgl_data, session_id)

        # Create analysis
        analysis = FingerprintAnalysis(
            session_id=session_id,
            canvas_fingerprint=canvas_fp,
            webgl_fingerprint=webgl_fp
        )

        # Determine device class
        analysis.device_class = self._determine_device_class(canvas_fp, webgl_fp)
        
        # Determine if headless/bot
        headless_result = self.detect_headless(canvas_fp, webgl_fp)
        analysis.is_headless = headless_result['detected']
        analysis.is_bot = headless_result['detected']
        analysis.confidence_score = headless_result['confidence']
        analysis.risk_level = headless_result['risk_level']

        # Check against known bots
        matched = self._match_known_bot(canvas_fp, webgl_fp)
        if matched:
            analysis.matched_known_bot = True
            analysis.known_bot_id = matched['id']

        analysis.analysis_timestamp = datetime.now()

        return analysis

    def _analyze_canvas_fingerprint(self, fingerprint: CanvasFingerprint) -> None:
        """Analyze canvas fingerprint for headless patterns."""
        # Check for headless patterns
        patterns_found = []
        renderer_lower = fingerprint.renderer_info.lower()
        gpu_lower = fingerprint.gpu_info.lower()
        os_lower = fingerprint.os_info.lower()

        for pattern in self.HEADLESS_PATTERNS['canvas']:
            if pattern in renderer_lower or pattern in gpu_lower:
                patterns_found.append(pattern)

        # Check renderer patterns
        for pattern in self.HEADLESS_PATTERNS['renderer']:
            if pattern in renderer_lower:
                patterns_found.append(pattern)

        # Determine risk level
        if patterns_found:
            fingerprint.risk_level = RiskLevel.HIGH if len(patterns_found) > 2 else RiskLevel.MEDIUM
            fingerprint.is_headless = len(patterns_found) > 1
        else:
            fingerprint.risk_level = RiskLevel.LOW

        fingerprint.confidence_score = min(len(patterns_found) * 20, 95)
        fingerprint.is_bot = fingerprint.is_headless

    def detect_headless(
        self,
        canvas_fp: CanvasFingerprint,
        webgl_fp: WebGLFingerprint
    ) -> Dict[str, Any]:
        """
        Detect headless browser from fingerprints.
        
        Args:
            canvas_fp: Canvas fingerprint
            webgl_fp: WebGL fingerprint
        
        Returns:
            Detection result
        """
        signals = []
        evidence = {}
        confidence = 0.0

        # Check canvas renderer
        if canvas_fp.renderer_info:
            if any(p in canvas_fp.renderer_info.lower() for p in self.HEADLESS_PATTERNS['renderer']):
                signals.append('headless_renderer')
                confidence += 25

        # Check WebGL renderer
        if webgl_fp.renderer_info:
            renderer = webgl_fp.renderer_info.get('renderer', '')
            if any(p in renderer.lower() for p in self.HEADLESS_PATTERNS['webgl']):
                signals.append('headless_webgl')
                confidence += 30

        # Check for software rendering
        if webgl_fp.renderer_info:
            if 'software' in webgl_fp.renderer_info.get('renderer', '').lower():
                signals.append('software_rendering')
                confidence += 20

        # Check for virtual GPU
        if 'virtual' in canvas_fp.gpu_info.lower():
            signals.append('virtual_gpu')
            confidence += 15

        # Check against known patterns
        for key, patterns in self.HEADLESS_PATTERNS.items():
            for pattern in patterns:
                if pattern in canvas_fp.renderer_info.lower() or pattern in webgl_fp.renderer_info.get('renderer', '').lower():
                    evidence[f'pattern_{pattern}'] = True

        # Determine risk level
        risk_level = RiskLevel.LOW
        if confidence >= 70:
            risk_level = RiskLevel.CRITICAL
        elif confidence >= 50:
            risk_level = RiskLevel.HIGH
        elif confidence >= 30:
            risk_level = RiskLevel.MEDIUM

        return {
            'detected': confidence >= 50,
            'confidence': min(confidence, 100),
            'signals': signals,
            'evidence': evidence,
            'risk_level': risk_level,
            'recommendation': self._get_recommendation(confidence, signals)
        }

    def _determine_device_class(
        self,
        canvas_fp: CanvasFingerprint,
        webgl_fp: WebGLFingerprint
    ) -> DeviceClass:
        """Determine device class from fingerprints."""
        if canvas_fp.is_headless:
            return DeviceClass.HEADLESS
        
        # Check for mobile indicators
        if any(p in canvas_fp.os_info.lower() for p in ['ios', 'android', 'iphone', 'ipad']):
            return DeviceClass.MOBILE
        
        # Check for tablet indicators
        if any(p in canvas_fp.os_info.lower() for p in ['ipad', 'tablet']):
            return DeviceClass.TABLET
        
        # Check for desktop
        if any(p in canvas_fp.os_info.lower() for p in ['windows', 'mac', 'linux']):
            return DeviceClass.DESKTOP
        
        return DeviceClass.UNKNOWN

    def _match_known_bot(
        self,
        canvas_fp: CanvasFingerprint,
        webgl_fp: WebGLFingerprint
    ) -> Optional[Dict[str, Any]]:
        """Match against known bot fingerprints."""
        # Simple hash matching
        for bot_id, bot_data in self._known_hashes.items():
            if canvas_fp.hash_value and bot_data.get('canvas_hash'):
                if canvas_fp.hash_value[:12] == bot_data['canvas_hash']:
                    return {'id': bot_id, 'data': bot_data}
            if webgl_fp.renderer_hash and bot_data.get('webgl_hash'):
                if webgl_fp.renderer_hash[:12] == bot_data['webgl_hash']:
                    return {'id': bot_id, 'data': bot_data}
        return None

    def _get_recommendation(self, confidence: float, signals: List[str]) -> str:
        """Get recommendation based on detection."""
        if confidence >= 70:
            return "🔴 HIGH RISK: Block this user and purge all associated reviews"
        elif confidence >= 50:
            return "🟡 MEDIUM RISK: Flag for manual review"
        elif confidence >= 30:
            return "🟢 LOW RISK: Continue monitoring"
        else:
            return "✅ NO RISK: Normal behavior"