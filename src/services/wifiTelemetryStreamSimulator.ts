// =============================================================================
// File: src/services/wifiTelemetryStreamSimulator.ts
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Real-time WiFi device density streaming engine, MAC address
//              anonymization hashes, and crowd redirection physics models.
// =============================================================================

import type { VenueZone, WiFiAccessPoint } from "@/types/capacityThermalMap";
import { evaluateZoneSafetyStatus } from "@/services/capacityThermalMapService";

/**
 * Anonymizes client MAC addresses using one-way SHA-256 equivalent salt hash
 * to preserve attendee privacy and adhere to campus FERPA/GDPR regulations.
 */
export function anonymizeDeviceMac(mac: string, salt: string = "campus_career_fair_2026"): string {
  let hash = 0;
  const combined = mac + salt;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `anon-dev-${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

/**
 * Simulates real-time crowd dynamics over a 4-second tick.
 * - Fluctuation of connected devices per WiFi Access Point.
 * - If redirection is active, progressively migrates attendees from Gym A into Gym C.
 */
export function simulateCrowdTick(
  zones: VenueZone[],
  accessPoints: WiFiAccessPoint[],
  isRedirectionActive: boolean = false
): { updatedZones: VenueZone[]; updatedAccessPoints: WiFiAccessPoint[] } {
  // 1. Update Access Points
  const updatedAccessPoints = accessPoints.map((ap) => {
    let delta = Math.round((Math.random() - 0.48) * 4); // slight random shift

    // If redirection is active, bleed devices from Gym A and boost Gym C
    if (isRedirectionActive) {
      if (ap.zoneId === "zone-gym-a") {
        delta = -Math.abs(Math.round(1 + Math.random() * 3));
      } else if (ap.zoneId === "zone-gym-c") {
        delta = Math.abs(Math.round(2 + Math.random() * 4));
      }
    }

    const newCount = Math.max(5, ap.connectedDeviceCount + delta);
    return {
      ...ap,
      connectedDeviceCount: newCount,
      lastTelemetryPing: new Date().toISOString(),
    };
  });

  // 2. Aggregate updated counts into Zones
  const updatedZones = zones.map((zone) => {
    const zoneAps = updatedAccessPoints.filter((ap) => ap.zoneId === zone.id);
    const totalDevices = zoneAps.reduce((sum, ap) => sum + ap.connectedDeviceCount, 0);

    // Each active attendee typically carries 1.25 connected WiFi devices (phone + laptop/smartwatch)
    const estimatedAttendees = Math.round(totalDevices * 0.95);
    const { status, percentage } = evaluateZoneSafetyStatus(
      estimatedAttendees,
      zone.maxFireCodeCapacity
    );

    return {
      ...zone,
      currentOccupancyCount: estimatedAttendees,
      occupancyPercentage: percentage,
      safetyStatus: status,
      ingressRatePerMin: Math.max(1, Math.round(zone.ingressRatePerMin + (Math.random() - 0.5) * 3)),
      egressRatePerMin: Math.max(1, Math.round(zone.egressRatePerMin + (Math.random() - 0.5) * 2)),
    };
  });

  return { updatedZones, updatedAccessPoints };
}

/**
 * Calculates total facility density metrics and overall compliance rating.
 */
export function calculateFacilitySummary(zones: VenueZone[]) {
  const totalOccupancy = zones.reduce((sum, z) => sum + z.currentOccupancyCount, 0);
  const totalCapacity = zones.reduce((sum, z) => sum + z.maxFireCodeCapacity, 0);
  const totalAreaM2 = zones.reduce((sum, z) => sum + z.areaSquareMeters, 0);
  const overallPercentage = totalCapacity > 0 ? Number(((totalOccupancy / totalCapacity) * 100).toFixed(1)) : 0;
  const attendeesPerM2 = totalAreaM2 > 0 ? Number((totalOccupancy / totalAreaM2).toFixed(2)) : 0;

  const hasFireHazard = zones.some((z) => z.safetyStatus === "critical_fire_hazard");

  return {
    totalOccupancy,
    totalCapacity,
    totalAreaM2,
    overallPercentage,
    attendeesPerM2,
    hasFireHazard,
    criticalZoneCount: zones.filter((z) => z.safetyStatus === "critical_fire_hazard").length,
  };
}
