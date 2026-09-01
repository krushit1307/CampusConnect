"""
Vision Oracle for Escrow Slashing
Computer vision validation for food structural integrity.
"""

import logging
import base64
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
import uuid

from backend.models.escrow_models import (
    VisionAnalysis, FoodIntegrityStatus, OracleStatus, EscrowContract
)
from backend.ai.food_integrity_model import FoodIntegrityModel

logger = logging.getLogger(__name__)


class VisionOracle:
    """
    Oracle for validating food structural integrity using computer vision.
    Ensures food is intact before escrow release.
    """

    INTEGRITY_THRESHOLD = 90.0  # 0-100 score
    CONFIDENCE_THRESHOLD = 0.8  # 0-1
    ACCEPTABLE_CLASSIFICATIONS = [
        FoodIntegrityStatus.INTACT,
        FoodIntegrityStatus.SLIGHTLY_DAMAGED
    ]

    def __init__(self):
        self._model = FoodIntegrityModel()
        self._analyses: Dict[str, VisionAnalysis] = {}
        self._image_cache: Dict[str, str] = {}

    def analyze_image(
        self,
        image_data: bytes,
        image_url: str = None,
        metadata: Dict[str, Any] = None
    ) -> VisionAnalysis:
        """
        Analyze an image for food integrity.
        
        Args:
            image_data: Image bytes
            image_url: Optional image URL
            metadata: Additional metadata
        
        Returns:
            VisionAnalysis object
        """
        try:
            # Run model inference
            result = self._model.predict(image_data)
            
            # Create analysis
            analysis = VisionAnalysis(
                id=str(uuid.uuid4()),
                image_url=image_url or f"data:image/jpeg;base64,{base64.b64encode(image_data).decode('utf-8')[:100]}...",
                classification=result['classification'],
                confidence_score=result['confidence'],
                integrity_score=result['integrity_score'],
                damage_detected=result['damage_detected'],
                damage_type=result.get('damage_type', ''),
                damage_percentage=result.get('damage_percentage', 0.0),
                raw_predictions=result['predictions'],
                metadata=metadata or {}
            )
            
            self._analyses[analysis.id] = analysis
            
            # Cache image for review
            self._image_cache[analysis.id] = base64.b64encode(image_data).decode('utf-8')
            
            logger.info(f"Vision analysis completed: {analysis.classification.value} (score: {analysis.integrity_score:.1f})")
            return analysis
            
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}")
            # Return fallback analysis
            return VisionAnalysis(
                classification=FoodIntegrityStatus.INTACT,
                confidence_score=0.5,
                integrity_score=50.0,
                damage_detected=False,
                metadata={'error': str(e), 'fallback': True}
            )

    def validate_integrity(
        self,
        analysis: VisionAnalysis,
        threshold: float = None
    ) -> Dict[str, Any]:
        """
        Validate food integrity from analysis.
        
        Args:
            analysis: VisionAnalysis object
            threshold: Custom integrity threshold
        
        Returns:
            Validation result
        """
        if threshold is None:
            threshold = self.INTEGRITY_THRESHOLD

        # Check confidence
        if analysis.confidence_score < self.CONFIDENCE_THRESHOLD:
            return {
                'valid': False,
                'status': OracleStatus.REJECTED.value,
                'message': f'Low confidence: {analysis.confidence_score:.2f} < {self.CONFIDENCE_THRESHOLD}',
                'integrity_score': analysis.integrity_score,
                'confidence': analysis.confidence_score,
                'threshold': threshold
            }

        # Check integrity score
        is_acceptable = analysis.integrity_score >= threshold

        return {
            'valid': is_acceptable,
            'status': OracleStatus.APPROVED.value if is_acceptable else OracleStatus.REJECTED.value,
            'message': f'Integrity score {analysis.integrity_score:.1f} {"meets" if is_acceptable else "does not meet"} threshold {threshold}',
            'integrity_score': analysis.integrity_score,
            'confidence': analysis.confidence_score,
            'threshold': threshold,
            'classification': analysis.classification.value,
            'damage_detected': analysis.damage_detected
        }

    def get_vision_status(
        self,
        analysis: VisionAnalysis,
        contract: EscrowContract
    ) -> OracleStatus:
        """
        Get vision oracle status for a contract.
        
        Args:
            analysis: Vision analysis
            contract: Escrow contract
        
        Returns:
            Oracle status
        """
        result = self.validate_integrity(analysis, contract.integrity_threshold)
        return OracleStatus(result['status'])

    def analyze_damage_type(self, analysis: VisionAnalysis) -> str:
        """
        Get damage type classification.
        
        Args:
            analysis: Vision analysis
        
        Returns:
            Damage type string
        """
        if not analysis.damage_detected:
            return "no_damage"
        
        damage_map = {
            'crushed': 'Crushed/Smashed',
            'compressed': 'Compressed/Flattened',
            'torn': 'Torn/Ripped',
            'displaced': 'Displaced/Misaligned',
            'structural': 'Structural Integrity Compromised'
        }
        
        return damage_map.get(analysis.damage_type, 'unknown_damage')

    def get_damage_severity(self, analysis: VisionAnalysis) -> str:
        """
        Get damage severity level.
        
        Args:
            analysis: Vision analysis
        
        Returns:
            Severity level
        """
        if not analysis.damage_detected:
            return "none"
        
        if analysis.damage_percentage < 10:
            return "minimal"
        elif analysis.damage_percentage < 30:
            return "moderate"
        elif analysis.damage_percentage < 60:
            return "severe"
        else:
            return "critical"

    def batch_analyze_images(
        self,
        images: List[bytes],
        metadata: List[Dict[str, Any]] = None
    ) -> List[VisionAnalysis]:
        """
        Analyze multiple images.
        
        Args:
            images: List of image bytes
            metadata: List of metadata dicts
        
        Returns:
            List of VisionAnalysis objects
        """
        results = []
        metadata = metadata or [{}] * len(images)
        
        for i, image in enumerate(images):
            analysis = self.analyze_image(image, metadata=metadata[i] if i < len(metadata) else {})
            results.append(analysis)
        
        logger.info(f"Batch analyzed {len(images)} images")
        return results

    def get_analysis(self, analysis_id: str) -> Optional[VisionAnalysis]:
        """Get a vision analysis by ID."""
        return self._analyses.get(analysis_id)

    def get_analysis_image(self, analysis_id: str) -> Optional[str]:
        """Get the image for an analysis."""
        return self._image_cache.get(analysis_id)

    def generate_vision_report(
        self,
        analysis: VisionAnalysis
    ) -> Dict[str, Any]:
        """
        Generate a report for vision analysis.
        
        Args:
            analysis: Vision analysis
        
        Returns:
            Report dictionary
        """
        return {
            'analysis_id': analysis.id,
            'classification': analysis.classification.value,
            'confidence': analysis.confidence_score,
            'integrity_score': analysis.integrity_score,
            'damage_detected': analysis.damage_detected,
            'damage_type': self.get_damage_type(analysis),
            'damage_severity': self.get_damage_severity(analysis),
            'damage_percentage': analysis.damage_percentage,
            'is_acceptable': analysis.is_acceptable(),
            'timestamp': analysis.processed_at.isoformat(),
            'raw_predictions': analysis.raw_predictions,
            'metadata': analysis.metadata
        }

    def get_damage_type(self, analysis: VisionAnalysis) -> str:
        """Get damage type description."""
        if not analysis.damage_detected:
            return "No damage detected"
        
        return f"{analysis.damage_type.replace('_', ' ').title()} ({analysis.damage_percentage:.1f}%)"

    def is_image_valid(self, image_data: bytes) -> bool:
        """
        Check if image data is valid.
        
        Args:
            image_data: Image bytes
        
        Returns:
            True if valid
        """
        try:
            from PIL import Image
            import io
            img = Image.open(io.BytesIO(image_data))
            width, height = img.size
            return width > 100 and height > 100
        except:
            return False

    def get_integrity_score_color(self, score: float) -> str:
        """
        Get color for integrity score.
        
        Args:
            score: Integrity score
        
        Returns:
            Color hex
        """
        if score >= 90:
            return '#22c55e'  # Green
        elif score >= 70:
            return '#fbbf24'  # Yellow
        elif score >= 50:
            return '#f97316'  # Orange
        else:
            return '#ef4444'  # Red