// server/services/overbookingEngine.js

// Mock Database Stores
export const db = {
  events: {
    "evt_live_101": { id: "evt_live_101", clubId: "club_tech", venueCapacity: 100, currentRSVPsCount: 0 }
  },
  attendanceHistory: [
    { clubId: "club_tech", eventId: "evt_old_1", totalRSVPs: 100, actualCheckIns: 80 },
    { clubId: "club_tech", eventId: "evt_old_2", totalRSVPs: 50, actualCheckIns: 42 },
    { clubId: "club_tech", eventId: "evt_old_3", totalRSVPs: 120, actualCheckIns: 94 }
  ]
};

/**
 * Technical Requirement 1 & 2:
 * Evaluates a club's historical flake rate to predict optimal overbooking multipliers.
 */
export const calculateOverbookCapacity = (clubId, venueCapacity) => {
  const pastEvents = db.attendanceHistory.filter(h => h.clubId === clubId);
  
  if (pastEvents.length === 0) {
    return venueCapacity; // Fallback to 1:1 if no history exists
  }

  // Calculate actual aggregate Show_Rate
  const totalRSVPs = pastEvents.reduce((sum, e) => sum + e.totalRSVPs, 0);
  const totalCheckIns = pastEvents.reduce((sum, e) => sum + e.actualCheckIns, 0);
  const showRate = totalCheckIns / totalRSVPs; // e.g., 0.816

  // Predicted flake rate
  const flakeRate = 1.0 - showRate;

  // Enforce a strict conservative ceiling (maximum 120% override to prevent extreme risk)
  const overbookMultiplier = Math.min(1.0 + flakeRate, 1.20);
  
  // Calculate dynamic allowed reservation threshold limits
  const calculatedCapacity = Math.floor(venueCapacity * overbookMultiplier);
  
  return {
    showRate: parseFloat(showRate.toFixed(2)),
    flakeRate: parseFloat(flakeRate.toFixed(2)),
    allowedOverbookCapacity: calculatedCapacity
  };
};
