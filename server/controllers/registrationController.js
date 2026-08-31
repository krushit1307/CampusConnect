// server/controllers/registrationController.js
import { db, calculateOverbookCapacity } from '../services/overbookingEngine.js';
import { triggerBouncerOverflowProtocol } from '../services/bouncerOverflowTrigger.js';

export const handleEventRSVP = async (req, res) => {
  try {
    const { eventId, userId } = req.body;
    const event = db.events[eventId];

    if (!event) return res.status(404).json({ error: "Target event record not found." });

    // Extract historical statistics to determine virtual inventory override limit
    const { allowedOverbookCapacity, showRate } = calculateOverbookCapacity(event.clubId, event.venueCapacity);

    // Evaluate structural boundary checks against dynamic cap values
    if (event.currentRSVPsCount >= allowedOverbookCapacity) {
      return res.status(422).json({
        error: "REGISTRATION_MAXED",
        message: "Event registration is completely full, including maximum predictive overbooking capacity buffers."
      });
    }

    // Allocate registration slot securely
    event.currentRSVPsCount += 1;

    return res.status(200).json({
      success: true,
      message: "RSVP Confirmed using statistical overbooking capacity.",
      metrics: {
        venueCapacity: event.venueCapacity,
        virtualInventoryLimit: allowedOverbookCapacity,
        calculatedShowRate: `${showRate * 100}%`
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "Registration processing pipeline failed." });
  }
};

/**
 * Inbound real-time webhook callback processing actual on-site check-ins at the door
 */
export const handleOnSiteCheckIn = async (req, res) => {
  try {
    const { eventId, actualArrivalsCount } = req.body;
    const event = db.events[eventId];

    // Technical Requirement 5: Trigger overflow routing if real arrivals cross physical room constraints
    if (actualArrivalsCount > event.venueCapacity) {
      const overflowCount = actualArrivalsCount - event.venueCapacity;
      const bouncerAlert = triggerBouncerOverflowProtocol(eventId, overflowCount);

      return res.status(200).json({
        status: "OVERFLOW_TRIGGERED",
        message: "Anomalous attendance spike. Door limit breached; Bouncer Overflow Protocol activated.",
        details: bouncerAlert
      });
    }

    return res.status(200).json({ status: "OK", message: "Check-in logged securely within physical safety lines." });
  } catch (error) {
    return res.status(500).json({ error: "Check-in tracking failure." });
  }
};
