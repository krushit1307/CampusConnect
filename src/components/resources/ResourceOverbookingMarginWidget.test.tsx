import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResourceOverbookingMarginWidget } from "./ResourceOverbookingMarginWidget";

describe("ResourceOverbookingMarginWidget Component (#4984)", () => {
  it("renders Resource Overbooking Margin header, capacity metrics, and standby queue", () => {
    render(
      <ResourceOverbookingMarginWidget
        assetCategory="Projectors"
        primaryClubName="Film & Cinema Society"
        standbyClubName="Robotics & AI Club"
      />
    );

    expect(screen.getByText(/"Resource Constraint" Overbooking Margin Algorithm — Projectors/i)).toBeInTheDocument();
    expect(screen.getByText("Statistical Yield & Capacity Metrics")).toBeInTheDocument();
    expect(screen.getByText("Film & Cinema Society")).toBeInTheDocument();
    expect(screen.getByText("Robotics & AI Club")).toBeInTheDocument();
  });

  it("simulates 15-minute no-show timeout and promotes standby club with push notification", () => {
    const handlePromoted = vi.fn();
    render(
      <ResourceOverbookingMarginWidget
        primaryClubName="Film & Cinema Society"
        standbyClubName="Robotics & AI Club"
        onStandbyPromoted={handlePromoted}
      />
    );

    const noShowBtn = screen.getByRole("button", { name: /Simulate 15-Min No-Show & Promote Standby/i });
    fireEvent.click(noShowBtn);

    expect(handlePromoted).toHaveBeenCalledWith(
      expect.objectContaining({
        noShowConfirmed: true,
        promotedToActive: true,
        standbyClubName: "Robotics & AI Club",
      })
    );

    expect(screen.getByText(/PUSH NOTIFICATION DISPATCHED/i)).toBeInTheDocument();
  });

  it("simulates primary RFID pickup scan and confirms asset checkout", () => {
    render(
      <ResourceOverbookingMarginWidget
        primaryClubName="Film & Cinema Society"
      />
    );

    const rfidBtn = screen.getByRole("button", { name: /Simulate Primary RFID Pickup Scan/i });
    fireEvent.click(rfidBtn);

    expect(screen.getByText(/SCANNED \/ CHECKED OUT/i)).toBeInTheDocument();
  });
});
