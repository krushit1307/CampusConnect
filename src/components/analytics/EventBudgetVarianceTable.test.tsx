import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventBudgetVarianceTable } from "./EventBudgetVarianceTable";
import * as varianceService from "@/services/eventBudgetVarianceService";

vi.mock("@/services/eventBudgetVarianceService");

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("EventBudgetVarianceTable", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
    vi.mocked(varianceService.formatMoney).mockImplementation(
      (val) => `$${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    );
  });

  const renderComponent = (props: { eventId: string }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <EventBudgetVarianceTable {...props} />
      </QueryClientProvider>,
    );

  it("renders variance report with category breakdown and highlights overspending", async () => {
    vi.mocked(varianceService.getEventBudgetVarianceReport).mockResolvedValue({
      event_id: "evt-gala",
      event_title: "Annual Charity Gala",
      total_estimated: 5000,
      total_actual: 7500,
      total_variance: -2500,
      is_overspent: true,
      categories: [
        {
          category: "Food & Catering",
          estimated: 3000,
          actual: 5000,
          variance: -2000,
          percentage_variance: 66.7,
          is_overspent: true,
        },
        {
          category: "Decorations",
          estimated: 2000,
          actual: 2500,
          variance: -500,
          percentage_variance: 25.0,
          is_overspent: true,
        },
      ],
    });

    renderComponent({ eventId: "evt-gala" });

    expect(await screen.findByText("Budget vs. Actual Variance Report")).toBeInTheDocument();
    expect(screen.getByText("Total Overrun: $2,500.00")).toBeInTheDocument();
    expect(screen.getByText("Food & Catering")).toBeInTheDocument();
    expect(screen.getAllByText("Overspent").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("(+66.7% over)")).toBeInTheDocument();
  });

  it("renders on-track state when actuals remain within budget", async () => {
    vi.mocked(varianceService.getEventBudgetVarianceReport).mockResolvedValue({
      event_id: "evt-tech",
      event_title: "Tech Workshop",
      total_estimated: 2000,
      total_actual: 1500,
      total_variance: 500,
      is_overspent: false,
      categories: [
        {
          category: "Audio/Visual",
          estimated: 2000,
          actual: 1500,
          variance: 500,
          percentage_variance: 0,
          is_overspent: false,
        },
      ],
    });

    renderComponent({ eventId: "evt-tech" });

    expect(await screen.findByText("Under Budget: $500.00")).toBeInTheDocument();
    expect(screen.getByText("Audio/Visual")).toBeInTheDocument();
    expect(screen.getByText("On Track")).toBeInTheDocument();
  });
});
