import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import DJBoothDashboard from "../dj.dashboard";
import { useLiveDjRequests } from "@/hooks/useLiveDjRequests";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ eventId: "dance-party-123" }),
}));

vi.mock("@/hooks/useLiveDjRequests", () => ({
  useLiveDjRequests: vi.fn(),
}));

describe("DJ Booth iPad Dashboard (#3462)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when queue has no active song requests", () => {
    (useLiveDjRequests as any).mockReturnValue({
      requests: [],
      isLoading: false,
      dismissRequest: vi.fn(),
    });

    render(<DJBoothDashboard />);

    expect(screen.getByText("DJ Booth Live Queue")).toBeInTheDocument();
    expect(screen.getByText("DJ Queue is Clean!")).toBeInTheDocument();
  });

  it("renders crowd song requests sorted dynamically by upvotes with rank badges", () => {
    const mockRequests = [
      {
        id: "req-1",
        event_id: "dance-party-123",
        user_id: "user-1",
        song_title: "Levitating",
        artist: "Dua Lipa",
        album_art_url: "https://example.com/art.jpg",
        upvotes: 15,
        played: false,
      },
      {
        id: "req-2",
        event_id: "dance-party-123",
        user_id: "user-2",
        song_title: "Blinding Lights",
        artist: "The Weeknd",
        album_art_url: "https://example.com/art2.jpg",
        upvotes: 8,
        played: false,
      },
    ];

    (useLiveDjRequests as any).mockReturnValue({
      requests: mockRequests,
      isLoading: false,
      dismissRequest: vi.fn(),
    });

    render(<DJBoothDashboard />);

    expect(screen.getByText("Levitating")).toBeInTheDocument();
    expect(screen.getByText("#1 Most Requested")).toBeInTheDocument();
    expect(screen.getByText("15 upvotes")).toBeInTheDocument();

    expect(screen.getByText("Blinding Lights")).toBeInTheDocument();
    expect(screen.getByText("8 upvotes")).toBeInTheDocument();
  });

  it("triggers dismiss action when DJ clicks played/dismiss button", async () => {
    const mockDismiss = vi.fn().mockResolvedValue(true);
    const mockRequests = [
      {
        id: "req-1",
        event_id: "dance-party-123",
        user_id: "user-1",
        song_title: "Levitating",
        artist: "Dua Lipa",
        upvotes: 15,
        played: false,
      },
    ];

    (useLiveDjRequests as any).mockReturnValue({
      requests: mockRequests,
      isLoading: false,
      dismissRequest: mockDismiss,
    });

    render(<DJBoothDashboard />);

    const dismissBtn = screen.getByTestId("dismiss-btn-req-1");
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(mockDismiss).toHaveBeenCalledWith("req-1");
    });
  });
});
