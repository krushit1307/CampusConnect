import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventFeedbackLlmSummaryCard } from "./EventFeedbackLlmSummaryCard";
import * as service from "@/services/eventFeedbackSummaryService";

vi.mock("@/services/eventFeedbackSummaryService");

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("EventFeedbackLlmSummaryCard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  const renderComponent = (props: { eventId: string; responseCount?: number }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <EventFeedbackLlmSummaryCard {...props} />
      </QueryClientProvider>,
    );

  it("renders empty state when no summary exists yet", async () => {
    vi.mocked(service.getExistingFeedbackSummary).mockResolvedValue(null);

    renderComponent({ eventId: "evt-1", responseCount: 5 });

    expect(
      screen.getByText("Executive AI Feedback Summary"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("No Executive LLM Summary Generated Yet"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Generate LLM Summary")).toBeInTheDocument();
  });

  it("renders populated summary with Top 3 things done well and Top 3 improvements", async () => {
    vi.mocked(service.getExistingFeedbackSummary).mockResolvedValue({
      event_id: "evt-1",
      executive_summary_markdown: "## Executive Summary\n\nExcellent engagement across all workshops.",
      top_positives: [
        "Dynamic hands-on coding demos",
        "Clear and engaging speaker delivery",
        "Great pizza selection",
      ],
      top_improvements: [
        "Room was too cold",
        "Start time was delayed 15 minutes",
        "Need more electrical outlets",
      ],
      review_count: 24,
      generated_at: "2026-08-20T12:00:00Z",
    });

    renderComponent({ eventId: "evt-1", responseCount: 24 });

    await waitFor(() => {
      expect(screen.getByText("Top 3 Things Done Well")).toBeInTheDocument();
    });

    expect(screen.getByText("Dynamic hands-on coding demos")).toBeInTheDocument();
    expect(screen.getByText("Clear and engaging speaker delivery")).toBeInTheDocument();
    expect(screen.getByText("Great pizza selection")).toBeInTheDocument();

    expect(screen.getByText("Top 3 Must Improve Next Time")).toBeInTheDocument();
    expect(screen.getByText("Room was too cold")).toBeInTheDocument();
    expect(screen.getByText("Start time was delayed 15 minutes")).toBeInTheDocument();

    expect(screen.getByText("Re-Generate Summary")).toBeInTheDocument();
  });

  it("triggers generateFeedbackSummary when clicking Generate LLM Summary button", async () => {
    vi.mocked(service.getExistingFeedbackSummary).mockResolvedValue(null);
    vi.mocked(service.generateFeedbackSummary).mockResolvedValue({
      success: true,
      summary: {
        event_id: "evt-1",
        executive_summary_markdown: "## Newly Generated Summary",
        top_positives: ["Positive 1", "Positive 2", "Positive 3"],
        top_improvements: ["Fix 1", "Fix 2", "Fix 3"],
        review_count: 10,
        generated_at: "2026-08-23T12:00:00Z",
      },
    });

    renderComponent({ eventId: "evt-1", responseCount: 10 });

    await waitFor(() => {
      expect(screen.getByText("Generate LLM Summary")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Generate LLM Summary"));

    await waitFor(() => {
      expect(service.generateFeedbackSummary).toHaveBeenCalledWith("evt-1");
      expect(screen.getByText("Positive 1")).toBeInTheDocument();
      expect(screen.getByText("Fix 1")).toBeInTheDocument();
    });
  });
});
