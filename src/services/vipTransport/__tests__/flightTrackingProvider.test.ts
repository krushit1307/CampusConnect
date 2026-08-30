import { describe, it, expect } from "vitest";
import { MockFlightTrackingProvider } from "../flightProvider/flightTrackingProvider";

describe("MockFlightTrackingProvider", () => {
  const provider = new MockFlightTrackingProvider();

  it("fetches flight status and returns normalized landed itinerary", async () => {
    const itinerary = await provider.fetchFlightStatus("AA", "1042");

    expect(itinerary.flightNumber).toBe("AA-1042");
    expect(itinerary.carrier).toBe("AA");
    expect(itinerary.arrivalAirport).toBe("SFO");
    expect(itinerary.terminal).toBe("Terminal 2");
    expect(itinerary.status).toBe("LANDED");
  });
});
