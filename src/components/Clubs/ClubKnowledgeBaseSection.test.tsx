import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClubKnowledgeBaseSection } from "./ClubKnowledgeBaseSection";
import * as postMortemService from "@/services/eventPostMortemService";

vi.mock("@/services/eventPostMortemService");

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("ClubKnowledgeBaseSection", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  const renderComponent = (props: { clubId: string }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <ClubKnowledgeBaseSection {...props} />
      </QueryClientProvider>,
    );

  it("renders knowledge base header and post-mortem list", async () => {
    vi.mocked(postMortemService.searchClubPostMortems).mockResolvedValue([
      {
        id: "pm-1",
        event_id: "evt-gala",
        event_title: "Spring Charity Gala",
        club_id: "club-1",
        what_went_well: "Ticket sales sold out in 2 hours",
        what_failed: "Catering arrived 30 minutes late",
        advice_for_next_year: "Book caterer with guaranteed 1-hour early arrival",
        logistics_score: 4,
        budget_accuracy_score: 5,
        created_at: "2026-05-01T12:00:00Z",
      },
    ]);

    renderComponent({ clubId: "club-1" });

    expect(
      await screen.findByText("Club Knowledge Base & Retrospectives"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Spring Charity Gala")).toBeInTheDocument();
    expect(screen.getByText("Ticket sales sold out in 2 hours")).toBeInTheDocument();
    expect(screen.getByText("Catering arrived 30 minutes late")).toBeInTheDocument();
    expect(
      screen.getByText("Book caterer with guaranteed 1-hour early arrival"),
    ).toBeInTheDocument();
  });
});
