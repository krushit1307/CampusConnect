import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Wrapped2026 from "./wrapped.2026";

// Mock Supabase
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } })
    },
    rpc: (name: string, args: any) => {
      if (name === "get_yearly_wrapped") {
        return Promise.resolve({
          data: {
            total_events_attended: 45,
            total_hours_spent: 120,
            top_tag: "Tech",
            gamification_percentile: 5,
            top_events: [
              { title: "Hackathon 2026", cover_image_url: "https://hack.jpg" },
              { title: "Film Fest 2026", cover_image_url: "https://film.jpg" },
              { title: "Gala Night", cover_image_url: "" }
            ]
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
      total_events_attended: 45,
      total_hours_spent: 120,
      top_tag: "Tech",
      gamification_percentile: 5,
      top_events: [
        { title: "Hackathon 2026", cover_image_url: "https://hack.jpg" },
        { title: "Film Fest 2026", cover_image_url: "https://film.jpg" },
        { title: "Gala Night", cover_image_url: "" }
      ]
    },
    isLoading: false
  })
}));

describe("Automated 'Year in Review' Personalized Web-Story UI (#3552)", () => {
  it("renders story intro slide, navigates slides, and triggers Story Share", async () => {
    // Mock navigator.share
    const shareMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "share", {
      value: shareMock,
      configurable: true,
      writable: true
    });

    render(
      <BrowserRouter>
        <Wrapped2026 />
      </BrowserRouter>
    );

    // Slide 0: Intro
    expect(await screen.findByText("Your 2026 Wrapped")).toBeInTheDocument();

    // Click Next -> Slide 1: Events Count
    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);
    expect(await screen.findByText("45 Events")).toBeInTheDocument();

    // Click Next -> Slide 2: Hours Spent
    fireEvent.click(nextBtn);
    expect(await screen.findByText("120 Hours")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();

    // Click Next -> Slide 3: Leaderboard Percentile
    fireEvent.click(nextBtn);
    expect(await screen.findByText("Top 5%")).toBeInTheDocument();

    // Click Next -> Slide 4: Summary & Share
    fireEvent.click(nextBtn);
    expect(await screen.findByText("2026 Campus Story")).toBeInTheDocument();

    // Click Share to Stories
    const shareBtn = screen.getByRole("button", { name: "Share to Stories" });
    fireEvent.click(shareBtn);

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalled();
    });
  });
});
