import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttendeeHuntView } from "./AttendeeHuntView";
import * as huntEngine from "../../lib/scavengerHuntEngine";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          full_name: "Alice",
          current_clue_order: 3,
          total_score: 300,
          completed_at: null,
          duration_seconds: null,
        },
      ],
      error: null,
    }),
  }),
}));

describe("AttendeeHuntView Component (#2801)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders active clue details for the attendee", async () => {
    vi.spyOn(huntEngine, "getUserCurrentClue").mockResolvedValueOnce({
      success: true,
      data: {
        clue_id: "clue-1",
        sequence_order: 1,
        hint_text: "Find the clock tower in the main campus square.",
        points: 100,
        total_clues: 3,
        current_score: 0,
        is_completed: false,
      },
    });

    render(<AttendeeHuntView huntId="hunt-1" userId="user-1" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Find the clock tower in the main campus square/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Checkpoint 1 of 3/i)).toBeInTheDocument();
    });
  });

  it("handles QR code submission and triggers clue progress", async () => {
    vi.spyOn(huntEngine, "getUserCurrentClue").mockResolvedValue({
      success: true,
      data: {
        clue_id: "clue-1",
        sequence_order: 1,
        hint_text: "Find the clock tower",
        points: 100,
        total_clues: 2,
        current_score: 0,
        is_completed: false,
      },
    });

    const submitSpy = vi.spyOn(huntEngine, "submitClueScan").mockResolvedValueOnce({
      success: true,
      message: "Clue Solved! Next clue unlocked.",
      new_clue_order: 2,
      total_score: 100,
      is_completed: false,
    });

    render(<AttendeeHuntView huntId="hunt-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. CAMPUSHUNT/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/e\.g\. CAMPUSHUNT/i);
    fireEvent.change(input, { target: { value: "CAMPUSHUNT:hunt-1:STEP_1:valid" } });

    const submitBtn = screen.getByRole("button", { name: /Verify & Unlock Next Clue/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalledWith(
        "hunt-1",
        "user-1",
        "CAMPUSHUNT:hunt-1:STEP_1:valid",
        null,
        null,
      );
      expect(screen.getByText(/Clue Solved! Next clue unlocked/i)).toBeInTheDocument();
    });
  });

  it("switches to leaderboard view correctly", async () => {
    vi.spyOn(huntEngine, "getUserCurrentClue").mockResolvedValueOnce({
      success: true,
      data: {
        clue_id: "clue-1",
        sequence_order: 1,
        hint_text: "Hint",
        points: 100,
        total_clues: 3,
        current_score: 0,
        is_completed: false,
      },
    });

    render(<AttendeeHuntView huntId="hunt-1" userId="user-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Active Mission/i)).toBeInTheDocument();
    });

    const leaderboardTab = screen.getByRole("button", { name: /Leaderboard/i });
    fireEvent.click(leaderboardTab);

    await waitFor(() => {
      expect(screen.getByText(/Live Leaderboard/i)).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("300 pts")).toBeInTheDocument();
    });
  });
});
