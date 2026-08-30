/**
 * Flight Tracking Provider Abstraction (Issue #5138).
 *
 * Normalizes flight status updates from external flight tracking providers (e.g. FlightAware)
 * and detects flight arrival events for VIP transport triggers.
 */

import { FlightItinerary, FlightStatus } from "@/types/vipTransport";

export interface FlightTrackingProvider {
  fetchFlightStatus(carrier: string, flightNumber: string): Promise<FlightItinerary>;
}

export class MockFlightTrackingProvider implements FlightTrackingProvider {
  /**
   * Fetches flight status with simulated realistic itinerary updates.
   */
  public async fetchFlightStatus(carrier: string, flightNumber: string): Promise<FlightItinerary> {
    const cleanCarrier = carrier.toUpperCase().trim() || "AA";
    const cleanFlight = flightNumber.toUpperCase().trim() || "1042";

    const now = new Date();

    return {
      flightNumber: `${cleanCarrier}-${cleanFlight}`,
      carrier: cleanCarrier,
      departureAirport: "JFK",
      arrivalAirport: "SFO",
      terminal: "Terminal 2",
      scheduledArrivalIso: now.toISOString(),
      actualArrivalIso: now.toISOString(),
      status: "LANDED",
    };
  }
}

export const mockFlightTrackingProvider = new MockFlightTrackingProvider();
