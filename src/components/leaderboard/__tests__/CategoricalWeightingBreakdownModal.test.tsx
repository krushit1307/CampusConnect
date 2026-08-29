import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoricalWeightingBreakdownModal } from "../CategoricalWeightingBreakdownModal";
import type { UnderdogClubEntry } from "@/types/underdogLeaderboard";

describe("CategoricalWeightingBreakdownModal Component", () => {
  const mockClubEntry: UnderdogClubEntry = {
    club_id: "club-robotics",
    club_name: "Autonomous Robotics & AI Club",
    member_count: 18,
    active_member_count: 16,
    raw_points: 1000,
    per_capita_points: 55.6,
    underdog_multiplier: 1.8,
    adjusted_score: 1800,
    categorical_points: 1350,
    categorical_weight_multiplier: 1.35,
    diversity_bonus: 100,
    raw_rank: 2,
    underdog_rank: 1,
    categorical_rank: 1,
    rank_position: 1,
    rank_delta: 1,
    badge: "Academic Excellence 🎓",
    category_breakdown: [
      { category: "Academic & Research", rawPoints: 600, weightMultiplier: 1.4, weightedPoints: 840 },
      { category: "Inter-Club Collaboration", rawPoints: 400, weightMultiplier: 1.25, weightedPoints: 500 },
    ],
  };

  it("does NOT render when isOpen is false", () => {
    render(<CategoricalWeightingBreakdownModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("categorical-modal")).toBeNull();
  });

  it("renders category weighting matrix legend when open", () => {
    render(<CategoricalWeightingBreakdownModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("categorical-modal")).toBeDefined();
    expect(screen.getByText("Academic & Research")).toBeDefined();
    expect(screen.getByText("1.40x")).toBeDefined();
    expect(screen.getByText("Community Service")).toBeDefined();
    expect(screen.getByText("1.30x")).toBeDefined();
  });

  it("displays selected club category breakdown when clubEntry is passed", () => {
    render(<CategoricalWeightingBreakdownModal isOpen={true} onClose={vi.fn()} clubEntry={mockClubEntry} />);

    expect(screen.getByTestId("selected-club-categorical-breakdown")).toBeDefined();
    expect(screen.getByText("Autonomous Robotics & AI Club")).toBeDefined();
    expect(screen.getByText("1350")).toBeDefined();
    expect(screen.getByText("+100 pts")).toBeDefined();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(<CategoricalWeightingBreakdownModal isOpen={true} onClose={handleClose} />);

    fireEvent.click(screen.getByTestId("categorical-modal-close"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
