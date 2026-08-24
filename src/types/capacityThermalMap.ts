// =============================================================================
// File: src/types/capacityThermalMap.ts
// Issue: #4283 - Build a 'Real-Time "Event Capacity" Thermal Map'
// Description: Type definitions for multi-zone venue floorplans, Cisco Meraki / Aruba
//              WiFi access point telemetry, spatial thermal density, and crowd surge alerts.
// =============================================================================

export type ZoneSafetyStatus =
  | "optimal_green" // Occupancy < 60%
  | "moderate_yellow" // Occupancy 60% - 85%
  | "congested_amber" // Occupancy 85% - 100%
  | "critical_fire_hazard"; // Occupancy > 100% (Over safe limit)

export interface VenueZone {
  id: string; // e.g. "zone-gym-a"
  name: string; // "Gymnasium A (Tech & AI Hub)"
  building: string; // "Student Recreation & Athletic Complex"
  floorLevel: string; // "Floor 1"
  areaSquareMeters: number; // e.g. 1200 m^2
  maxFireCodeCapacity: number; // e.g. 450 people
  currentOccupancyCount: number;
  occupancyPercentage: number; // (current / max) * 100
  safetyStatus: ZoneSafetyStatus;
  accessPointIds: string[];
  averageDwellMinutes: number;
  ingressRatePerMin: number;
  egressRatePerMin: number;
  coordinates: {
    x: number; // percentage (0-100) or pixel
    y: number;
    width: number;
    height: number;
  };
}

export interface WiFiAccessPoint {
  id: string; // e.g. "ap-meraki-gym-a-01"
  macAddress: string; // "00:18:0a:f2:8c:11"
  bssid: string;
  name: string; // "AP-Recreation-North-01"
  vendor: "Cisco Meraki MR56" | "Aruba AP-555" | "Ruckus R750" | "UniFi U6-Enterprise";
  zoneId: string;
  location: {
    x: number; // 0-100 on 2D floorplan canvas
    y: number;
  };
  connectedDeviceCount: number;
  signalBandwidthGhz: "2.4GHz" | "5.0GHz" | "6.0GHz (Wi-Fi 6E)";
  rssiSignalThresholdDbm: number;
  isOnline: boolean;
  lastTelemetryPing: string;
}

export interface ThermalHeatmapPoint {
  x: number;
  y: number;
  intensity: number; // 0.0 (empty) to 1.0 (extreme surge)
  radius: number;
  deviceCount: number;
  zoneId: string;
}

export interface CrowdSurgeAlert {
  id: string;
  eventId: string;
  zoneId: string;
  zoneName: string;
  severity: "WARNING" | "HIGH_DENSITY" | "CRITICAL_FIRE_HAZARD";
  currentOccupancy: number;
  maxCapacity: number;
  occupancyRatioPercent: number; // e.g. 124%
  detectedAt: string;
  suggestedRedirectZoneId: string;
  suggestedRedirectZoneName: string;
  recommendedIncentiveText: string;
  isDismissed: boolean;
  broadcastSent: boolean;
}

export interface CrowdRedirectBroadcast {
  id: string;
  sourceZoneId: string;
  targetZoneId: string;
  title: string;
  notificationMessage: string;
  targetAudienceCount: number;
  incentiveOffer: "FREE_SWAG" | "COFFEE_VOUCHER" | "VIP_RAFFLE_TICKET" | "PRIORITY_ENTRY";
  dispatchedAt: string;
  deliveredCount: number;
  convertedRedirectionCount: number;
}

export interface ThermalMapFilterState {
  searchQuery: string;
  statusFilter: "all" | ZoneSafetyStatus;
  buildingFilter: string;
  showAccessPointMarkers: boolean;
  showThermalHeatOverlay: boolean;
  heatRadiusScale: number;
}
