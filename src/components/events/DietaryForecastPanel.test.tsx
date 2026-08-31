// src/components/events/DietaryForecastPanel.test.tsx
// -----------------------------------------------------------------------------
// Component tests for src/components/events/DietaryForecastPanel.tsx
// (Issue #3931 & Issue #4220).
// -----------------------------------------------------------------------------

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DietaryForecastPanel } from "./DietaryForecastPanel";
import type { DietaryForecast } from "@/lib/dietaryForecast";

// Mock Supabase client
const mockSelect = vi.fn().mockReturnValue([]);
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockImplementation(() => {
    return Promise.resolve({ data: mockSelect(), error: null });
  }),
  upsert: vi.fn().mockImplementation((val) => {
    mockUpsert(val);
    return Promise.resolve({ error: null });
  }),
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

const mockUseDietaryForecast = vi.fn();
vi.mock("@/hooks/useDietaryForecast", () => ({
  useDietaryForecast: (...args: unknown[]) => mockUseDietaryForecast(...args),
}));

// Mock CatererTempLoggingService
vi.mock("@/services/catererTempLoggingService", () => {
  return {
    CatererTempLoggingService: {
      fetchContractForEvent: vi.fn().mockResolvedValue({
        id: "contract-1",
        event_id: "e1",
        caterer_name: "Mock Catering Inc",
        caterer_email: "chef@mock.com",
        shipment_status: "PENDING",
        stripe_payment_blocked: false,
      }),
      fetchTempLogs: vi.fn().mockResolvedValue([]),
      uploadTempLogs: vi.fn(),
    },
  };
});

// Mock CatererZkService
vi.mock("@/services/catererZkService", () => {
  return {
    CatererZkService: {
      fetchZkProofs: vi.fn().mockResolvedValue([]),
      submitZkProof: vi.fn().mockResolvedValue({
        success: true,
        proof_id: "proof-123",
        status: "VERIFIED",
      }),
      generateMockZkSnark: vi.fn().mockResolvedValue({
        proof_hash: "zk-snark-groth16-proof-mock-hash",
        total_readings: 5000,
        max_threshold_temp: 40.0,
        is_valid: true,
      }),
    },
  };
});

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
    mockSelect.mockReset().mockReturnValue([]);
    mockUpsert.mockClear();
    mockRpc.mockClear();
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

  it("renders min order inputs and saves constraints on set click", async () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh: vi.fn(),
    });
    mockSelect.mockReturnValue([{ dietary_tag: "vegan", minimum_order_quantity: 10 }]);

    render(<DietaryForecastPanel eventId="e1" />);

    // Verification of pre-filled input value
    const input = await screen.findByTestId("min-order-input-vegan");
    expect((input as HTMLInputElement).value).toBe("10");

    // Modify input and set
    fireEvent.change(input, { target: { value: "25" } });
    fireEvent.click(screen.getByTestId("min-order-save-vegan"));

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith({
        event_id: "e1",
        dietary_tag: "vegan",
        minimum_order_quantity: 25,
      });
    });
  });

  it("renders Yield Optimizer prompt card when RSVPs < min order quantity", async () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh: vi.fn(),
    });
    mockSelect.mockReturnValue([{ dietary_tag: "vegan", minimum_order_quantity: 20 }]); // vegan RSVPs is 15 in makeForecast()

    render(<DietaryForecastPanel eventId="e1" />);

    // Yield Optimizer card should display
    const prompt = await screen.findByTestId("yield-optimizer-prompt-vegan");
    expect(prompt.textContent).toContain("caterer's minimum order requirement of 20");
    expect(prompt.textContent).toContain("5 extra Vegan meals");

    // Click Yes
    mockRpc.mockResolvedValue({
      data: [{ name: "Alice Blue" }, { name: "Bob Green" }],
      error: null,
    });
    fireEvent.click(screen.getByTestId("yield-optimizer-yes-vegan"));

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("assign_excess_dietary_meals", {
        p_event_id: "e1",
        p_dietary_tag: "vegan",
        p_excess_count: 5,
      });
    });

    const successCard = await screen.findByTestId("yield-optimizer-success");
    expect(successCard.textContent).toContain("Alice Blue, Bob Green");
  });

  it("renders Caterer IoT Safety panel when a contract is found", async () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh: vi.fn(),
    });

    render(<DietaryForecastPanel eventId="e1" />);

    // Wait for the caterer panel to render
    const safetySection = await screen.findByTestId("caterer-temp-logging-section");
    expect(safetySection).toBeInTheDocument();
    expect(screen.getByText(/Catering Food Safety & IoT Telemetry/i)).toBeInTheDocument();

    // Verify PENDING state is visible
    expect(screen.getByTestId("status-box-pending")).toBeInTheDocument();
  });

  it("handles zk-SNARK proof generation and verification submissions", async () => {
    mockUseDietaryForecast.mockReturnValue({
      forecast: makeForecast(), isLoading: false, error: null, refresh: vi.fn(),
    });

    // Mock active temperature readings
    const { CatererTempLoggingService } = await import("@/services/catererTempLoggingService");
    const { CatererZkService } = await import("@/services/catererZkService");
    
    vi.mocked(CatererTempLoggingService.fetchTempLogs).mockResolvedValue([
      { id: "log-1", contract_id: "contract-1", temperature_fahrenheit: 38.5, recorded_at: new Date().toISOString() }
    ]);

    render(<DietaryForecastPanel eventId="e1" />);

    // ZK compliance section exists
    const zkSection = await screen.findByTestId("zk-compliance-section");
    expect(zkSection).toBeInTheDocument();

    // Click compile zk-SNARK
    const genBtn = screen.getByTestId("caterer-gen-zk-btn");
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(CatererZkService.generateMockZkSnark).toHaveBeenCalled();
    });

    // Submit button should appear
    const submitBtn = await screen.findByTestId("caterer-submit-zk-btn");
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(CatererZkService.submitZkProof).toHaveBeenCalledWith(
        "contract-1",
        "Lot 123",
        "zk-snark-groth16-proof-mock-hash",
        5000,
        40.00
      );
    });
  });
});
