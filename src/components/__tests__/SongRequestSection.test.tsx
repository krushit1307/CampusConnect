import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SongRequestSection } from "../events/SongRequestSection";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUser = { id: "user-123", email: "student@test.edu" };

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
  },
  from: vi.fn().mockImplementation((table: string) => {
    const mockQuery: any = {
      select: vi.fn().mockImplementation((columns: string) => {
        return {
          eq: vi.fn().mockImplementation((col: string, val: any) => {
            return {
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "request-1",
                    event_id: "event-123",
                    title: "Levitating",
                    artist: "Dua Lipa",
                    album_art_url: "https://example.com/art.jpg",
                    upvotes: 5,
                    downvotes: 1,
                    played: false,
                    song_upvotes: [{ user_id: "user-123" }],
                    song_downvotes: [],
                  },
                ],
                error: null,
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { event_id: "event-123" },
                error: null,
              }),
            };
          }),
        };
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockImplementation(() => mockQuery),
      eq: vi.fn().mockImplementation(() => mockQuery),
    };
    return mockQuery;
  }),
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockImplementation(function (this: any) {
      return this;
    }),
    subscribe: vi.fn().mockImplementation(function (this: any) {
      return this;
    }),
  }),
  removeChannel: vi.fn().mockResolvedValue(null),
  functions: {
    invoke: vi.fn().mockResolvedValue({ data: { success: true, message: "Synced" }, error: null }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
  getSupabaseUrl: () => "https://mock.supabase.co",
}));

vi.mock("../events/SongSearch", () => ({
  SongSearch: () => <div data-testid="song-search" />,
}));

// Mock window.location.assign
const mockAssign = vi.spyOn(window.location, "assign").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  mockAssign.mockClear();
});

afterEach(() => {
  mockAssign.mockReset();
});

describe("SongRequestSection Collaborative Soundtrack Component", () => {
  it("renders requested songs and upvote/downvote scores", async () => {
    render(<SongRequestSection eventId="event-123" isOrganizer={false} />);

    // Renders header
    expect(await screen.findByText("Collaborative Event Soundtrack")).toBeInTheDocument();

    // Renders track details
    expect(screen.getByText("Levitating")).toBeInTheDocument();
    expect(screen.getByText("Dua Lipa")).toBeInTheDocument();

    // Renders score (upvotes 5 - downvotes 1 = 4)
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("organizer can see Spotify Link or Sync button", async () => {
    render(<SongRequestSection eventId="event-123" isOrganizer={true} />);

    // Spotify linked tag is shown since mockSingle returns auth record
    expect(await screen.findByText("Spotify Linked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sync Queue/i })).toBeInTheDocument();
  });

  it("clicking Sync Queue invokes edge function", async () => {
    render(<SongRequestSection eventId="event-123" isOrganizer={true} />);

    const syncBtn = await screen.findByRole("button", { name: /Sync Queue/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        "sync-spotify-queue",
        expect.objectContaining({ method: "POST", body: { eventId: "event-123" } }),
      );
    });
  });

  it("attendee can upvote/downvote songs", async () => {
    render(<SongRequestSection eventId="event-123" isOrganizer={false} />);

    const upvoteBtn = await screen.findByLabelText("Upvote");
    const downvoteBtn = await screen.findByLabelText("Downvote");

    expect(upvoteBtn).toBeInTheDocument();
    expect(downvoteBtn).toBeInTheDocument();

    // Click upvote (should toggle/delete since user has already upvoted in mock)
    fireEvent.click(upvoteBtn);
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith("song_upvotes");
    });
  });
});
