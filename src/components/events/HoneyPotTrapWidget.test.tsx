import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HoneyPotTrapWidget } from "./HoneyPotTrapWidget";

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
                  id: "session-1",
                  ip_address: "127.0.0.1",
                  fingerprint: "cc_fp_test_123",
                  trigger_reason: "honeypot_trap",
                  is_active: true,
                  session_start: new Date().toISOString(),
                },
              ],
              error: null,
            }),
        }),
      }),
    }),
  };
});

describe("HoneyPotTrapWidget", () => {
  it("renders fingerprint signature info and logs active bot sessions", async () => {
    render(<HoneyPotTrapWidget />);

    expect(screen.getByTestId("honeypot-trap-widget")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-honeypot-btn")).toBeInTheDocument();

    // Verify mock session renders
    expect(await screen.findByText(/cc_fp_test_123/i)).toBeInTheDocument();
  });
});
