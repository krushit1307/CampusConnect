import math
from typing import Dict, Any

class GeofenceManager:
    @staticmethod
    def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371000  # Earth radius in meters
        
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = math.sin(delta_phi / 2.0) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * \
            math.sin(delta_lambda / 2.0) ** 2
            
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    @staticmethod
    def validate_checkin(
        user_lat: float, 
        user_lon: float, 
        venue_lat: float, 
        venue_lon: float, 
        geofence_radius: float
    ) -> Dict[str, Any]:
        distance = GeofenceManager.haversine_distance_meters(user_lat, user_lon, venue_lat, venue_lon)
        
        if distance <= geofence_radius:
            return {
                "status": "SUCCESS",
                "message": "Check-in successful.",
                "distance_meters": distance
            }
        else:
            return {
                "status": "FAILED",
                "message": "You are not close enough to the venue.",
                "distance_meters": distance
            }
