// server/services/autonomousFleetService.js
import axios from 'axios';

// University Autonomous Operational Geofence Boundaries
const CAMPUS_GEOFENCE = {
  minLat: 22.2500,
  maxLat: 22.3500,
  minLng: 73.1500,
  maxLng: 73.2500,
};

export const VIRTUAL_AUTONOMOUS_DRIVER = {
  id: 'driver_may_mobility_fleet',
  name: 'May Mobility Autonomous Shuttle',
  isAutonomous: true,
  vehicleType: '4-Seater AV Shuttle',
  rating: 4.98
};

// Check if all coordinates are within the permitted autonomous driving zone
export const isWithinAutonomousGeofence = (waypoints) => {
  return waypoints.every(point => 
    point.lat >= CAMPUS_GEOFENCE.minLat &&
    point.lat <= CAMPUS_GEOFENCE.maxLat &&
    point.lng >= CAMPUS_GEOFENCE.minLng &&
    point.lng <= CAMPUS_GEOFENCE.maxLng
  );
};

// Dispatch a booking request to the external Fleet API
export const requestAutonomousShuttle = async ({ rideId, pickupGps, dropoffGps, passengerCount }) => {
  try {
    const payload = {
      externalRideId: rideId,
      pickup: { latitude: pickupGps.lat, longitude: pickupGps.lng },
      dropoff: { latitude: dropoffGps.lat, longitude: dropoffGps.lng },
      capacityRequested: passengerCount,
      operator: 'MAY_MOBILITY'
    };

    // External Fleet Dispatch API Endpoint
    const response = await axios.post(
      process.env.FLEET_API_URL || 'https://maymobility.internal',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FLEET_API_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      fleetTripId: response.data.tripId,
      assignedVehicleId: response.data.vehicleId,
      virtualDriver: VIRTUAL_AUTONOMOUS_DRIVER
    };
  } catch (error) {
    console.error('Autonomous fleet dispatch error:', error.response?.data || error.message);
    throw new Error('Failed to dispatch autonomous shuttle.');
  }
};

// Send command to the fleet vehicle to unlock passenger doors
export const sendUnlockCommand = async (fleetTripId, vehicleId) => {
  try {
    const response = await axios.post(
      `${process.env.FLEET_API_URL || 'https://maymobility.internal'}/shuttles/${vehicleId}/unlock`,
      { tripId: fleetTripId },
      {
        headers: {
          'Authorization': `Bearer ${process.env.FLEET_API_SECRET_KEY}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to trigger door unlock command:', error.response?.data || error.message);
    throw new Error('Unable to unlock autonomous shuttle doors.');
  }
};
