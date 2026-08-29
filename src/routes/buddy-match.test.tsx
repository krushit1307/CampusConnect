import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { TooltipProvider } from "@/components/ui/tooltip";
import BuddyMatchPage, { getInitials, similarityLabel } from "./buddy-match";
import type { BuddyMatch, IncomingWave } from "@/lib/buddyMatcher";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// SiteShell's Navbar pulls in ThemeToggle, which is currently broken on
// upstream main (stray branch-name text committed into the JSX). The toggle
// isn't relevant to these tests, so stub it out.
vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle-stub" />,
}));

vi.mock("@/hooks/useAuthHydration", () => ({
  useAuthHydration: () => ({
    user: { id: "user-1", email: "test@campus.edu" },
    isInitializing: false,
  }),
}));

const mockOptIn = vi.fn();
const mockOptOut = vi.fn();
const mockFindMatches = vi.fn();
const mockSendWave = vi.fn();
const mockRespondToWave = vi.fn();
const mockGetWaves = vi.fn();

vi.mock("@/lib/buddyMatcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/buddyMatcher")>();
  return {
    ...actual,
    getMyBuddyProfile: () => mockGetProfile(),
    optInToBuddyMatching: (...args: unknown[]) => mockOptIn(...args),
    optOutOfBuddyMatching: (...args: unknown[]) => mockOptOut(...args),
    findBuddyMatches: (...args: unknown[]) => mockFindMatches(...args),
    sendWave: (...args: unknown[]) => mockSendWave(...args),
    respondToWave: (...args: unknown[]) => mockRespondToWave(...args),
    getIncomingWaves: () => mockGetWaves(),
  };
});

let optedIn = false;
function mockGetProfile() {
  return Promise.resolve(
    optedIn
      ? {
          user_id: "user-1",
          bio: "Rust and indie games",
          embedding_stale: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : null,
  );
}

const chainable = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn().mockResolvedValue("ok"),
};

const mockSupabase = {
  from: vi.fn(() => ({ ...chainable })),
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn().mockResolvedValue(undefined),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
};

const matches: BuddyMatch[] = [
  {
    user_id: "user-2",
    full_name: "Ada Lovelace",
    handle: "ada",
    avatar_url: null,
    bio: "Countess of computing, loves analytical engines",
    similarity: 0.82,
    shared_categories: ["Tech", "Workshop"],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/buddy-match"]}>
          <BuddyMatchPage />
        </MemoryRouter>
      </QueryClientProvider>
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  optedIn = false;
  queryClient.clear();
  mockFindMatches.mockResolvedValue([]);
  mockGetWaves.mockResolvedValue([] as IncomingWave[]);
  mockSendWave.mockResolvedValue({ success: true, data: { wave_id: "w1" } });
  mockRespondToWave.mockResolvedValue({ success: true, data: "accepted" });
  mockOptIn.mockResolvedValue({
    success: true,
    data: { user_id: "user-1", bio: "x", is_active: true },
  });
});

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe("getInitials", () => {
  it("takes up to the first two initials", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("cher")).toBe("C");
    expect(getInitials(null)).toBe("?");
  });
});

describe("similarityLabel", () => {
  it("formats cosine similarity as a playful percentage", () => {
    expect(similarityLabel(0.8234)).toBe("82% vibe match");
    expect(similarityLabel(0.51)).toBe("51% match");
    expect(similarityLabel(0.1)).toBe("10% overlap");
  });
});

// ─── Opt-in flow ──────────────────────────────────────────────────────────────

describe("BuddyMatchPage (not opted in)", () => {
  it("shows the opt-in card with bio input", async () => {
    renderPage();
    expect(await screen.findByText(/Join the matching pool/i)).toBeInTheDocument();
    expect(screen.getByTestId("buddy-bio-input")).toBeInTheDocument();
  });

  it("submits the bio through the opt-in helper", async () => {
    renderPage();
    const input = await screen.findByTestId("buddy-bio-input");
    fireEvent.change(input, { target: { value: "Rust, indie games and hackathons" } });
    fireEvent.click(screen.getByRole("button", { name: /join & find buddies/i }));
    await waitFor(() => {
      expect(mockOptIn).toHaveBeenCalledWith("Rust, indie games and hackathons");
    });
  });
});

// ─── Matched experience ───────────────────────────────────────────────────────

describe("BuddyMatchPage (opted in)", () => {
  beforeEach(() => {
    optedIn = true;
  });

  it("renders mathematically-ranked match cards with shared categories", async () => {
    mockFindMatches.mockResolvedValue(matches);
    renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("82% vibe match")).toBeInTheDocument();
    expect(screen.getByText("Tech")).toBeInTheDocument();
    expect(mockFindMatches).toHaveBeenCalledWith(5); // KNN limit per the issue spec
  });

  it("sends a wave when the button is clicked", async () => {
    mockFindMatches.mockResolvedValue(matches);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /send a wave/i }));
    await waitFor(() => {
      expect(mockSendWave).toHaveBeenCalledWith("user-2");
    });
  });

  it("shows an empty state when no matches exist yet", async () => {
    renderPage();
    expect(await screen.findByText(/No matches yet/i)).toBeInTheDocument();
  });

  it("can leave the matching pool instantly", async () => {
    mockOptOut.mockResolvedValue({ success: true, data: null });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /leave the matching pool/i }));
    await waitFor(() => {
      expect(mockOptOut).toHaveBeenCalled();
    });
  });

  it("accepting an incoming wave routes through respondToWave", async () => {
    mockGetWaves.mockResolvedValue([
      {
        id: "wave-9",
        created_at: new Date().toISOString(),
        sender: { id: "user-2", full_name: "Ada Lovelace", avatar_url: null, handle: "ada" },
      },
    ] as IncomingWave[]);
    renderPage();

    fireEvent.click(await screen.findByLabelText(/accept wave from ada lovelace/i));
    await waitFor(() => {
      expect(mockRespondToWave).toHaveBeenCalledWith("wave-9", true);
    });
  });
});
