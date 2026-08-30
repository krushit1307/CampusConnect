/**
 * Data Models & Types for VIP Event Transport Sync & Autonomous Fleet Integration (Issue #5138).
 */

export type VipTransportState =
  | "DRAFT"
  | "VIP_DESIGNATED"
  | "ITINERARY_LINKED"
  | "FLIGHT_TRACKING"
  | "FLIGHT_LANDED"
  | "TRANSPORT_REQUESTED"
  | "VEHICLE_CONFIRMED"
  | "VIP_NOTIFIED"
  | "EN_ROUTE"
  | "ARRIVED"
  | "COMPLETED"
  | "DISPATCH_FAILED"
  | "BILLING_FAILED"
  | "CANCELLED";

export type FlightStatus =
  "SCHEDULED" | "AIRBORNE" | "ARRIVING" | "LANDED" | "DELAYED" | "CANCELLED";

export type AutonomousFleetProviderType =
  "waymo_driverless" | "cruise_autonomous" | "generic_fleet";

export interface FlightItinerary {
  flightNumber: string;
  carrier: string;
  departureAirport: string; // e.g. "JFK"
  arrivalAirport: string; // e.g. "SFO"
  terminal: string; // e.g. "Terminal 2"
  scheduledArrivalIso: string;
  actualArrivalIso?: string;
  status: FlightStatus;
}

export interface AutonomousVehicleDispatch {
  dispatchId: string;
  provider: AutonomousFleetProviderType;
  vehicleId: string;
  licensePlate: string;
  vehicleModel: string;
  isDriverless: boolean;
  pickupPoint: string; // e.g. "SFO Terminal 2, Door 4"
  destinationVenueId: string;
  destinationVenueName: string;
  estimatedEtaMinutes: number;
  status: "ASSIGNED" | "EN_ROUTE_PICKUP" | "WAITING_AT_TERMINAL" | "TRIP_IN_PROGRESS" | "COMPLETED";
  dispatchedAtIso: string;
}

export interface TransportBillingRecord {
  billingId: string;
  clubId: string;
  clubName: string;
  amountUsd: number;
  escrowTxHash: string;
  status: "PENDING" | "ENCUMBERED" | "SETTLED" | "FAILED";
  billedAtIso: string;
}

export interface VipTransportRequest {
  requestId: string;
  eventId: string;
  eventTitle: string;
  speakerId: string;
  speakerName: string;
  speakerEmail: string;
  speakerPhone: string;
  isVip: boolean;
  flightItinerary?: FlightItinerary;
  vehicleDispatch?: AutonomousVehicleDispatch;
  billingRecord?: TransportBillingRecord;
  notificationMessageSent?: string;
  status: VipTransportState;
  createdAtIso: string;
  updatedAtIso: string;
}
