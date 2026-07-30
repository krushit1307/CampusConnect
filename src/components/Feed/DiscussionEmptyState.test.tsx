import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DiscussionEmptyState } from "./DiscussionEmptyState";

describe("DiscussionEmptyState Component", () => {
  it("renders default title and description when no search query is provided", () => {
    render(<DiscussionEmptyState />);

    expect(
      screen.getByText("No posts yet. Be the first to start a discussion!"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Share an announcement, ask a question, or post an update for your club community.",
      ),
    ).toBeInTheDocument();
  });

  it("renders search-specific text when searchQuery is active", () => {
    render(<DiscussionEmptyState searchQuery="hackathon" />);

    expect(screen.getByText("No posts match your search query.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try searching for a different keyword or clear your search to view all club discussions.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onStartDiscussion when CTA button is clicked", () => {
    const handleStart = vi.fn();
    render(<DiscussionEmptyState onStartDiscussion={handleStart} />);

    const button = screen.getByRole("button", { name: /start a discussion/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleStart).toHaveBeenCalledTimes(1);
  });

  it("does not render CTA button when onStartDiscussion is omitted", () => {
    render(<DiscussionEmptyState />);

    expect(screen.queryByRole("button", { name: /start a discussion/i })).not.toBeInTheDocument();
  });
});
