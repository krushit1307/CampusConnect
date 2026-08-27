import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RecapPage from "./recap";
import { MemoryRouter } from "react-router-dom";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-123" } } }),
    },
    rpc: (name: string, args: any) => {
      if (name === "generate_yearly_recap") {
        if (args.user_id === "user-123") {
          return Promise.resolve({
            data: {
              total_events_attended: 12,
              top_category: "Tech",
              top_category_count: 5,
              most_visited_club: "Coding Club",
              total_comments_posted: 8,
              busiest_month: "October",
              user_percentile: 5,
            },
            error: null,
          });
        }
      }
      return Promise.resolve({ data: null, error: new Error("Not found") });
    },
  }),
}));

describe("RecapPage Stories Component", () => {
  it("renders loading screen initially", () => {
    render(
      <MemoryRouter>
        <RecapPage />
      </MemoryRouter>,
    );
    expect(screen.getByText(/aggregating your year/i)).toBeInTheDocument();
  });

  it("renders active recap stories after loading", async () => {
    render(
      <MemoryRouter>
        <RecapPage />
      </MemoryRouter>,
    );

    // Slide 0: Title Slide
    const titleText = await screen.findByText(/your year in review/i);
    expect(titleText).toBeInTheDocument();
    expect(screen.getByText(/EDITION/i)).toBeInTheDocument();

    // Advance manually to Slide 1
    const nextBtn = screen.getByLabelText(/next slide/i);
    fireEvent.click(nextBtn);

    // Slide 1: Events Attended
    const eventsText = await screen.findByText(/you checked in to/i);
    expect(eventsText).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();

    // Advance manually to Slide 2
    fireEvent.click(nextBtn);

    // Slide 2: Top Category
    const categoryText = await screen.findByText(/your favorite focus was/i);
    expect(categoryText).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();

    // Advance manually to Slide 3
    fireEvent.click(nextBtn);

    // Slide 3: Top Club
    const clubText = await screen.findByText(/most visited community/i);
    expect(clubText).toBeInTheDocument();
    expect(screen.getByText("Coding Club")).toBeInTheDocument();

    // Advance manually to Slide 4
    fireEvent.click(nextBtn);

    // Slide 4: Social Stats
    const socialText = await screen.findByText(/your voice was heard/i);
    expect(socialText).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();

    // Advance manually to Slide 5
    fireEvent.click(nextBtn);

    // Slide 5: Share Screen
    const leaderText = await screen.findByText(/leader status/i);
    expect(leaderText).toBeInTheDocument();
    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /share wrapped/i })).toBeInTheDocument();
  });
});
