import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LivePollingCategoryClusterView } from "../LivePollingCategoryClusterView";
import type { LivePollAnalysisResult } from "@/services/livePollingCategorizerService";

describe("LivePollingCategoryClusterView Component", () => {
  const mockAnalysis: LivePollAnalysisResult = {
    pollId: "poll-101",
    questionTitle: "What is the biggest campus challenge?",
    totalResponses: 20,
    analyzedAt: "2026-08-26T00:00:00.000Z",
    clusters: [
      {
        id: "cluster-1",
        title: "Housing & Rent Concerns",
        keywords: ["housing", "rent", "expensive"],
        responseCount: 12,
        percentage: 60,
        upvoteCount: 15,
        sentimentTone: "CRITICAL",
        sampleQuotes: [
          "Off campus housing rent is way too high",
          "We need cheaper dorm options",
        ],
        responses: [
          { id: "1", text: "Off campus housing rent is way too high" },
          { id: "2", text: "We need cheaper dorm options" },
        ],
      },
      {
        id: "cluster-2",
        title: "Dining & Food Concerns",
        keywords: ["dining", "food", "vegan"],
        responseCount: 8,
        percentage: 40,
        upvoteCount: 7,
        sentimentTone: "NEUTRAL",
        sampleQuotes: ["Cafeteria needs better food"],
        responses: [{ id: "3", text: "Cafeteria needs better food" }],
      },
    ],
  };

  it("renders live poll question title and total responses counter", () => {
    render(<LivePollingCategoryClusterView pollAnalysis={mockAnalysis} />);

    expect(screen.getByTestId("live-polling-cluster-view")).toBeDefined();
    expect(screen.getByText("What is the biggest campus challenge?")).toBeDefined();
    expect(screen.getByText("20 Answers Categorized")).toBeDefined();
  });

  it("renders categorized topic cluster cards with percentage progress bars", () => {
    render(<LivePollingCategoryClusterView pollAnalysis={mockAnalysis} />);

    expect(screen.getByText("Housing & Rent Concerns")).toBeDefined();
    expect(screen.getByText("Dining & Food Concerns")).toBeDefined();
    expect(screen.getByText("12 answers (60%)")).toBeDefined();
  });

  it("filters clusters based on search query input", () => {
    render(<LivePollingCategoryClusterView pollAnalysis={mockAnalysis} />);

    const searchInput = screen.getByTestId("cluster-search-input");
    fireEvent.change(searchInput, { target: { value: "dining" } });

    expect(screen.queryByText("Housing & Rent Concerns")).toBeNull();
    expect(screen.getByText("Dining & Food Concerns")).toBeDefined();
  });

  it("toggles between Grouped Clusters view and Raw Response Feed view", () => {
    render(<LivePollingCategoryClusterView pollAnalysis={mockAnalysis} />);

    expect(screen.getByTestId("clusters-list-container")).toBeDefined();

    // Click Raw Feed View toggle
    fireEvent.click(screen.getByTestId("view-mode-raw"));

    expect(screen.getByTestId("raw-feed-container")).toBeDefined();
    expect(screen.getByText('"Off campus housing rent is way too high"')).toBeDefined();
  });

  it("calls onUpvoteCluster when upvote button is clicked", () => {
    const handleUpvote = vi.fn();
    render(
      <LivePollingCategoryClusterView
        pollAnalysis={mockAnalysis}
        onUpvoteCluster={handleUpvote}
      />
    );

    const upvoteBtn = screen.getByTestId("upvote-btn-cluster-1");
    fireEvent.click(upvoteBtn);

    expect(handleUpvote).toHaveBeenCalledWith("cluster-1");
  });

  it("expands sample quotes drawer on click", () => {
    render(<LivePollingCategoryClusterView pollAnalysis={mockAnalysis} />);

    const toggleBtn = screen.getByTestId("toggle-quotes-cluster-1");
    fireEvent.click(toggleBtn);

    expect(screen.getByText('"Off campus housing rent is way too high"')).toBeDefined();
  });
});
