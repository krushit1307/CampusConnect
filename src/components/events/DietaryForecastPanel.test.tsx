// src/components/events/DietaryForecastPanel.test.tsx
// -----------------------------------------------------------------------------
// Component tests for src/components/events/DietaryForecastPanel.tsx
// (Issue #3931).
// -----------------------------------------------------------------------------

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DietaryForecastPanel } from "./DietaryForecastPanel";
import type { DietaryForecast } from "@/lib/dietaryForecast";

const mockUseDietaryForecast = vi.fn();
vi.mock("@/hooks/useDietaryForecast", () => ({
  useDietaryForecast: (...args: unknown[]) => mockUseDietaryForecast(...args),
}));

function makeForecast(overrides: Partial<DietaryForecast> = {}): DietaryForecast {
  return {
    ok: true,
    event_id: "e1",
    event_title: "Hackathon Banquet",
    venue_capacity: 500,
    total_rsvps: 100,
    current_weight: 1.0,
    historical_weight: 0.0,
    current_breakdown: [],
    historical_breakdown: [],
    blended_forecast: [
      { tag: "none", current_percentage: 60, historical_percentage: 55, blended_percentage: 60, current_count: 60, historical_event_count: 5, forecast_meals: 300 },
      { tag: "vegetarian", current_percentage: 20, historical_percentage: 22, blended_percentage: 20, current_count: 20, historical_event_count: 5, forecast_meals: 100 },
      { tag: "vegan", current_percentage: 15, historical_percentage: 18, blended_percentage: 15, current_count: 15, historical_event_count: 5, forecast_meals: 75 },
    ],
    summary: "Based on current trends, expect to need 300 none meals, 100 vegetarian meals, 75 vegan meals. Give this number to your caterer.",
    ...overrides,
  };
}

describe("DietaryForecastPanel", () => {
  beforeEach(() => {
    mockUseDietaryForecast.mockReset();
  });

  it("renders a loading state initially", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: null, isLoading: true, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-loading")).toBeTruthy();
  });

  it("renders an error state when the RPC fails", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: null, isLoading: false, error: "RPC failed", refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-error")).toBeTruthy();
    expect(screen.getByTestId("dietary-forecast-error").textContent).toContain("RPC failed");
  });

  it("renders an unavailable state when forecast.ok is false", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: { ok: false, error: "No venue capacity" },
      isLoading: false, error: null, refresh: vi.fn(),
    } as any);
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-unavailable")).toBeTruthy();
    expect(screen.getByTestId("dietary-forecast-unavailable").textContent).toContain("No venue capacity");
  });

  it("renders the summary and forecast table on success", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-panel")).toBeTruthy();
    expect(screen.getByTestId("dietary-forecast-summary").textContent).toContain("75 vegan meals");
    expect(screen.getByTestId("dietary-forecast-table")).toBeTruthy();
    expect(screen.getByTestId("forecast-row-vegan")).toBeTruthy();
    expect(screen.getByTestId("forecast-row-vegetarian")).toBeTruthy();
  });

  it("shows High confidence badge when current_weight >= 0.8", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast({ current_weight: 0.9 }),
      isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-confidence").textContent).toContain("High");
  });

  it("shows Medium confidence badge when 0.4 <= current_weight < 0.8", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast({ current_weight: 0.5 }),
      isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-confidence").textContent).toContain("Medium");
  });

  it("shows Low confidence badge + warning when current_weight < 0.4", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast({ current_weight: 0.2, total_rsvps: 10 }),
      isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.getByTestId("dietary-forecast-confidence").textContent).toContain("Low");
    expect(screen.getByTestId("dietary-forecast-low-confidence-warning")).toBeTruthy();
  });

  it("does not show the low-confidence warning when high confidence", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast({ current_weight: 0.9 }),
      isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.queryByTestId("dietary-forecast-low-confidence-warning")).toBeNull();
  });

  it("calls refresh when the refresh button is clicked", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh,
    });
    render(<DietaryForecastPanel eventId="e1" />);
    fireEvent.click(screen.getByTestId("dietary-forecast-refresh"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("renders venue capacity and total RSVPs in the stats grid", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast({ venue_capacity: 500, total_rsvps: 120 }),
      isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    const panel = screen.getByTestId("dietary-forecast-panel");
    expect(panel.textContent).toContain("500");
    expect(panel.textContent).toContain("120");
  });

  it("excludes 'none' tag from the top tags table", () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh: vi.fn(),
    });
    render(<DietaryForecastPanel eventId="e1" />);
    expect(screen.queryByTestId("forecast-row-none")).toBeNull();
    expect(screen.getByTestId("forecast-row-vegan")).toBeTruthy();
  });
});
