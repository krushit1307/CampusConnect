import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ClubPhishingSimulationDashboard } from "../ClubPhishingSimulationDashboard";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
}));

describe("ClubPhishingSimulationDashboard Component", () => {
  it("renders dashboard title and executive security metrics", () => {
    render(<ClubPhishingSimulationDashboard />);

    expect(screen.getByText("Club Leadership Mandatory Phishing Simulation")).toBeInTheDocument();
    expect(screen.getByText("Total Officers Screened")).toBeInTheDocument();
    expect(screen.getByText("Robotics Society Pass Rate")).toBeInTheDocument();
    expect(screen.getByText("Investment Fund Pass Rate")).toBeInTheDocument();
  });

  it("renders officer roster with executive names", () => {
    render(<ClubPhishingSimulationDashboard />);

    expect(screen.getByTestId("roster-tab")).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Samantha Chen")).toBeInTheDocument();
  });

  it("switches tabs when tab navigation buttons are clicked", () => {
    render(<ClubPhishingSimulationDashboard />);

    const templatesTabBtn = screen.getByRole("button", { name: /Phishing Scenario Templates/i });
    fireEvent.click(templatesTabBtn);

    expect(screen.getByTestId("templates-tab")).toBeInTheDocument();
    expect(screen.getByText(/Final Notice: Student Government Grant Wire Confirmation Needed/i)).toBeInTheDocument();

    const summaryTabBtn = screen.getByRole("button", { name: /Student Union Compliance Overview/i });
    fireEvent.click(summaryTabBtn);

    expect(screen.getByTestId("summary-tab")).toBeInTheDocument();
    expect(screen.getByText("Campus Robotics Society")).toBeInTheDocument();
  });

  it("completes retraining flow when retraining modal action is confirmed", async () => {
    render(<ClubPhishingSimulationDashboard />);

    const retrainingBtns = screen.getAllByRole("button", { name: /Complete Retraining/i });
    expect(retrainingBtns.length).toBeGreaterThan(0);
    fireEvent.click(retrainingBtns[0]);

    expect(screen.getByText("Mandatory Security Retraining")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("complete-retraining-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/Retraining completed/i)).toBeInTheDocument();
    });
  });
});
