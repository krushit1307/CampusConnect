/**
 * VIP Transport Service & State Machine Orchestrator (Issue #5138).
 *
 * Coordinates end-to-end VIP speaker event transport workflow:
 * 1. Designates speakers/guests as VIPs.
 * 2. Links flight itineraries and monitors arrival status (`SCHEDULED` -> `LANDED`).
 * 3. Triggers autonomous driverless vehicle dispatches (Waymo/Cruise) upon flight arrival.
 * 4. Dispatches SMS notifications ("Your self-driving car is waiting at Terminal 2. The destination is pre-programmed.").
 * 5. Encumbers transport fees against Club Escrow accounts.
 */

import {
  mockFlightTrackingProvider,
  FlightTrackingProvider,
} from "./flightProvider/flightTrackingProvider";
import {
  mockAutonomousFleetProvider,
  AutonomousFleetProvider,
} from "./autonomousFleet/autonomousFleetProvider";
import {
  transportBillingProvider,
  TransportBillingProvider,
} from "./billing/transportBillingProvider";
import { FlightItinerary, VipTransportRequest, VipTransportState } from "@/types/vipTransport";

export class VipTransportService {
  private requests: Map<string, VipTransportRequest> = new Map();

  private flightProvider: FlightTrackingProvider;
  private fleetProvider: AutonomousFleetProvider;
  private billingProvider: TransportBillingProvider;

  constructor(
    flightProvider: FlightTrackingProvider = mockFlightTrackingProvider,
    fleetProvider: AutonomousFleetProvider = mockAutonomousFleetProvider,
    billingProvider: TransportBillingProvider = transportBillingProvider,
  ) {
    this.flightProvider = flightProvider;
    this.fleetProvider = fleetProvider;
    this.billingProvider = billingProvider;

    this.seedDefaultRequests();
  }

  /**
   * Seeds default VIP transport request for testing.
   */
  private seedDefaultRequests() {
    const defaultReq: VipTransportRequest = {
      requestId: "vip_req_101",
      eventId: "evt_ai_summit_2026",
      eventTitle: "Annual Campus AI & Robotics Summit",
      speakerId: "spk_dr_reynolds",
      speakerName: "Dr. Aris Thorne",
      speakerEmail: "thorne@ai-research.org",
      speakerPhone: "+1 (555) 234-5678",
      isVip: true,
      flightItinerary: {
        flightNumber: "AA-1042",
        carrier: "AA",
        departureAirport: "JFK",
        arrivalAirport: "SFO",
        terminal: "Terminal 2",
        scheduledArrivalIso: new Date().toISOString(),
        status: "SCHEDULED",
      },
      status: "ITINERARY_LINKED",
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };

    this.requests.set(defaultReq.requestId, defaultReq);
  }

  /**
   * Event Organizer designates an event speaker/guest as a VIP.
   */
  public designateVipSpeaker(
    eventId: string,
    eventTitle: string,
    speakerId: string,
    speakerName: string,
    speakerEmail: string,
    speakerPhone: string,
  ): VipTransportRequest {
    const requestId = `vip_req_${eventId}_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const request: VipTransportRequest = {
      requestId,
      eventId,
      eventTitle,
      speakerId,
      speakerName,
      speakerEmail,
      speakerPhone,
      isVip: true,
      status: "VIP_DESIGNATED",
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    this.requests.set(requestId, request);
    return request;
  }

  /**
   * Links flight travel itinerary to VIP transport request.
   */
  public linkFlightItinerary(
    requestId: string,
    carrier: string,
    flightNumber: string,
    terminal: string = "Terminal 2",
  ): VipTransportRequest {
    const request = this.requests.get(requestId);
    if (!request || !request.isVip) {
      throw new Error("VIP Transport request not found or speaker is not VIP.");
    }

    const cleanCarrier = carrier.toUpperCase().trim();
    const cleanFlight = flightNumber.toUpperCase().trim();

    request.flightItinerary = {
      flightNumber: `${cleanCarrier}-${cleanFlight}`,
      carrier: cleanCarrier,
      departureAirport: "JFK",
      arrivalAirport: "SFO",
      terminal,
      scheduledArrivalIso: new Date().toISOString(),
      status: "SCHEDULED",
    };

    request.status = "ITINERARY_LINKED";
    request.updatedAtIso = new Date().toISOString();

    this.requests.set(requestId, request);
    return request;
  }

  /**
   * Triggers flight tracking update and executes autonomous vehicle dispatch upon flight landing.
   */
  public async trackFlightAndDispatchVehicle(
    requestId: string,
    venueId: string = "v_science_auditorium",
    venueName: string = "Campus Science Auditorium",
    clubId: string = "club_ai_robotics",
    clubName: string = "AI & Robotics Club",
  ): Promise<VipTransportRequest> {
    const request = this.requests.get(requestId);
    if (!request || !request.flightItinerary) {
      throw new Error("Invalid request or flight itinerary missing.");
    }

    request.status = "FLIGHT_TRACKING";

    // 1. Fetch Flight Arrival Status
    const itinerary = await this.flightProvider.fetchFlightStatus(
      request.flightItinerary.carrier,
      request.flightItinerary.flightNumber,
    );

    request.flightItinerary = itinerary;

    if (itinerary.status !== "LANDED") {
      request.updatedAtIso = new Date().toISOString();
      this.requests.set(requestId, request);
      return request;
    }

    request.status = "FLIGHT_LANDED";

    // 2. Dispatch Autonomous Driverless Vehicle (Waymo/Cruise mock)
    request.status = "TRANSPORT_REQUESTED";

    try {
      const dispatch = await this.fleetProvider.dispatchVehicle(
        itinerary.arrivalAirport,
        itinerary.terminal,
        venueId,
        venueName,
      );

      request.vehicleDispatch = dispatch;
      request.status = "VEHICLE_CONFIRMED";

      // 3. Dispatch VIP SMS Notification
      const notificationMsg = `Your self-driving car is waiting at ${itinerary.terminal}. The destination is pre-programmed to ${venueName}.`;
      request.notificationMessageSent = notificationMsg;
      request.status = "VIP_NOTIFIED";

      // 4. Bill Transport Fee to Club Escrow
      const billing = await this.billingProvider.processEscrowBilling(clubId, clubName, 45.0);
      request.billingRecord = billing;
      request.status = "EN_ROUTE";
    } catch (err: any) {
      request.status = "DISPATCH_FAILED";
      console.error("[VipTransportService] Autonomous dispatch error:", err);
    }

    request.updatedAtIso = new Date().toISOString();
    this.requests.set(requestId, request);
    return request;
  }

  public getRequests(): VipTransportRequest[] {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime(),
    );
  }

  public getRequestById(requestId: string): VipTransportRequest | null {
    return this.requests.get(requestId) ?? null;
  }
}

export const vipTransportService = new VipTransportService();
