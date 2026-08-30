import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import TrendsForecastingAdmin from "./admin.trends";

// Mock Recharts components to prevent layout engine exceptions in JSDOM
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="chart-area" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

const mockRpc = vi.fn().mockResolvedValue({
  data: [
    {
      tag: "#QuantumComputing",
      current_count: 125,
      velocity: "+212%",
      alert_triggered: true,
      underfunded_club_id: "f1234567-89ab-cdef-0123-456789abcdef",
      underfunded_club_name: "Physics Club",
      underfunded_club_balance: 50.0,
      reallocation_source_club_id: "f9876543-210f-edcb-ba98-76543210fedc",
      reallocation_source_club_name: "Blockchain Club",
      reallocation_source_club_balance: 5000.0,
      recommendation: "RISING TREND: #QuantumComputing is up +212%. Consider budget adjustments.",
    },
    {
      tag: "#Blockchain",
      current_count: 2,
      velocity: "-98%",
      alert_triggered: false,
      underfunded_club_id: "f9876543-210f-edcb-ba98-76543210fedc",
      underfunded_club_name: "Blockchain Club",
      underfunded_club_balance: 5000.0,
      reallocation_source_club_id: "f9876543-210f-edcb-ba98-76543210fedc",
      reallocation_source_club_name: "Blockchain Club",
      reallocation_source_club_balance: 5000.0,
      recommendation: "Stable",
    },
  ],
  error: null,
});

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [
          { week_start: "2026-08-01", count: 1 },
          { week_start: "2026-08-08", count: 4 },
          { week_start: "2026-08-15", count: 13 },
          { week_start: "2026-08-22", count: 40 },
          { week_start: "2026-08-29", count: 125 },
        ],
        error: null,
      }),
    }),
  }),
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "admin-1" } } }),
    },
    rpc: (name: string, args: any) => {
      if (name === "get_trend_forecasting_dashboard") return mockRpc(args);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: { role: "system_admin" }, error: null }),
            }),
          }),
        };
      }
      if (table === "tag_weekly_stats") {
        return mockFrom();
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      };
    },
  }),
}));

describe("TrendsForecastingAdmin Component", () => {
  it("renders trend forecasting dashboard and details for authenticated admin", async () => {
    render(
      <BrowserRouter>
        <TrendsForecastingAdmin />
      </BrowserRouter>,
    );

    // Verify title and main elements are rendered
    await waitFor(() => {
      expect(screen.getByText("Tag Velocity & Budgets.")).toBeInTheDocument();
      expect(screen.getByText("#QuantumComputing")).toBeInTheDocument();
      expect(screen.getByText("#Blockchain")).toBeInTheDocument();
    });

    // Check alert banner content
    expect(screen.getByText("Active Trend Alerts")).toBeInTheDocument();
    expect(
      screen.getByText("RISING TREND: #QuantumComputing is up +212%. Consider budget adjustments."),
    ).toBeInTheDocument();

    // Check Recharts rendering container
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("handles budget reallocation input updates and triggers approval action", async () => {
    const toastSpy = vi.spyOn(await import("sonner"), "toast");

    render(
      <BrowserRouter>
        <TrendsForecastingAdmin />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Approve Reallocation")).toBeInTheDocument();
    });

    // Verify default reallocation amount is correctly loaded and constrained (e.g. 1500)
    const numberInput = screen.getByRole("spinbutton");
    expect(numberInput).toHaveValue(1500);

    // Update the input field value
    fireEvent.change(numberInput, { target: { value: "2000" } });
    expect(numberInput).toHaveValue(2000);

    // Click reallocation approval button
    const approveButton = screen.getByText("Approve Reallocation");
    fireEvent.click(approveButton);

    // Verify success toast gets fired
    expect(toastSpy.success).toHaveBeenCalledWith(
      "Budget proposal submitted! Reallocated $2,000 from Blockchain Club to Physics Club.",
    );
  });
});
