import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PollOverlay } from "../stream/PollOverlay";
import type { User } from "@supabase/supabase-js";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockVote = vi.fn();
const mockClosePoll = vi.fn();
const mockRefetch = vi.fn();

const basePollHookReturn = {
  activePoll: null,
  options: [],
  results: [],
  userVote: null,
  isLoading: false,
  isVoting: false,
  vote: mockVote,
  closePoll: mockClosePoll,
  refetch: mockRefetch,
};

vi.mock("@/hooks/useActivePoll", () => ({
  useActivePoll: vi.fn(() => basePollHookReturn),
}));

vi.mock("@/components/polls/CreatePollDialog", () => ({
  CreatePollDialog: ({ onPollCreated }: { onPollCreated?: () => void }) => (
    <button data-testid="create-poll-trigger" onClick={onPollCreated}>
      Launch Poll
    </button>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("lucide-react/dist/esm/icons/bar-chart-3", () => ({
  default: () => <span data-testid="icon-bar-chart" />,
}));

vi.mock("lucide-react/dist/esm/icons/x", () => ({
  default: () => <span data-testid="icon-x" />,
}));

vi.mock("lucide-react/dist/esm/icons/check", () => ({
  default: () => <span data-testid="icon-check" />,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

import { useActivePoll } from "@/hooks/useActivePoll";

const mockUseActivePoll = useActivePoll as unknown as ReturnType<typeof vi.fn>;

const testUser: User = {
  id: "user-123",
  email: "test@campus.edu",
} as unknown as User;

const sampleResults = [
  { optionId: "opt-a", text: "React", votes: 5, position: 0 },
  { optionId: "opt-b", text: "Vue", votes: 3, position: 1 },
  { optionId: "opt-c", text: "Angular", votes: 2, position: 2 },
];

const samplePoll = {
  id: "poll-1",
  event_id: "evt-1",
  created_by: "mod-1",
  question: "What framework do you prefer?",
  is_active: true,
  is_anonymous: false,
  created_at: new Date().toISOString(),
};

// ── Test suites ─────────────────────────────────────────────────────────────

describe("PollOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActivePoll.mockReturnValue({ ...basePollHookReturn });
  });

  it("renders nothing when there is no active poll and user is not moderator", () => {
    const { container } = render(
      <PollOverlay eventId="evt-1" user={testUser} isModerator={false} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the Launch Poll trigger for moderators when no active poll", () => {
    render(<PollOverlay eventId="evt-1" user={testUser} isModerator={true} />);
    expect(screen.getByTestId("create-poll-trigger")).toBeInTheDocument();
  });

  it("renders the poll question and vote buttons when a poll is active", () => {
    mockUseActivePoll.mockReturnValue({
      ...basePollHookReturn,
      activePoll: samplePoll,
      results: sampleResults,
    });

    render(<PollOverlay eventId="evt-1" user={testUser} />);
    expect(screen.getByText("What framework do you prefer?")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Vue")).toBeInTheDocument();
    expect(screen.getByText("Angular")).toBeInTheDocument();
  });

  it("calls vote() when clicking an option", async () => {
    mockVote.mockResolvedValue(undefined);
    mockUseActivePoll.mockReturnValue({
      ...basePollHookReturn,
      activePoll: samplePoll,
      results: sampleResults,
      vote: mockVote,
    });

    render(<PollOverlay eventId="evt-1" user={testUser} />);
    fireEvent.click(screen.getByText("Vue"));

    await waitFor(() => {
      expect(mockVote).toHaveBeenCalledWith("opt-b");
    });
  });

  it("shows bar-chart results after the user has voted", () => {
    mockUseActivePoll.mockReturnValue({
      ...basePollHookReturn,
      activePoll: samplePoll,
      results: sampleResults,
      userVote: "opt-a",
    });

    render(<PollOverlay eventId="evt-1" user={testUser} />);
    // Percentage for "React" = 5/(5+3+2) = 50%
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("10 votes cast")).toBeInTheDocument();
  });

  it("shows close button only for moderators", () => {
    mockUseActivePoll.mockReturnValue({
      ...basePollHookReturn,
      activePoll: samplePoll,
      results: sampleResults,
    });

    const { rerender } = render(
      <PollOverlay eventId="evt-1" user={testUser} isModerator={false} />,
    );
    expect(screen.queryByTestId("poll-overlay-close")).not.toBeInTheDocument();

    rerender(<PollOverlay eventId="evt-1" user={testUser} isModerator={true} />);
    expect(screen.getByTestId("poll-overlay-close")).toBeInTheDocument();
  });

  it("calls closePoll when the moderator clicks close", async () => {
    mockClosePoll.mockResolvedValue(undefined);
    mockUseActivePoll.mockReturnValue({
      ...basePollHookReturn,
      activePoll: samplePoll,
      results: sampleResults,
      closePoll: mockClosePoll,
    });

    render(<PollOverlay eventId="evt-1" user={testUser} isModerator={true} />);
    fireEvent.click(screen.getByTestId("poll-overlay-close"));

    await waitFor(() => {
      expect(mockClosePoll).toHaveBeenCalledOnce();
    });
  });
});
