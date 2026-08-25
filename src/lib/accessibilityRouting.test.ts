import { describe, it, expect } from "vitest";
import {
  isCriticalAccommodation,
  routeAccessibilityRequest,
  getOrganizerLockedUIState,
  fulfillAccessibilityRequest,
  AccessibilityRequestPayload,
} from "./accessibilityRouting";

describe("Real-Time Accessibility Routing Protocol Utility (#4277)", () => {
  it("identifies critical accommodation types requiring professional Disability Services routing", () => {
    expect(isCriticalAccommodation("asl_interpreter")).toBe(true);
    expect(isCriticalAccommodation("braille_materials")).toBe(true);
    expect(isCriticalAccommodation("wheelchair_shuttle")).toBe(true);
    expect(isCriticalAccommodation("general_food_preference")).toBe(false);
  });

  it("routes request directly to Disability Services with generated ticket ID", () => {
    const payload = routeAccessibilityRequest({
      eventId: "evt-101",
      eventTitle: "Annual Keynote",
      accommodationType: "asl_interpreter",
    });

    expect(payload.status).toBe("routed_to_disability_services");
    expect(payload.disabilityServicesTicketId).toMatch(/^DS-\d{4}$/);
  });

  it("generates locked UI state for student organizers when request is pending", () => {
    const request: AccessibilityRequestPayload = {
      id: "req-1",
      eventId: "evt-101",
      eventTitle: "Annual Keynote",
      accommodationType: "asl_interpreter",
      status: "routed_to_disability_services",
      disabilityServicesTicketId: "DS-9402",
      createdAt: new Date().toISOString(),
    };

    const lockedUI = getOrganizerLockedUIState(request);

    expect(lockedUI.isLocked).toBe(true);
    expect(lockedUI.bannerTitle).toContain("Handled by University Disability Services Admin");
    expect(lockedUI.bannerMessage).toContain("No action is required on your part");
    expect(lockedUI.ticketIdText).toBe("Ticket #DS-9402");
  });

  it("unlocks assurance confirmation when Disability Services Admin fulfills request", () => {
    const request: AccessibilityRequestPayload = {
      id: "req-1",
      eventId: "evt-101",
      eventTitle: "Annual Keynote",
      accommodationType: "asl_interpreter",
      status: "routed_to_disability_services",
      disabilityServicesTicketId: "DS-9402",
      createdAt: new Date().toISOString(),
    };

    const fulfilled = fulfillAccessibilityRequest(request, "Certified ASL Interpreter Sarah Jenkins assigned.");
    expect(fulfilled.status).toBe("fulfilled_by_admin");

    const lockedUI = getOrganizerLockedUIState(fulfilled);
    expect(lockedUI.isLocked).toBe(false);
    expect(lockedUI.bannerTitle).toContain("Accommodations Fulfilled by University Admin");
  });
});
