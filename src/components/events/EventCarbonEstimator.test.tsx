import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventCarbonEstimator } from "./EventCarbonEstimator";

describe("EventCarbonEstimator Component (#3590)", () => {
  it("renders Carbon Footprint Estimator header, breakdown sources, and metrics banner", () => {
    render(
      <EventCarbonEstimator
        eventTitle="Campus Tech Gala 2026"
        initialVenueSqft={1000}
        initialDurationHours={2}
        initialAttendeeCount={50}
        initialCateringType="vegan"
        initialMitigations={[]}
      />
    );

    expect(screen.getByText(/Event Carbon Footprint Estimator — Campus Tech Gala 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue HVAC & Lighting/i)).toBeInTheDocument();
    expect(screen.getByText(/Attendee Travel & Commute/i)).toBeInTheDocument();
    expect(screen.getByText(/Catering & Food Sourcing/i)).toBeInTheDocument();
    expect(screen.getByTestId("green-event-badge")).toBeInTheDocument();
  });

  it("toggles sustainable mitigations and triggers callback with updated footprint", () => {
    const handleSave = vi.fn();
    render(
      <EventCarbonEstimator
        eventTitle="Campus Tech Gala 2026"
        initialVenueSqft={1000}
        initialDurationHours={2}
        initialAttendeeCount={50}
        initialMitigations={[]}
        onSaveMitigations={handleSave}
      />
    );

    const zeroWasteCheckbox = screen.getByText("Zero Waste Compostable Packaging");
    fireEvent.click(zeroWasteCheckbox);

    expect(handleSave).toHaveBeenCalledWith(
      ["zero_waste_packaging"],
      expect.objectContaining({
        mitigationSavingsKg: expect.any(Number),
        totalCo2Kg: expect.any(Number),
      })
    );
  });

  it("displays Green Certified Event badge when footprint is low", () => {
    render(
      <EventCarbonEstimator
        eventTitle="Green Workshop 2026"
        initialVenueSqft={200}
        initialDurationHours={1}
        initialAttendeeCount={100}
        initialCateringType="vegan"
        initialMitigations={["zero_waste_packaging", "public_transit_shuttle", "digital_collateral"]}
      />
    );

    const badge = screen.getByTestId("green-event-badge");
    expect(badge).toHaveTextContent(/Certified Green Event/i);
  });
});
