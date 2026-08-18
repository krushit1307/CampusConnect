import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EventParkingMap, DEFAULT_MOCK_PARKING_LOTS } from "./EventParkingMap";

describe("EventParkingMap Component (#3537)", () => {
  it("renders campus parking map header and designated parking lots", () => {
    render(
      <EventParkingMap
        eventName="University Gala 2026"
        venueName="Gala Ballroom"
        parkingLots={DEFAULT_MOCK_PARKING_LOTS}
      />,
    );

    expect(screen.getByText(/Event Campus Parking Map/i)).toBeInTheDocument();
    expect(screen.getByTestId("parking-map-canvas")).toBeInTheDocument();
    expect(screen.getByText("Lot A - West Campus Garage")).toBeInTheDocument();
  });

  it("displays occupancy status badges and walking distance to venue", () => {
    render(
      <EventParkingMap
        eventName="University Gala 2026"
        venueName="Gala Ballroom"
        parkingLots={DEFAULT_MOCK_PARKING_LOTS}
      />,
    );

    expect(screen.getByText(/Available \(48%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/4 min walk/i)).toBeInTheDocument();
  });

  it("renders 1-click Google Maps and Apple Maps navigation links", () => {
    render(
      <EventParkingMap
        eventName="University Gala 2026"
        venueName="Gala Ballroom"
        parkingLots={DEFAULT_MOCK_PARKING_LOTS}
      />,
    );

    const googleBtn = screen.getByRole("link", { name: /Google Maps/i });
    const appleBtn = screen.getByRole("link", { name: /Apple Maps/i });

    expect(googleBtn).toHaveAttribute("href", expect.stringContaining("google.com/maps/dir"));
    expect(appleBtn).toHaveAttribute("href", expect.stringContaining("maps.apple.com"));
  });
});
