import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CatererDietaryAlertWidget } from "../events/CatererDietaryAlertWidget";
import {
  getCatererDietaryAlerts,
  acknowledgeCatererDietaryAlert,
} from "@/services/catererDietaryAlert";

vi.mock("@/services/catererDietaryAlert", () => ({
  getCatererDietaryAlerts: vi.fn(),
  acknowledgeCatererDietaryAlert: vi.fn(),
}));

describe("CatererDietaryAlertWidget Component (#3676)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pending emergency caterer health alert banner", async () => {
    (getCatererDietaryAlerts as any).mockResolvedValue([
      {
        id: "alert-1",
        event_id: "event-1",
        attendee_name: "Jane Doe",
        dietary_tag: "PEANUT ALLERGY SEVERE",
        caterer_email: "chef@gourmet.com",
        acknowledgment_status: "PENDING",
        token: "token-123",
      },
    ]);

    render(<CatererDietaryAlertWidget eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("pending-caterer-alert-banner")).toBeInTheDocument();
      expect(screen.getByText(/URGENT CATERER HEALTH ALERT/i)).toBeInTheDocument();
      expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
      expect(screen.getByTestId("simulate-acknowledge-btn")).toBeInTheDocument();
    });
  });

  it("renders acknowledged caterer alert banner when vendor has acknowledged", async () => {
    (getCatererDietaryAlerts as any).mockResolvedValue([
      {
        id: "alert-1",
        event_id: "event-1",
        attendee_name: "Jane Doe",
        dietary_tag: "PEANUT ALLERGY SEVERE",
        caterer_email: "chef@gourmet.com",
        acknowledgment_status: "ACKNOWLEDGED",
        acknowledged_at: new Date().toISOString(),
        token: "token-123",
      },
    ]);

    render(<CatererDietaryAlertWidget eventId="event-1" />);

    await waitFor(() => {
      expect(screen.getByTestId("acknowledged-caterer-alert-banner")).toBeInTheDocument();
      expect(screen.getByText(/Caterer Health Alert Acknowledged/i)).toBeInTheDocument();
    });
  });
});
