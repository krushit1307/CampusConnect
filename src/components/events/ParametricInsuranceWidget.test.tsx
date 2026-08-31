import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParametricInsuranceWidget } from "./ParametricInsuranceWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  return {
    createClient: () => ({
      from: (tableName: string) => ({
        select: () => ({
          eq: () => {
            if (tableName === "parametric_policies") {
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "policy-123",
                      premium_amount: 250,
                      coverage_amount: 5000,
                      status: "active",
                    },
                    error: null,
                  }),
              };
            }
            if (tableName === "oracle_weather_reports") {
              return Promise.resolve({
                data: [
                  {
                    id: "rep-1",
                    oracle_source: "NOAA",
                    precipitation_inches: 1.2,
                    created_at: new Date().toISOString(),
                  },
                ],
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    }),
  };
});

describe("ParametricInsuranceWidget", () => {
  it("renders active policy status and weather reports consensus lists", async () => {
    render(<ParametricInsuranceWidget eventId="e1" />);

    expect(screen.getByTestId("parametric-insurance-widget")).toBeInTheDocument();

    // Verify mock policy details render
    expect(await screen.findByText(/Coverage: \$5000/i)).toBeInTheDocument();
    expect(screen.getByText(/Premium: \$250/i)).toBeInTheDocument();

    // Verify mock NOAA report renders
    expect(await screen.findByText(/1.2 in/i)).toBeInTheDocument();
  });
});
