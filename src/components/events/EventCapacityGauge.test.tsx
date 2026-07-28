import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventCapacityGauge } from "./EventCapacityGauge";

// Mock Supabase Client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: () => ({
        subscribe: vi.fn(),
      }),
    }),
    removeChannel: vi.fn(),
  }),
}));

describe("EventCapacityGauge Component", () => {
  it("renders capacity gauge with progress ratio and status", () => {
    render(<EventCapacityGauge eventId="evt-123" initialCapacity={45} maxAttendees={50} />);
    expect(screen.getByText("45")).toBeInPrimary();
    expect(screen.getByText("Only 5 spots left!")).toBeInPrimary();
  });

  it("renders sold out state when capacity is full", () => {
    render(<EventCapacityGauge eventId="evt-123" initialCapacity={50} maxAttendees={50} />);
    expect(screen.getByText("Event Sold Out!")).toBeInPrimary();
  });
});
