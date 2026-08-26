import pytest
from app.services.geofence_manager import GeofenceManager

def test_haversine_within_radius():
    # User is very close to the venue
    venue_lat, venue_lon = 40.7128, -74.0060 # NYC
    user_lat, user_lon = 40.71285, -74.00605
    radius = 100
    
    result = GeofenceManager.validate_checkin(user_lat, user_lon, venue_lat, venue_lon, radius)
    assert result["status"] == "SUCCESS"
    assert result["distance_meters"] <= radius

def test_haversine_outside_radius():
    # User is far from the venue
    venue_lat, venue_lon = 40.7128, -74.0060 # NYC
    user_lat, user_lon = 42.3601, -71.0589 # Boston
    radius = 100
    
    result = GeofenceManager.validate_checkin(user_lat, user_lon, venue_lat, venue_lon, radius)
    assert result["status"] == "FAILED"
    assert result["message"] == "You are not close enough to the venue."
    assert result["distance_meters"] > radius
