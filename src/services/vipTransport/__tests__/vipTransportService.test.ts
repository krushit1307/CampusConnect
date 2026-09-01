import { describe, it, expect, beforeEach } from "vitest";
import { VipTransportService } from "../vipTransportService";

describe("VipTransportService", () => {
  let service: VipTransportService;

  beforeEach(() => {
    service = new VipTransportService();
  });

  it("loads default seeded VIP transport requests", () => {
    const requests = service.getRequests();
    expect(requests.length).toBeGreaterThanOrEqual(1);
    expect(requests[0].isVip).toBe(true);
  });

  it("designates speaker as VIP and links flight itinerary", () => {
    const req = service.designateVipSpeaker(
      "evt_robotics_2026",
      "Robotics Expo",
      "spk_chen",
      "Prof. Chen",
      "chen@robotics.org",
      "+1-555-987-6543",
    );

    expect(req.status).toBe("VIP_DESIGNATED");

    const linked = service.linkFlightItinerary(req.requestId, "UA", "789", "Terminal 3");
    expect(linked.status).toBe("ITINERARY_LINKED");
    expect(linked.flightItinerary?.flightNumber).toBe("UA-789");
  });

  it("tracks flight arrival, dispatches driverless vehicle, sends SMS alert, and bills club escrow", async () => {
    const req = service.designateVipSpeaker(
      "evt_ai_2026",
      "AI Keynote",
      "spk_turing",
      "Dr. Alan Turing",
      "turing@ai.org",
      "+1-555-111-2222",
    );

    service.linkFlightItinerary(req.requestId, "DL", "456", "Terminal 2");

    const updated = await service.trackFlightAndDispatchVehicle(req.requestId);

    expect(updated.status).toBe("EN_ROUTE");
    expect(updated.vehicleDispatch).toBeDefined();
    expect(updated.vehicleDispatch?.provider).toBe("waymo_driverless");
    expect(updated.vehicleDispatch?.isDriverless).toBe(true);
    expect(updated.notificationMessageSent).toContain(
      "Your self-driving car is waiting at Terminal 2",
    );
    expect(updated.billingRecord?.status).toBe("SETTLED");
  });
});
