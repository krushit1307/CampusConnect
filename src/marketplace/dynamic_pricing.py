"""
src/marketplace/dynamic_pricing.py
----------------------------------
Algorithmic dynamic price floor enforcement for secondary market ticket listings.
"""

from __future__ import annotations

from typing import Any


class DynamicPriceFloorEngine:
    """Calculates and enforces dynamic price floors based on waitlist count and time remaining."""

    def calculate_price_floor(self, face_value: float, waitlist_count: int, time_until_event_hours: float) -> float:
        """Calculate the minimum allowable resale price using demand elasticity."""
        if waitlist_count > 50:
            # High Demand: Floor is set to 90% of Face Value
            return face_value * 0.90
        elif waitlist_count == 0 and time_until_event_hours <= 1.0:
            # Low Demand & Last-Minute Liquidation: Floor drops to 10% of Face Value
            return face_value * 0.10
        else:
            # Standard linear interpolation or default baseline floor (e.g., 50%)
            return face_value * 0.50

    def validate_listing(self, face_value: float, requested_price: float, waitlist_count: int, time_until_event_hours: float) -> dict[str, Any]:
        """Validate a user's requested resale listing price against the dynamic price floor."""
        floor_price = self.calculate_price_floor(face_value, waitlist_count, time_until_event_hours)

        if requested_price < floor_price:
            return {
                "status": "blocked",
                "floor_price": floor_price,
                "error_message": (
                    f"Error: Due to high demand, tickets cannot be sold below ${floor_price:.2f}."
                ),
            }

        return {
            "status": "approved",
            "floor_price": floor_price,
            "message": "Listing price meets compliance requirements.",
        }
