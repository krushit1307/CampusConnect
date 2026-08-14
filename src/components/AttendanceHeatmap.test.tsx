import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AttendanceHeatmap, formatToLocalYYYYMMDD, getSquareColorClass } from "./AttendanceHeatmap";

// Mock Tooltip UI component to avoid Radix UI Portal / ResizeObserver requirements in unit test environment
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Supabase client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: (table: string) => {
      mockFrom(table);
      return {
        select: (query: string) => {
          mockSelect(query);
          return {
            eq: (column: string, val: string) => {
              mockEq(column, val);
              return {
                gte: (col: string, minDate: string) => {
                  mockGte(col, minDate);
                  return Promise.resolve({
                    data: [
                      {
                        id: "rsvp-1",
                        created_at: "2024-10-15T00:00:00Z",
                        rsvp_at: "2024-10-15T00:00:00Z",
                        events: { id: "event-1", event_date: "2024-10-15T00:00:00Z" },
                      },
                      {
                        id: "rsvp-2",
                        created_at: "2024-10-15T12:00:00Z",
                        rsvp_at: "2024-10-15T12:00:00Z",
                        events: { id: "event-1", event_date: "2024-10-15T00:00:00Z" },
                      },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  }),
}));

describe("AttendanceHeatmap Utility Functions", () => {
  it("formatToLocalYYYYMMDD correctly parses UTC midnight ISO strings without shifting date", () => {
    expect(formatToLocalYYYYMMDD("2024-10-15T00:00:00Z")).toBe("2024-10-15");
    expect(formatToLocalYYYYMMDD("2024-10-15T00:00:00.000Z")).toBe("2024-10-15");
    expect(formatToLocalYYYYMMDD("2024-10-15")).toBe("2024-10-15");
  });

  it("formatToLocalYYYYMMDD returns empty string for invalid or null date inputs", () => {
    expect(formatToLocalYYYYMMDD(null)).toBe("");
    expect(formatToLocalYYYYMMDD(undefined)).toBe("");
    expect(formatToLocalYYYYMMDD("invalid-date")).toBe("");
  });

  it("getSquareColorClass assigns correct CSS background classes based on count level", () => {
    expect(getSquareColorClass(0)).toContain("bg-gray-100");
    expect(getSquareColorClass(1)).toContain("bg-green-200");
    expect(getSquareColorClass(3)).toContain("bg-green-400");
    expect(getSquareColorClass(5)).toContain("bg-green-600");
    expect(getSquareColorClass(8)).toContain("bg-green-800");
  });
});

describe("AttendanceHeatmap Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state initially and then displays heatmap once data is fetched", async () => {
    render(<AttendanceHeatmap userId="user-123" />);

    expect(screen.getByText(/Loading attendance heatmap/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Attendance Heatmap")).toBeInTheDocument();
    });

    expect(screen.getByText(/attended in the last 365 days/i)).toBeInTheDocument();
    expect(screen.getByText("Less")).toBeInTheDocument();
    expect(screen.getByText("More")).toBeInTheDocument();
  });
});
