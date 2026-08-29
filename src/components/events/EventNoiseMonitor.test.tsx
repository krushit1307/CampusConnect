import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventNoiseMonitor } from "./EventNoiseMonitor";

// Mock Supabase client
const mockOn = vi.fn().mockImplementation((event, filter, callback) => {
  // Save callback to simulate broadcast updates
  (globalThis as any).simulateNoiseUpdate = callback;
  return {
    subscribe: vi.fn(),
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: mockOn,
    }),
    removeChannel: vi.fn(),
  }),
}));

describe("EventNoiseMonitor UI Component", () => {
  it("renders offline/empty state when no live noise feed has occurred", () => {
    render(<EventNoiseMonitor eventId="test-event-123" />);

    expect(screen.getByText("Acoustic Vibe Monitor")).toBeInTheDocument();
    expect(screen.getByText("No Live Noise Feed Yet")).toBeInTheDocument();
    expect(screen.getByText(/readings will appear automatically/i)).toBeInTheDocument();
  });

  it("updates vibe and decibels gauge when receiving realtime broadcast", async () => {
    render(<EventNoiseMonitor eventId="test-event-123" />);

    // Simulate broadcast update: "Pin Drop" vibe
    await act(async () => {
      if ((globalThis as any).simulateNoiseUpdate) {
        (globalThis as any).simulateNoiseUpdate({
          payload: { decibels: 45 },
        });
      }
    });

    expect(screen.getByText("Live Feed")).toBeInTheDocument();
    expect(screen.getByText("Pin Drop")).toBeInTheDocument();
    expect(screen.getByText("45 dB")).toBeInTheDocument();
    expect(screen.getByText("Extremely quiet. Whispers or typing only.")).toBeInTheDocument();

    // Simulate loud sound update
    await act(async () => {
      if ((globalThis as any).simulateNoiseUpdate) {
        (globalThis as any).simulateNoiseUpdate({
          payload: { decibels: 92 },
        });
      }
    });

    expect(screen.getByText("Loud")).toBeInTheDocument();
    expect(screen.getByText("92 dB")).toBeInTheDocument();
    expect(screen.getByText("Highly energetic and noisy environment.")).toBeInTheDocument();
  });
});
