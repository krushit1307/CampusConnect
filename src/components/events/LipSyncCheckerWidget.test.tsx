import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LipSyncCheckerWidget } from "./LipSyncCheckerWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  id: "check-123",
                  video_name: "president_endorsement_fake.mp4",
                  correlation_score: 0.42,
                  is_fake: true,
                  status: "QUARANTINED",
                  created_at: new Date().toISOString(),
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  };
});

describe("LipSyncCheckerWidget", () => {
  it("renders scanned video logs and quarantined status", async () => {
    render(<LipSyncCheckerWidget userId="user-123" />);

    expect(screen.getByTestId("lipsync-checker-widget")).toBeInTheDocument();
    expect(screen.getByTestId("lipsync-video-input")).toBeInTheDocument();
    expect(screen.getByTestId("lipsync-verify-btn")).toBeInTheDocument();

    // Verify mock video logs render
    expect(await screen.findByText(/president_endorsement_fake.mp4/i)).toBeInTheDocument();
    expect(screen.getByText(/QUARANTINED/i)).toBeInTheDocument();
  });
});
