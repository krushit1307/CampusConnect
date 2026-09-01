import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CampusSafetyEscortEtaTrackerWidget } from "./CampusSafetyEscortEtaTrackerWidget";

describe("CampusSafetyEscortEtaTrackerWidget Component (#4686)", () => {
  it("renders Campus Safety Escort ETA Tracker header, radar map, and officer badge", () => {
    render(
      <CampusSafetyEscortEtaTrackerWidget
        officerName="Officer Smith"
        officerBadgeNumber="PD-402"
      />
    );

    expect(screen.getByText(/Real-Time "Campus Safety" Escort ETA Tracker/i)).toBeInTheDocument();
    expect(screen.getByText("Live Radar Stream Canvas (Officer GPS)")).toBeInTheDocument();
    expect(screen.getByText("#PD-402")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Call Campus Dispatch/i })).toBeInTheDocument();
  });

  it("displays live officer arrival ETA badge", () => {
    render(
      <CampusSafetyEscortEtaTrackerWidget
        officerName="Officer Smith"
      />
    );

    expect(screen.getByText(/Officer Smith is 3 minutes away/i)).toBeInTheDocument();
  });

  it("toggles phone screen strobe signal on button click", () => {
    render(<CampusSafetyEscortEtaTrackerWidget />);

    const strobeBtn = screen.getByRole("button", { name: /Flash Phone Screen Strobe Signal/i });
    fireEvent.click(strobeBtn);

    expect(screen.getByRole("button", { name: /Stop Strobe Screen Signal/i })).toBeInTheDocument();
  });
});
