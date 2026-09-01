import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DonorChurnDashboard } from "./DonorChurnDashboard";
import { useDonorChurn } from "@/hooks/useDonorChurn";
import { toast } from "sonner";

vi.mock("@/hooks/useDonorChurn");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockUseDonorChurn = useDonorChurn as unknown as ReturnType<typeof vi.fn>;

describe("DonorChurnDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays loading state", () => {
    mockUseDonorChurn.mockReturnValue({ isLoading: true });
    render(<DonorChurnDashboard clubId="club-1" />);
    // lucide-react loader usually has a specific class, or we can just check if table is absent
    expect(screen.queryByText(/Predictive Churn Modeler/i)).not.toBeInTheDocument();
  });

  it("displays error state", () => {
    mockUseDonorChurn.mockReturnValue({
      isLoading: false,
      error: "Failed to connect to database",
    });
    render(<DonorChurnDashboard clubId="club-1" />);
    expect(screen.getByText(/Error loading predictions/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to connect to database/i)).toBeInTheDocument();
  });

  it("displays empty state when no predictions", () => {
    mockUseDonorChurn.mockReturnValue({
      isLoading: false,
      predictions: [],
      runChurnModeler: vi.fn(),
    });
    render(<DonorChurnDashboard clubId="club-1" />);
    expect(screen.getByText(/No donor data available/i)).toBeInTheDocument();
  });

  it("renders predictions correctly and flags high risk", () => {
    const mockPredictions = [
      {
        id: "1",
        user_id: "u1",
        risk_level: "critical",
        risk_score: 95,
        velocity_change_pct: -85,
        baseline_velocity: 40,
        current_velocity: 6,
        is_high_value_donor: true,
        total_donation_volume_cents: 60000,
        contributing_factors: ["rsvp", "donation"],
        profiles: { full_name: "Alice Donor" },
      },
      {
        id: "2",
        user_id: "u2",
        risk_level: "low",
        risk_score: 10,
        velocity_change_pct: -15,
        baseline_velocity: 20,
        current_velocity: 17,
        is_high_value_donor: false,
        total_donation_volume_cents: 5000,
        contributing_factors: ["login"],
        profiles: { full_name: "Bob Donor" },
      },
    ];

    mockUseDonorChurn.mockReturnValue({
      isLoading: false,
      predictions: mockPredictions,
      runChurnModeler: vi.fn(),
    });

    render(<DonorChurnDashboard clubId="club-1" />);

    // Check Attention Required banner
    expect(screen.getByText(/1 high-value donor\(s\) have been flagged/i)).toBeInTheDocument();

    // Check Table
    expect(screen.getByText("Alice Donor")).toBeInTheDocument();
    expect(screen.getByText("Bob Donor")).toBeInTheDocument();

    // High value badge
    expect(screen.getByText("High Value")).toBeInTheDocument();

    // Formatted money
    expect(screen.getByText("$600.00")).toBeInTheDocument();
    expect(screen.getByText("$50.00")).toBeInTheDocument();

    // Factors
    expect(screen.getByText("rsvp")).toBeInTheDocument();
    expect(screen.getByText("donation")).toBeInTheDocument();
    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("handles running the modeler successfully", async () => {
    const runMock = vi.fn().mockResolvedValue(2);
    mockUseDonorChurn.mockReturnValue({
      isLoading: false,
      isRefreshing: false,
      predictions: [],
      runChurnModeler: runMock,
    });

    render(<DonorChurnDashboard clubId="club-1" />);

    const btn = screen.getByRole("button", { name: /Run Analysis/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(runMock).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Successfully analyzed 2 donors.");
    });
  });

  it("handles running the modeler failure", async () => {
    const runMock = vi.fn().mockRejectedValue(new Error("Network error"));
    mockUseDonorChurn.mockReturnValue({
      isLoading: false,
      isRefreshing: false,
      predictions: [],
      runChurnModeler: runMock,
    });

    render(<DonorChurnDashboard clubId="club-1" />);

    const btn = screen.getByRole("button", { name: /Run Analysis/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(runMock).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Network error");
    });
  });
});
