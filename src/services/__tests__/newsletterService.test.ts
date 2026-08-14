// src/services/__tests__/newsletterService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewsletterService } from "../newsletterService";
import { NewsletterDesign } from "@/types/newsletter";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      upsert: mockUpsert,
    }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { message: "Dispatched" }, error: null }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" } },
      }),
    },
  }),
}));

describe("NewsletterService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compiles JSON design blocks into email-safe HTML string", () => {
    const design: NewsletterDesign = {
      backgroundColor: "#ffffff",
      blocks: [
        { id: "1", type: "heading", content: "Monthly Announcement" },
        { id: "2", type: "text", content: "Hello members! Check out our updates." },
        { id: "3", type: "button", content: "RSVP Now", url: "https://campusconnect.app" },
      ],
    };

    const compiled = NewsletterService.compileDesignToHtml(design);

    expect(compiled).toContain("MONTHLY ANNOUNCEMENT");
    expect(compiled).toContain("Hello members!");
    expect(compiled).toContain("RSVP NOW");
    expect(compiled).toContain("https://campusconnect.app");
  });

  it("renders dynamic event card in HTML when event data is provided", () => {
    const design: NewsletterDesign = {
      blocks: [{ id: "e1", type: "event_card", eventId: "evt-999" }],
    };

    const eventMap = {
      "evt-999": {
        id: "evt-999",
        title: "Annual Tech Hackathon",
        start_date: "2026-09-01T10:00:00Z",
        location: "Student Union Hall",
        banner_url: "https://example.com/banner.jpg",
      },
    };

    const compiled = NewsletterService.compileDesignToHtml(design, eventMap);

    expect(compiled).toContain("Annual Tech Hackathon");
    expect(compiled).toContain("Student Union Hall");
    expect(compiled).toContain("RSVP Now →");
  });

  it("calculates aggregate analytics correctly", async () => {
    mockSelect.mockImplementation((fields?: string, options?: any) => {
      if (options?.head) {
        // Count for unsubscribes
        return Promise.resolve({ count: 3, error: null });
      }

      return {
        eq: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                { id: "n1", total_recipients: 100, successful_sends: 100 },
                { id: "n2", total_recipients: 50, successful_sends: 50 },
              ],
            }),
        }),
        in: () =>
          Promise.resolve({
            data: [{ event_type: "open" }, { event_type: "open" }, { event_type: "click" }],
          }),
      };
    });

    const stats = await NewsletterService.getClubNewsletterAnalytics("club-123");

    expect(stats.totalSent).toBe(2);
    expect(stats.totalRecipients).toBe(150);
    expect(stats.openCount).toBe(2);
    expect(stats.clickCount).toBe(1);
    expect(stats.unsubscribeCount).toBe(3);
  });
});
