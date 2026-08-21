import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import MentorshipDashboard from "./mentorship-dashboard";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string) => {
      if (name === "get_mentorship_cohort_analysis") {
        return Promise.resolve({
          data: [
            {
              mentee_count: 10,
              non_mentee_count: 100,
              mentee_avg_points_delta: 300.0,
              non_mentee_avg_points_delta: 150.0,
              mentee_avg_events_organized: 4.0,
              non_mentee_avg_events_organized: 2.0,
              mentee_exec_role_ratio: 40.0,
              non_mentee_exec_role_ratio: 20.0,
              lift_percentage: 100.0
            }
          ],
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    }
  })
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: () => ({
    data: {
      mentee_count: 10,
      non_mentee_count: 100,
      mentee_avg_points_delta: 300.0,
      non_mentee_avg_points_delta: 150.0,
      mentee_avg_events_organized: 4.0,
      non_mentee_avg_events_organized: 2.0,
      mentee_exec_role_ratio: 40.0,
      non_mentee_exec_role_ratio: 20.0,
      lift_percentage: 100.0
    },
    isLoading: false
  })
}));

// Mock ResponsiveContainer to bypass Recharts dimensions check in tests
vi.mock("recharts", () => {
  const original = vi.importActual("recharts");
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children }: any) => <div>{children}</div>,
    Bar: () => <div />,
    LineChart: ({ children }: any) => <div>{children}</div>,
    Line: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    Legend: () => <div />
  };
});

describe("Dynamic Mentorship Impact Tracking Dashboard UI (#3608)", () => {
  it("renders cohort metrics, leadership rates and lift ratios", async () => {
    render(
      <BrowserRouter>
        <MentorshipDashboard />
      </BrowserRouter>
    );

    // Verify Title and Sub-headers
    expect(screen.getByText("Mentorship Program ROI Dashboard")).toBeInTheDocument();

    // Verify cohort stats are present
    expect(screen.getByText("10")).toBeInTheDocument(); // Mentees count
    expect(screen.getByText("100")).toBeInTheDocument(); // Control group count
    expect(screen.getByText("+300")).toBeInTheDocument(); // Mentee avg points delta

    // Verify key headline lift percentage
    expect(screen.getByText(/Students with mentors are 100% more likely to become club executives/)).toBeInTheDocument();
  });
});
