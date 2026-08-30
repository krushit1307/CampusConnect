import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CampusMapBuilder from "./events.$eventId.map-builder";
import { useMapBuilderStore } from "@/stores/mapBuilderStore";
import { ThemeProvider } from "@/components/theme-provider";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => {
  const mockFrom = (table: string) => {
    if (table === "events") {
      return {
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({
                data: { title: "Engineering Career Fair" },
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "venue_maps") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: { id: "map-123", background_image_url: null },
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === "map_nodes") {
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: [
                {
                  id: "table-1",
                  entity_name: "TABLE #1",
                  type: "table",
                  x_coord: 5,
                  y_coord: 13.333333333333334,
                  width: 10,
                  height: 10,
                  rotation: 0,
                },
              ],
              error: null,
            }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    };
  };

  return {
    createClient: () => ({
      from: mockFrom,
    }),
  };
});

// Mock SiteShell to avoid rendering Navbar, Footers, and other complex layout hooks in layout unit tests
vi.mock("@/components/site/SiteShell", () => ({
  SiteShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-site-shell">{children}</div>
  ),
}));

describe("CampusMapBuilder Component", () => {
  beforeEach(() => {
    useMapBuilderStore.setState({
      elements: [],
      selectedElementId: null,
    });
  });

  it("renders elements palette and handles item loading from db", async () => {
    render(
      <MemoryRouter initialEntries={["/events/event-123/builder"]}>
        <Routes>
          <Route path="/events/:eventId/builder" element={<CampusMapBuilder />} />
        </Routes>
      </MemoryRouter>,
    );

    // Initial loader
    expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument();

    // Palette items
    expect(await screen.findByText("Elements Palette")).toBeInTheDocument();
    expect(screen.getByText("Table / Booth")).toBeInTheDocument();
    expect(screen.getByText("Main Stage")).toBeInTheDocument();
    expect(screen.getByText("Boundary / Wall")).toBeInTheDocument();
  });

  it("allows selecting and deleting elements", async () => {
    // Inject mock state
    useMapBuilderStore.setState({
      elements: [
        {
          id: "table-1",
          type: "table",
          x: 40,
          y: 80,
          width: 80,
          height: 60,
          rotation: 0,
          label: "TABLE #1",
        },
      ],
      selectedElementId: null,
    });

    render(
      <MemoryRouter initialEntries={["/events/event-123/builder"]}>
        <Routes>
          <Route path="/events/:eventId/builder" element={<CampusMapBuilder />} />
        </Routes>
      </MemoryRouter>,
    );

    const tableElement = await screen.findByTestId("canvas-element-table-1");
    expect(tableElement).toBeInTheDocument();

    // Select the table element with act to flush Zustand/React updates
    await act(async () => {
      fireEvent.click(tableElement);
    });

    // Tools for active item should display
    await waitFor(() => {
      expect(screen.getByText(/Selection Tools/i)).toBeInTheDocument();
    });
    const deleteButton = screen.getByRole("button", { name: /Delete/i });
    expect(deleteButton).toBeInTheDocument();

    // Delete item
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(screen.queryByText("TABLE #1")).not.toBeInTheDocument();
    });
  });

  it("shows VIP configuration tools and dropdown for VIP tables", async () => {
    // We just render the normal mock map which has 'table-1'
    render(
      <MemoryRouter initialEntries={["/events/event-123/builder"]}>
        <Routes>
          <Route path="/events/:eventId/builder" element={<CampusMapBuilder />} />
        </Routes>
      </MemoryRouter>,
    );

    const tableElement = await screen.findByTestId("canvas-element-table-1");
    expect(tableElement).toBeInTheDocument();

    // Select the table
    await act(async () => {
      fireEvent.click(tableElement);
    });

    // Check if the dropdown for Required VIP Ticket is shown
    await waitFor(() => {
      expect(screen.getByText("Required VIP Ticket:")).toBeInTheDocument();
    });
  });
});
