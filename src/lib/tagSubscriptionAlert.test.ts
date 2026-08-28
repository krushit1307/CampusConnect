import { describe, it, expect } from "vitest";
import { buildTagSubscriptionAlertMessage } from "./tagSubscriptionAlert";

describe("Club Tag Subscription Alert (#4427)", () => {
  it("builds the fan-out alert copy for a subscribed taxonomy tag", () => {
    expect(buildTagSubscriptionAlertMessage("Board Game Club", "Chess")).toBe(
      "New Event Alert: The Board Game Club just posted a #Chess event! RSVP now.",
    );
  });
});
