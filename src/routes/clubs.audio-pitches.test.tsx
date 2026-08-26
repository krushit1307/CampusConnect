// src/routes/clubs.audio-pitches.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Supabase mock ────────────────────────────────────────────────────────────

const PITCH_FIXTURE = {
  id: "pitch-1",
  club_id: "club-1",
  audio_url: "https://example.com/audio.webm",
  duration_seconds: 45,
  listen_count: 12,
  created_at: "2026-08-20T12:00:00Z",
  clubs: {
    id: "club-1",
    name: "Chess Club",
    slug: "chess-club",
    description: "Strategic minds unite!",
    logo_url: null,
    banner_url: null,
    category: "Academic",
    member_count: 42,
  },
};

let pitchesResponse: { data: any[]; error: null } = { data: [PITCH_FIXTURE], error: null };

const chainMock = () => ({
  select: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      order: vi.fn().mockImplementation(() => Promise.resolve(pitchesResponse)),
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => Promise.resolve(pitchesResponse)),
      }),
    }),
    in: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockImplementation(() => Promise.resolve(pitchesResponse)),
      }),
    }),
    order: vi.fn().mockImplementation(() => Promise.resolve(pitchesResponse)),
  }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockImplementation(() => chainMock()),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
      }),
    },
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test.webm" }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://example.com/test.webm" },
        }),
      }),
    },
  }),
}));

// ─── Framer motion mock ───────────────────────────────────────────────────────
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div data-testid="motion-div">{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

import ClubAudioPitches from "./clubs.audio-pitches";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClubAudioPitches />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  pitchesResponse = { data: [PITCH_FIXTURE], error: null };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ClubAudioPitches", () => {
  it("renders the loading state initially", () => {
    renderPage();
    expect(screen.getByText("Loading audio pitches…")).toBeInTheDocument();
  });

  it("renders the empty state when no pitches exist", async () => {
    pitchesResponse = { data: [], error: null };
    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText("No Audio Pitches Yet")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("renders club name when pitches are available", async () => {
    renderPage();

    await waitFor(
      () => {
        expect(screen.getByText("Chess Club")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
