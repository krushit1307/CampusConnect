"""
Detection Rules for EcoBuddy AI
Rules for detecting headless browsers and bot activity.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta

from backend.models.fingerprint_models import (
    CanvasFingerprint, WebGLFingerprint, FingerprintAnalysis,
    RiskLevel, DeviceClass
)

logger = logging.getLogger(__name__)


class DetectionRules:
    """
    Rules for detecting headless browsers and bot activity.
    """

    def __init__(self):
        self._rules = self._load_rules()

    def _load_rules(self) -> List[Dict[str, Any]]:
        """Load detection rules."""
        return [
            {
                'id': 'R001',
                'name': 'Headless Renderer Detected',
                'condition': lambda a: a.is_headless,
                'action': 'block',
                'severity': 'critical',
                'description': 'Headless browser renderer detected'
            },
            {
                'id': 'R002',
                'name': 'Software Rendering Detected',
                'condition': lambda a: self._has_software_rendering(a),
                'action': 'flag',
                'severity': 'high',
                'description': 'Software rendering detected (headless indicator)'
            },
            {
                'id': 'R003',
                'name': 'Virtual GPU Detected',
                'condition': lambda a: self._has_virtual_gpu(a),
                'action': 'flag',
                'severity': 'high',
                'description': 'Virtual GPU detected (server environment)'
            },
            {
                'id': 'R004',
                'name': 'Known Bot Hash Matched',
                'condition': lambda a: a.matched_known_bot,
                'action': 'block',
                'severity': 'critical',
                'description': 'Matched known bot fingerprint'
            },
            {
                'id': 'R005',
                'name': 'Multiple Headless Indicators',
                'condition': lambda a: self._count_headless_indicators(a) >= 3,
                'action': 'block',
                'severity': 'high',
                'description': 'Multiple headless indicators detected'
            },
            {
                'id': 'R006',
                'name': 'High Risk Canvas Fingerprint',
                'condition': lambda a: a.canvas_fingerprint and a.canvas_fingerprint.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL],
                'action': 'flag',
                'severity': 'medium',
                'description': 'High risk canvas fingerprint'
            },
            {
                'id': 'R007',
                'name': 'Device Class Mismatch',
                'condition': lambda a: self._has_device_mismatch(a),
                'action': 'flag',
                'severity': 'medium',
                'description': 'Device class mismatch detected'
            }
        ]

    def apply_rules(self, analysis: FingerprintAnalysis) -> Dict[str, Any]:
        """
        Apply all detection rules to an analysis.
        
        Args:
            analysis: FingerprintAnalysis object
        
        Returns:
            Result with triggered rules
        """
        triggered = []
        for rule in self._rules:
            if rule['condition'](analysis):
                triggered.append({
                    'rule_id': rule['id'],
                    'rule_name': rule['name'],
                    'action': rule['action'],
                    'severity': rule['severity'],
                    'description': rule['description']
                })

        return {
            'triggered_rules': triggered,
            'count': len(triggered),
            'highest_severity': self._get_highest_severity(triggered),
            'recommended_action': self._get_recommended_action(triggered)
        }

    def _has_software_rendering(self, analysis: FingerprintAnalysis) -> bool:
        """Check for software rendering."""
        if analysis.webgl_fingerprint:
            renderer = analysis.webgl_fingerprint.renderer_info.get('renderer', '')
            return 'software' in renderer.lower()
        return False

    def _has_virtual_gpu(self, analysis: FingerprintAnalysis) -> bool:
        """Check for virtual GPU."""
        if analysis.canvas_fingerprint:
            return 'virtual' in analysis.canvas_fingerprint.gpu_info.lower()
        return False

    def _count_headless_indicators(self, analysis: FingerprintAnalysis) -> int:
        """Count headless indicators."""
        count = 0
        if analysis.is_headless:
            count += 1
        if self._has_software_rendering(analysis):
            count += 1
        if self._has_virtual_gpu(analysis):
            count += 1
        if analysis.matched_known_bot:
            count += 1
        return count

    def _has_device_mismatch(self, analysis: FingerprintAnalysis) -> bool:
        """Check for device class mismatch."""
        # In production, compare with expected device class
        return False

    def _get_highest_severity(self, triggered: List[Dict[str, Any]]) -> str:
        """Get highest severity from triggered rules."""
        severity_order = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
        highest = 'low'
        for rule in triggered:
            if severity_order.get(rule['severity'], 0) > severity_order.get(highest, 0):
                highest = rule['severity']
        return highest

    def _get_recommended_action(self, triggered: List[Dict[str, Any]]) -> str:
        """Get recommended action based on triggered rules."""
        if any(r['action'] == 'block' for r in triggered):
            return 'block'
        elif any(r['action'] == 'flag' for r in triggered):
            return 'flag_for_review'
        else:
            return 'allow'

    def add_rule(self, rule: Dict[str, Any]) -> None:
        """Add a custom rule."""
        self._rules.append(rule)

    def remove_rule(self, rule_id: str) -> bool:
        """Remove a rule by ID."""
        for i, rule in enumerate(self._rules):
            if rule.get('id') == rule_id:
                del self._rules[i]
                return True
        return False

    def get_rules(self) -> List[Dict[str, Any]]:
        """Get all rules."""
        return self._rules

    def get_rule_summary(self) -> Dict[str, Any]:
        """Get rule summary."""
        return {
            'total_rules': len(self._rules),
            'block_rules': sum(1 for r in self._rules if r.get('action') == 'block'),
            'flag_rules': sum(1 for r in self._rules if r.get('action') == 'flag'),
            'critical_severity': sum(1 for r in self._rules if r.get('severity') == 'critical'),
            'high_severity': sum(1 for r in self._rules if r.get('severity') == 'high'),
            'medium_severity': sum(1 for r in self._rules if r.get('severity') == 'medium')
        }