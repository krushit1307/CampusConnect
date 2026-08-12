import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CampusMapBuilder from "./events.$eventId.map-builder";
import { useMapBuilderStore } from "@/stores/mapBuilderStore";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: {
                title: "Engineering Career Fair",
                map_layout: [
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
              },
              error: null,
            }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
  }),
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

    const tableElement = await screen.findByText("TABLE #1");
    expect(tableElement).toBeInTheDocument();

    // Select the table element
    fireEvent.click(tableElement);

    // Tools for active item should display
    expect(screen.getByText("Selection Tools")).toBeInTheDocument();
    const deleteButton = screen.getByRole("button", { name: /Delete/i });
    expect(deleteButton).toBeInTheDocument();

    // Delete item
    fireEvent.click(deleteButton);
    expect(screen.queryByText("TABLE #1")).not.toBeInTheDocument();
  });
});
