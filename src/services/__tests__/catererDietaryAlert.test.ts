import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSevereDietaryTag,
  checkAndTriggerCatererDietaryAlert,
  acknowledgeCatererDietaryAlert,
} from "../catererDietaryAlert";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe("Caterer Dietary Restriction Alert Service (#3676)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isSevereDietaryTag", () => {
    it("identifies life-threatening / severe allergy tags correctly", () => {
      expect(isSevereDietaryTag("allergy_peanut_severe")).toBe(true);
      expect(isSevereDietaryTag("severe_peanut_allergy")).toBe(true);
      expect(isSevereDietaryTag("gluten_celiac_severe")).toBe(true);
      expect(isSevereDietaryTag("anaphylaxis")).toBe(true);
      expect(isSevereDietaryTag("life-threatening")).toBe(true);
    });

    it("returns false for standard non-severe dietary preferences", () => {
      expect(isSevereDietaryTag("vegetarian")).toBe(false);
      expect(isSevereDietaryTag("vegan")).toBe(false);
      expect(isSevereDietaryTag("halal")).toBe(false);
      expect(isSevereDietaryTag("kosher")).toBe(false);
    });
  });

  describe("checkAndTriggerCatererDietaryAlert", () => {
    it("does NOT trigger alert if caterer RFP is not yet finalized (rfp_finalized_at is null)", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "contract-1",
                event_id: "event-1",
                caterer_name: "Gourmet Catering",
                caterer_email: "chef@gourmet.com",
                rfp_finalized_at: null, // RFP NOT finalized yet
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await checkAndTriggerCatererDietaryAlert("event-1", "user-1", "Jane Doe", [
        "allergy_peanut_severe",
      ]);

      expect(result.triggered).toBe(false);
    });

    it("triggers emergency alert if severe allergy is registered post-RFP finalization", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "event_caterer_contracts") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "contract-1",
                    event_id: "event-1",
                    caterer_name: "Gourmet Catering",
                    caterer_email: "chef@gourmet.com",
                    caterer_phone: "+15550199",
                    rfp_finalized_at: "2026-08-18T10:00:00Z", // RFP finalized on Monday!
                    events: { title: "Annual Gala Dance" },
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "caterer_dietary_alerts") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "alert-101",
                    event_id: "event-1",
                    attendee_name: "Jane Doe",
                    dietary_tag: "ALLERGY PEANUT SEVERE",
                    severity_level: "SEVERE",
                    caterer_email: "chef@gourmet.com",
                    acknowledgment_status: "PENDING",
                    token: "token-abc-123",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await checkAndTriggerCatererDietaryAlert("event-1", "user-1", "Jane Doe", [
        "allergy_peanut_severe",
      ]);

      expect(result.triggered).toBe(true);
      expect(result.alertMessage).toContain("URGENT UPDATE: A new attendee (Jane Doe)");
      expect(result.alertMessage).toContain("ALLERGY PEANUT SEVERE");
      expect(result.alertData?.acknowledgment_status).toBe("PENDING");
    });
  });

  describe("acknowledgeCatererDietaryAlert", () => {
    it("updates alert status to ACKNOWLEDGED when vendor clicks acknowledgment button", async () => {
      mockFrom.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "alert-101",
                  acknowledgment_status: "ACKNOWLEDGED",
                  acknowledged_at: "2026-08-21T10:45:00Z",
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await acknowledgeCatererDietaryAlert("token-abc-123");
      expect(result.success).toBe(true);
      expect(result.data?.acknowledgment_status).toBe("ACKNOWLEDGED");
    });
  });
});
