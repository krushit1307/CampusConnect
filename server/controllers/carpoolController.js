// server/controllers/carpoolController.js
import { 
  isWithinAutonomousGeofence, 
  requestAutonomousShuttle, 
  sendUnlockCommand, 
  VIRTUAL_AUTONOMOUS_DRIVER 
} from '../services/autonomousFleetService.js';

// In-memory/DB state store for active carpools
export const activeRides = new Map();

// 1. Request Carpool Route Handler
export const handleCarpoolRequest = async (req, res) => {
  try {
    const { rideId, studentId, pickupGps, dropoffGps, passengerCount = 1 } = req.body;
    const waypoints = [pickupGps, dropoffGps];

    const qualifiesForAV = isWithinAutonomousGeofence(waypoints);

    if (qualifiesForAV) {
      // Dispatch Virtual Autonomous Shuttle
      const dispatchResult = await requestAutonomousShuttle({
        rideId,
        pickupGps,
        dropoffGps,
        passengerCount
      });

      const rideRecord = {
        rideId,
        studentId,
        driver: VIRTUAL_AUTONOMOUS_DRIVER,
        fleetTripId: dispatchResult.fleetTripId,
        vehicleId: dispatchResult.assignedVehicleId,
        status: 'DISPATCHED',
        vehicleLocation: pickupGps,
        doorUnlocked: false
      };

      activeRides.set(rideId, rideRecord);

      return res.status(200).json({
        success: true,
        mode: 'AUTONOMOUS_SHUTTLE',
        data: rideRecord
      });
    }

    // Fallback: Normal peer-to-peer human driver allocation
    return res.status(200).json({
      success: true,
      mode: 'P2P_HUMAN_DRIVER',
      message: 'Route falls outside autonomous geofence; queued for peer driver matching.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// 2. Inbound Webhook Consumer for Fleet Telemetry & GPS Updates
export const handleFleetWebhook = async (req, res) => {
  const { eventType, tripId, vehicleId, currentLocation, status } = req.body;
  const io = req.app.get('socketio');

  // Locate the corresponding ride record
  let matchingRide = null;
  for (const [rideId, ride] of activeRides.entries()) {
    if (ride.fleetTripId === tripId) {
      matchingRide = ride;
      break;
    }
  }

  if (!matchingRide) {
    return res.status(404).json({ error: 'Ride matching fleet trip not found.' });
  }

  // Update ride telemetry state
  matchingRide.vehicleLocation = currentLocation;
  matchingRide.status = status; // e.g. 'ARRIVING', 'ARRIVED', 'IN_TRANSIT', 'COMPLETED'

  // Push real-time telemetry updates to the student's connected client via Socket.io
  if (io) {
    io.to(matchingRide.rideId).emit('av:telemetry_update', {
      status,
      currentLocation,
      vehicleId,
      isAtPickup: status === 'ARRIVED'
    });
  }

  return res.status(200).json({ received: true });
};

// 3. Endpoint for Students to Unlock Shuttle Doors
export const unlockVehicleDoors = async (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = activeRides.get(rideId);

    if (!ride) {
      return res.status(404).json({ error: 'Active ride not found.' });
    }

    if (ride.status !== 'ARRIVED') {
      return res.status(400).json({ error: 'Vehicle has not yet arrived at the pickup location.' });
    }

    await sendUnlockCommand(ride.fleetTripId, ride.vehicleId);
    ride.doorUnlocked = true;

    return res.status(200).json({
      success: true,
      message: 'Doors unlocked. You may now enter the shuttle.'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
