import React from "react";
import { render, screen } from "@testing-library/react";
import EventGanttPage from "./events.$eventId.gantt";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";

// Mock Supabase
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: "evt-123", title: "Campus Fest 2026", club_id: "club-1" },
        error: null,
      }),
      order: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
  }),
}));

describe("EventGantt Page Route", () => {
  it("renders Gantt Chart title and interface", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/events/evt-123/gantt"]}>
          <Routes>
            <Route path="/events/:eventId/gantt" element={<EventGanttPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Gantt Chart/i)).toBeInTheDocument();
  });
});
