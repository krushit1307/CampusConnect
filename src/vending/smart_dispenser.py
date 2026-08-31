"""
src/vending/smart_dispenser.py
------------------------------
Interactive Dietary Restriction Smart Vending Machine Facial Recognition and 
Safety Dispensing Controller.
"""

from __future__ import annotations

from typing import Any


class SmartVendingController:
    """Handles IoT edge logic for biometric verification, dietary restriction cross-referencing, and hardware locks."""

    def __init__(self, aws_rekognition_client: Any | None = None, nutritional_api: Any | None = None) -> None:
        self.rekognition = aws_rekognition_client
        self.nutritional_api = nutritional_api

    def process_vending_transaction(self, user_id: str, qr_code_data: str, captured_face_image: bytes, item_code: str) -> dict[str, Any]:
        """Process purchase request with facial recognition and dietary restriction validation."""
        # 1. Match the face against the user's profile via AWS Rekognition
        match_result = self._verify_face(user_id, captured_face_image)
        if not match_result.get("verified", False):
            return {
                "status": "blocked",
                "reason": "Biometric verification failed.",
                "hardware_action": "lock_coil",
            }

        # 2. Pull user's medical profile dietary restrictions array
        user_restrictions = self._fetch_user_dietary_restrictions(user_id)

        # 3. Cross-reference against item nutritional data
        item_allergens = self._fetch_item_allergens(item_code)

        # 4. Check for lethal dietary conflicts
        conflicts = [allergen for allergen in item_allergens if allergen.lower() in [r.lower() for r in user_restrictions]]

        if conflicts:
            conflict_str = ", ".join(conflicts)
            warning_msg = (
                f"SALE BLOCKED: This item contains {conflict_str}, "
                "which contradicts your medical profile."
            )
            return {
                "status": "blocked",
                "risk_level": "lethal_conflict",
                "hardware_action": "lock_coil_and_flash_red_led",
                "notification_message": warning_msg,
            }

        # 5. Safe to dispense
        return {
            "status": "approved",
            "hardware_action": "release_coil",
            "message": "Dispensing item successfully.",
        }

    def _verify_face(self, user_id: str, face_image: bytes) -> dict[str, bool]:
        """Mock or execute AWS Rekognition face match."""
        if self.rekognition:
            # Integration logic for boto3 rekognition
            pass
        return {"verified": True}

    def _fetch_user_dietary_restrictions(self, user_id: str) -> list[str]:
        """Retrieve user medical profile dietary restrictions."""
        # Database query mock returning restricted allergens
        return ["Peanuts"]

    def _fetch_item_allergens(self, item_code: str) -> list[str]:
        """Retrieve item nutritional API data for a given vending slot code."""
        # Nutritional API mock
        catalog = {
            "A4": ["Peanuts", "Dairy"],
            "B2": ["Gluten"],
            "C1": [],
        }
        return catalog.get(item_code, [])
