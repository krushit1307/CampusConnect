import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EventLogisticsChecklist } from "./EventLogisticsChecklist";

// Mock window.open
const mockWrite = vi.fn();
const mockClose = vi.fn();
const mockOpen = vi.fn().mockReturnValue({
  document: {
    write: mockWrite,
    close: mockClose
  }
});
vi.stubGlobal("window", {
  ...global.window,
  open: mockOpen
});

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: (name: string, args: any) => {
      if (name === "aggregate_event_logistics") {
        return Promise.resolve({
          data: {
            total_registered: 18,
            dietary: { Vegan: 15, Halal: 3 },
            accessibility: { "ASL Interpreter": 1, "Wheelchair Access": 2 }
          },
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
      total_registered: 18,
      dietary: { Vegan: 15, Halal: 3 },
      accessibility: { "ASL Interpreter": 1, "Wheelchair Access": 2 }
    },
    isLoading: false
  })
}));

describe("Dynamic Accessibility Needs Aggregator Widget (#3611)", () => {
  it("renders registered RSVPs, dietary counts, and triggers caterer PII-free manifest print exports", async () => {
    render(<EventLogisticsChecklist eventId="event-1" />);

    // Verify Title and Sub-headers
    expect(screen.getByText("Organiser Logistics Manifest")).toBeInTheDocument();
    expect(screen.getByText("Total RSVPs Registered: 18")).toBeInTheDocument();

    // Verify Dietary Requirements list
    expect(screen.getByText("Vegan")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("Halal")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Verify Access Requirements list
    expect(screen.getByText("ASL Interpreter")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Wheelchair Access")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Trigger caterer print export
    const exportBtn = screen.getByRole("button", { name: "Export for Caterer" });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining("Dietary Logistics Manifest"));
      expect(mockWrite).toHaveBeenCalledWith(expect.stringContaining("Total RSVPs Registered: 18"));
    });
  });
});
