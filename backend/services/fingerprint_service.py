"""
Fingerprint Service for EcoBuddy AI
Manages fingerprint analysis and headless detection.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import json

from backend.models.fingerprint_models import (
    CanvasFingerprint, WebGLFingerprint, FingerprintAnalysis,
    HeadlessDetectionResult, DeviceClass, RiskLevel
)
from backend.fingerprint.canvas_analyzer import CanvasAnalyzer
from backend.fingerprint.hash_comparator import HashComparator
from backend.fingerprint.detection_rules import DetectionRules

logger = logging.getLogger(__name__)


class FingerprintService:
    """
    Service for managing fingerprint analysis and headless detection.
    """

    def __init__(self):
        self.canvas_analyzer = CanvasAnalyzer()
        self.hash_comparator = HashComparator()
        self.detection_rules = DetectionRules()
        self._analyses: Dict[str, FingerprintAnalysis] = {}
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def analyze_fingerprints(
        self,
        canvas_data: Dict[str, Any],
        webgl_data: Dict[str, Any],
        session_id: str
    ) -> FingerprintAnalysis:
        """
        Analyze fingerprints for headless detection.
        
        Args:
            canvas_data: Canvas data from client
            webgl_data: WebGL data from client
            session_id: Session ID
        
        Returns:
            FingerprintAnalysis object
        """
        # Analyze both fingerprints
        analysis = self.canvas_analyzer.analyze_both(
            canvas_data, webgl_data, session_id
        )

        # Apply detection rules
        rule_result = self.detection_rules.apply_rules(analysis)

        # Store analysis
        self._analyses[analysis.id] = analysis

        # Update session
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                'first_seen': datetime.now(),
                'fingerprints': []
            }
        self._sessions[session_id]['fingerprints'].append(analysis.id)

        logger.info(f"Fingerprint analysis complete: {analysis.device_class.value} (headless: {analysis.is_headless})")
        return analysis

    def get_analysis(self, analysis_id: str) -> Optional[FingerprintAnalysis]:
        """Get analysis by ID."""
        return self._analyses.get(analysis_id)

    def get_session_fingerprints(self, session_id: str) -> List[FingerprintAnalysis]:
        """Get all fingerprints for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return []

        return [
            self._analyses[fp_id]
            for fp_id in session['fingerprints']
            if fp_id in self._analyses
        ]

    def get_risk_assessment(self, session_id: str) -> Dict[str, Any]:
        """
        Get risk assessment for a session.
        
        Args:
            session_id: Session ID
        
        Returns:
            Risk assessment result
        """
        fingerprints = self.get_session_fingerprints(session_id)
        
        if not fingerprints:
            return {
                'risk_level': RiskLevel.LOW,
                'confidence': 0.0,
                'headless_detected': False,
                'bot_detected': False,
                'recommendation': 'No data available'
            }

        # Aggregate risk
        headless_count = sum(1 for f in fingerprints if f.is_headless)
        risk_levels = [f.risk_level for f in fingerprints]
        confidence = max(f.confidence_score for f in fingerprints) if fingerprints else 0

        # Determine overall risk
        if any(r == RiskLevel.CRITICAL for r in risk_levels):
            overall_risk = RiskLevel.CRITICAL
        elif any(r == RiskLevel.HIGH for r in risk_levels):
            overall_risk = RiskLevel.HIGH
        elif any(r == RiskLevel.MEDIUM for r in risk_levels):
            overall_risk = RiskLevel.MEDIUM
        else:
            overall_risk = RiskLevel.LOW

        return {
            'risk_level': overall_risk.value,
            'confidence': confidence,
            'headless_detected': headless_count > 0,
            'bot_detected': any(f.is_bot for f in fingerprints),
            'total_fingerprints': len(fingerprints),
            'headless_count': headless_count,
            'recommendation': self._get_risk_recommendation(overall_risk, headless_count)
        }

    def _get_risk_recommendation(self, risk_level: RiskLevel, headless_count: int) -> str:
        """Get recommendation based on risk assessment."""
        if risk_level == RiskLevel.CRITICAL:
            return "🚨 BLOCK: Critical risk detected - Headless bot confirmed"
        elif risk_level == RiskLevel.HIGH:
            return "⚠️ FLAG: High risk - Suspected headless bot"
        elif risk_level == RiskLevel.MEDIUM:
            return "🔄 REVIEW: Medium risk - Manual review recommended"
        else:
            return "✅ ALLOW: Low risk - No issues detected"

    def block_fingerprint(self, fingerprint_id: str) -> Dict[str, Any]:
        """
        Block a fingerprint.
        
        Args:
            fingerprint_id: Fingerprint ID
        
        Returns:
            Block result
        """
        analysis = self._analyses.get(fingerprint_id)
        if not analysis:
            return {'success': False, 'message': 'Fingerprint not found'}

        analysis.risk_level = RiskLevel.CRITICAL
        analysis.is_headless = True
        analysis.is_bot = True

        return {'success': True, 'message': 'Fingerprint blocked'}

    def get_statistics(self) -> Dict[str, Any]:
        """Get fingerprint service statistics."""
        total = len(self._analyses)
        headless = sum(1 for a in self._analyses.values() if a.is_headless)
        bots = sum(1 for a in self._analyses.values() if a.is_bot)

        return {
            'total_analyses': total,
            'headless_detected': headless,
            'bots_detected': bots,
            'detection_rate': (headless / total * 100) if total > 0 else 0,
            'device_classes': {
                'desktop': sum(1 for a in self._analyses.values() if a.device_class == DeviceClass.DESKTOP),
                'mobile': sum(1 for a in self._analyses.values() if a.device_class == DeviceClass.MOBILE),
                'headless': sum(1 for a in self._analyses.values() if a.device_class == DeviceClass.HEADLESS)
            }
        }

    def cleanup_old_data(self, days: int = 30) -> int:
        """
        Clean up old analysis data.
        
        Args:
            days: Number of days to keep
        
        Returns:
            Number of records cleaned
        """
        cutoff = datetime.now() - timedelta(days=days)
        count = 0

        for analysis_id, analysis in list(self._analyses.items()):
            if analysis.analysis_timestamp < cutoff:
                del self._analyses[analysis_id]
                count += 1

        logger.info(f"Cleaned up {count} old fingerprint analyses")
        return count