import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminKioskFleetDashboard from "../admin.kiosk-fleet";
import { createClient } from "@/lib/supabase/client";

const mockFrom = vi.fn();
const channelMock = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    channel: vi.fn().mockReturnValue(channelMock),
    removeChannel: vi.fn(),
  }),
}));

describe("Admin Kiosk Fleet Management Dashboard (#3455)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders fleet dashboard title and empty state when no kiosks are connected", async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: selectMock,
      }),
    });

    render(<AdminKioskFleetDashboard />);

    expect(screen.getByText("Kiosk Fleet Management")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText(
          "No kiosk telemetry received yet. Active kiosks will broadcast telemetry every 60 seconds.",
        ),
      ).toBeInTheDocument();
    });
  });

  it("flashes massive red warning when iPad battery drops below 15% without charging", async () => {
    const mockKiosks = [
      {
        device_id: "Door 4",
        event_id: "event-gala-1",
        battery_level: 12,
        is_charging: false,
        ping_ms: 45,
        network_type: "wifi",
        last_seen: new Date().toISOString(),
      },
      {
        device_id: "Door 1",
        event_id: "event-gala-1",
        battery_level: 85,
        is_charging: true,
        ping_ms: 22,
        network_type: "wifi",
        last_seen: new Date().toISOString(),
      },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: mockKiosks,
          error: null,
        }),
      }),
    });

    render(<AdminKioskFleetDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("critical-dying-battery-alert")).toBeInTheDocument();
      expect(screen.getByText(/Door 4 iPad/i)).toBeInTheDocument();
      expect(screen.getByText(/Deploy charger immediately/i)).toBeInTheDocument();
    });
  });
});
