import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventTransitSyncWidget } from "./EventTransitSyncWidget";
import { transitScooterService } from "../../services/transitScooterService";

// Mock transitScooterService
vi.mock("../../services/transitScooterService", () => {
  const getAvailableScooters = vi.fn();
  const reserveScooter = vi.fn();
  const getTransitItineraries = vi.fn().mockReturnValue([
    {
      id: "itinerary-hub-1-0",
      name: "Bus 101 Express Line",
      totalMinutes: 20,
      walkingDistanceMiles: 0.25, // short walk
      finalStop: { id: "stop-0", name: "Venue stop", latitude: 30.3567, longitude: 76.3642 },
      legs: [
        {
          id: "leg-0-1",
          mode: "bus",
          routeName: "Line 101",
          departureTime: "12:15 PM",
          arrivalTime: "12:35 PM",
          originName: "Main Quad",
          destinationName: "Venue stop",
          originCoords: { latitude: 30.3, longitude: 76.3 },
          destinationCoords: { latitude: 30.3567, longitude: 76.3642 },
          distanceMiles: 3.2,
          estimatedMinutes: 20,
        },
      ],
    },
    {
      id: "itinerary-hub-2-1",
      name: "Metro Blue Line Connector",
      totalMinutes: 45,
      walkingDistanceMiles: 0.85, // long walk (> 0.5 miles)
      finalStop: { id: "stop-1", name: "Metro stop", latitude: 30.352, longitude: 76.36 },
      legs: [
        {
          id: "leg-1-1",
          mode: "train",
          routeName: "Blue Line",
          departureTime: "12:15 PM",
          arrivalTime: "12:35 PM",
          originName: "Downtown",
          destinationName: "Metro stop",
          originCoords: { latitude: 30.2, longitude: 76.2 },
          destinationCoords: { latitude: 30.352, longitude: 76.36 },
          distanceMiles: 4.7,
          estimatedMinutes: 20,
        },
      ],
    },
  ]);

  return {
    transitScooterService: {
      getAvailableScooters,
      reserveScooter,
    },
    getTransitItineraries,
    CAMPUS_TRANSIT_HUBS: [
      {
        id: "hub-1",
        name: "University Main Quad Transit Center",
        latitude: 30.3582,
        longitude: 76.3688,
      },
      { id: "hub-2", name: "Downtown Metro Station Hub", latitude: 30.3415, longitude: 76.3524 },
      {
        id: "hub-3",
        name: "East Campus Dorms Bus Terminal",
        latitude: 30.3621,
        longitude: 76.3812,
      },
    ],
  };
});

describe("EventTransitSyncWidget Component", () => {
  const mockScooters = [
    {
      id: "scooter-lime-1",
      provider: "lime" as const,
      latitude: 30.3521,
      longitude: 76.3601,
      batteryPercent: 85,
      distanceToStopFeet: 45,
      distanceToStopMeters: 13,
      unlockPrice: 1.0,
      pricePerMinute: 0.22,
      deepLink: "lime://ride?id=scooter-lime-1",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    const getScootersMock = transitScooterService.getAvailableScooters as any;
    getScootersMock.mockResolvedValue(mockScooters);

    const reserveScootersMock = transitScooterService.reserveScooter as any;
    reserveScootersMock.mockResolvedValue(true);

    // Mock window.open
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  it("renders widget header and transit hub buttons", () => {
    render(<EventTransitSyncWidget venueLatitude={30.3564} venueLongitude={76.3647} />);

    expect(screen.getByText(/Transit Sync & Last-Mile Mobility/i)).toBeInTheDocument();
    expect(screen.getByText(/University Main Quad/i)).toBeInTheDocument();
    expect(screen.getByText(/Downtown Metro/i)).toBeInTheDocument();
  });

  it("toggles walking distance warning badges based on distance threshold", async () => {
    render(<EventTransitSyncWidget venueLatitude={30.3564} venueLongitude={76.3647} />);

    // First hub has a short walking distance of 0.25 miles
    expect(screen.getByText("Short Walk: 0.25 mi")).toBeInTheDocument();

    // Click second hub button to trigger 0.85 miles walking route
    const secondHubBtn = screen.getByText("Downtown Metro Station");
    fireEvent.click(secondHubBtn);

    await waitFor(() => {
      expect(screen.getByText("Long Walk: 0.85 mi")).toBeInTheDocument();
    });
  });

  it("shows micro-mobility e-scooters list only when walking distance is long", async () => {
    const { rerender } = render(
      <EventTransitSyncWidget venueLatitude={30.3564} venueLongitude={76.3647} />,
    );

    // Short walk: e-scooters should not render
    expect(screen.queryByText(/Available last-mile E-scooters/i)).not.toBeInTheDocument();

    // Switch to long walk hub (Downtown Hub)
    const secondHubBtn = screen.getByText("Downtown Metro Station");
    fireEvent.click(secondHubBtn);

    // Wait for the scooters list header to render
    await waitFor(() => {
      expect(screen.getByText(/Available last-mile E-scooters/i)).toBeInTheDocument();
    });

    // Check scooter cards info
    expect(screen.getByText("45 ft away")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("opens slider configuration settings panel", () => {
    render(<EventTransitSyncWidget venueLatitude={30.3564} venueLongitude={76.3647} />);

    const configBtn = screen.getByTitle("Configure Range and Battery Settings");
    fireEvent.click(configBtn);

    expect(screen.getByText("Max Scooter Radius:")).toBeInTheDocument();
    expect(screen.getByText("Min Scooter Battery:")).toBeInTheDocument();
  });

  it("locks scooter reservation and triggers external deep links", async () => {
    render(<EventTransitSyncWidget venueLatitude={30.3564} venueLongitude={76.3647} />);

    // Switch to long walk hub to show e-scooters
    const secondHubBtn = screen.getByText("Downtown Metro Station");
    fireEvent.click(secondHubBtn);

    await waitFor(() => {
      expect(screen.getByText(/Available last-mile E-scooters/i)).toBeInTheDocument();
    });

    const reserveBtn = screen.getByRole("button", { name: /Reserve/i });
    fireEvent.click(reserveBtn);

    await waitFor(() => {
      expect(transitScooterService.reserveScooter).toHaveBeenCalledWith("scooter-lime-1", "lime");
      expect(window.open).toHaveBeenCalledWith("lime://ride?id=scooter-lime-1", "_blank");
      expect(screen.getByRole("button", { name: /Reserved/i })).toBeDisabled();
    });
  });

  it("filters and sorts the e-scooter list according to user selections", async () => {
    const getScootersMock = transitScooterService.getAvailableScooters as any;
    getScootersMock.mockResolvedValue([
      {
        id: "scooter-lime-1",
        provider: "lime",
        latitude: 30.3521,
        longitude: 76.3601,
        batteryPercent: 85,
        distanceToStopFeet: 45,
        distanceToStopMeters: 13,
        unlockPrice: 1.0,
        pricePerMinute: 0.22,
        deepLink: "lime://ride?id=scooter-lime-1",
      },
      {
        id: "scooter-bird-2",
        provider: "bird",
        latitude: 30.3522,
        longitude: 76.3602,
        batteryPercent: 50,
        distanceToStopFeet: 15,
        distanceToStopMeters: 4,
        unlockPrice: 1.25,
        pricePerMinute: 0.25,
        deepLink: "bird://ride?id=scooter-bird-2",
      },
      {
        id: "scooter-spin-3",
        provider: "spin",
        latitude: 30.3523,
        longitude: 76.3603,
        batteryPercent: 95,
        distanceToStopFeet: 120,
        distanceToStopMeters: 36,
        unlockPrice: 0.99,
        pricePerMinute: 0.19,
        deepLink: "spin://ride?id=scooter-spin-3",
      },
    ]);

    render(<EventTransitSyncWidget venueLatitude={30.3564} venueLongitude={76.3647} />);

    // Switch to long walk hub (Downtown Hub)
    const secondHubBtn = screen.getByText("Downtown Metro Station");
    fireEvent.click(secondHubBtn);

    await waitFor(() => {
      expect(screen.getByText(/Available last-mile E-scooters/i)).toBeInTheDocument();
    });

    // Verify all 3 scooters are rendered
    expect(screen.getByText("15 ft away")).toBeInTheDocument();
    expect(screen.getByText("45 ft away")).toBeInTheDocument();
    expect(screen.getByText("120 ft away")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    const providerSelect = selects[0];
    const sortSelect = selects[1];

    // Filter by Bird Only
    fireEvent.change(providerSelect, { target: { value: "bird" } });
    expect(screen.queryByText("45 ft away")).not.toBeInTheDocument();
    expect(screen.getByText("15 ft away")).toBeInTheDocument();

    // Reset filter
    fireEvent.change(providerSelect, { target: { value: "all" } });

    // Sort by Battery
    fireEvent.change(sortSelect, { target: { value: "battery" } });
    expect(screen.getByText("95%")).toBeInTheDocument();
  });
});
