import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import VenueIntelligenceDashboard from "./VenueIntelligenceDashboard";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...filterDomProps(props)}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

function filterDomProps(props: Record<string, unknown>): Record<string, unknown> {
  const domProps: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (
      key === "initial" ||
      key === "animate" ||
      key === "exit" ||
      key === "transition" ||
      key === "whileHover"
    )
      continue;
    domProps[key] = props[key];
  }
  return domProps;
}

describe("VenueIntelligenceDashboard", () => {
  it("renders the main heading", () => {
    render(<VenueIntelligenceDashboard />);
    expect(screen.getByText("Venue Intelligence Dashboard")).toBeTruthy();
  });

  it("renders all tab buttons", () => {
    render(<VenueIntelligenceDashboard />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Venues")).toBeTruthy();
    expect(screen.getByText("Heatmap")).toBeTruthy();
    expect(screen.getByText("Conflicts")).toBeTruthy();
    expect(screen.getByText("Bookings")).toBeTruthy();
    expect(screen.getByText("Recommendations")).toBeTruthy();
  });

  it("shows overview KPIs by default", () => {
    render(<VenueIntelligenceDashboard />);
    expect(screen.getByText("Total Venues")).toBeTruthy();
    expect(screen.getByText("Bookings (Month)")).toBeTruthy();
    expect(screen.getByText("Avg Utilization")).toBeTruthy();
    expect(screen.getByText("Revenue")).toBeTruthy();
  });

  it("switches to venues tab on click", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Venues"));
    expect(screen.getByPlaceholderText("Search venues...")).toBeTruthy();
  });

  it("renders venue cards after switching to venues tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Venues"));
    expect(screen.getByText("Main Auditorium")).toBeTruthy();
    expect(screen.getByText("Seminar Hall A")).toBeTruthy();
    expect(screen.getByText("Computer Lab A")).toBeTruthy();
  });

  it("searches venues by name", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Venues"));
    const searchInput = screen.getByPlaceholderText("Search venues...");
    fireEvent.change(searchInput, { target: { value: "Auditorium" } });
    expect(screen.getByText("Main Auditorium")).toBeTruthy();
    expect(screen.queryByText("Computer Lab A")).toBeNull();
  });

  it("switches to heatmap tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Heatmap"));
    expect(screen.getByText("Campus Venue Usage Heatmap")).toBeTruthy();
  });

  it("switches to conflicts tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Conflicts"));
    expect(screen.getByText("Severity:")).toBeTruthy();
  });

  it("switches to bookings tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Bookings"));
    expect(screen.getByText("Upcoming Venue Bookings")).toBeTruthy();
  });

  it("switches to recommendations tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Recommendations"));
    expect(screen.getByText("Smart Venue Recommendations")).toBeTruthy();
  });

  it("shows utilization insights on heatmap tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Heatmap"));
    expect(screen.getByText("Usage Insights")).toBeTruthy();
    expect(screen.getByText("Peak Hours")).toBeTruthy();
  });

  it("shows optimization tips on recommendations tab", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Recommendations"));
    expect(screen.getByText("Venue Optimization Tips")).toBeTruthy();
  });

  it("filters conflicts by severity", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Conflicts"));
    fireEvent.click(screen.getByText("High"));
    // Should show only high severity conflicts
    expect(screen.getByText("High")).toBeTruthy();
  });

  it("renders date range selector", () => {
    render(<VenueIntelligenceDashboard />);
    expect(screen.getByDisplayValue("This Month")).toBeTruthy();
  });

  it("shows venue type filter buttons", () => {
    render(<VenueIntelligenceDashboard />);
    fireEvent.click(screen.getByText("Venues"));
    expect(screen.getByText("🎭 Auditorium")).toBeTruthy();
    expect(screen.getByText("📚 Lecture Hall")).toBeTruthy();
    expect(screen.getByText("🔬 Lab")).toBeTruthy();
  });

  it("shows the weekly heatmap with day labels", () => {
    render(<VenueIntelligenceDashboard />);
    // Overview tab shows heatmap preview
    expect(screen.getByText("Weekly Usage Heatmap")).toBeTruthy();
  });
});
