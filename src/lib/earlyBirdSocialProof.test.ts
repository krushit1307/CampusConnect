import { describe, expect, it } from "vitest";
import {
  TICKET_PURCHASED_EVENT,
  checkoutPresenceChannel,
  countConnectedClients,
  formatTicketPurchasedToast,
  formatViewerBadge,
  shouldNotifyOtherViewer,
  ticketsRemaining,
} from "./earlyBirdSocialProof";

describe("early bird social proof (#4735)", () => {
  it("joins a checkout channel and counts connected clients", () => {
    expect(checkoutPresenceChannel("evt-1")).toBe("checkout:evt-1");
    expect(
      countConnectedClients({
        a: [{}],
        b: [{}],
      }),
    ).toBe(2);
    expect(formatViewerBadge(14)).toBe("🔥 14 people are looking at this ticket right now!");
  });

  it("toasts other viewers when a ticket is purchased", () => {
    expect(TICKET_PURCHASED_EVENT).toBe("ticket_purchased");
    expect(formatTicketPurchasedToast(5)).toBe("🎉 Someone just bought a ticket! Only 5 left!");
    expect(ticketsRemaining(5, 50)).toBe(5);
    expect(shouldNotifyOtherViewer("buyer-1", "viewer-2")).toBe(true);
    expect(shouldNotifyOtherViewer("buyer-1", "buyer-1")).toBe(false);
  });
});
