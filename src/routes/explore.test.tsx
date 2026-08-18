import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import ExploreShowcase from "./explore";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({
            data: [
              {
                id: "event-showcase-1",
                title: "Spring Carnival",
                description: "Vibrant campus carnival with games and rides!",
                start_time: "2026-08-17T12:00:00Z",
                location: "Main Quad",
                clubs: { name: "Student Union" },
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

// Mock React Query
vi.mock("@/hooks/useReactQueryReplacement", () => ({
  useQuery: () => ({
    data: [
      {
        id: "event-showcase-1",
        title: "Spring Carnival",
        description: "Vibrant campus carnival with games and rides!",
        start_time: "2026-08-17T12:00:00Z",
        location: "Main Quad",
        clubs: { name: "Student Union" },
      },
    ],
    isLoading: false,
  }),
}));

describe("Interactive Campus Tour Integration UI (#3456)", () => {
  it("renders explore page listing public events and triggers admission dialog upon guest RSVPs", async () => {
    render(
      <BrowserRouter>
        <ExploreShowcase />
      </BrowserRouter>
    );

    // Verify banner and page title render
    expect(await screen.findByText("Public Event Showcase")).toBeInTheDocument();
    // Verify mock event title renders
    expect(screen.getByText("Spring Carnival")).toBeInTheDocument();
    expect(screen.getByText("Main Quad")).toBeInTheDocument();

    // Click RSVP button
    const rsvpBtn = screen.getByRole("button", { name: "RSVP to Event" });
    fireEvent.click(rsvpBtn);

    // Wait for the modal dialog to be rendered
    await waitFor(() => {
      expect(screen.getByText("Student Account Required 🔒")).toBeInTheDocument();
      expect(
        screen.getByText(/You must be an enrolled student to RSVP. Apply to the University today/)
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Apply to the University Today" })).toBeInTheDocument();
    });
  });
});
