import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventSeriesCatchUpCard } from "./EventSeriesCatchUpCard";
import * as catchupService from "@/services/eventSeriesCatchupService";

vi.mock("@/services/eventSeriesCatchupService");

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("EventSeriesCatchUpCard", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  const renderComponent = (props: {
    eventId: string;
    eventTitle: string;
    recordingUrl?: string | null;
    materialsUrl?: string | null;
    seriesId?: string | null;
  }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <EventSeriesCatchUpCard {...props} />
      </QueryClientProvider>,
    );

  it("does not render if event is not part of a series and has no catchup data", () => {
    vi.mocked(catchupService.getUserSeriesCatchup).mockResolvedValue(null);

    const { container } = renderComponent({
      eventId: "evt-standalone",
      eventTitle: "Standalone Talk",
      seriesId: null,
    });

    expect(container.firstChild).toBeNull();
  });

  it("renders catch-up hub when series has recording and materials URLs", async () => {
    vi.mocked(catchupService.getUserSeriesCatchup).mockResolvedValue({
      id: "cup-1",
      series_id: "ser-1",
      missed_event_id: "evt-1",
      user_id: "usr-1",
      recording_url: "https://campusconnect.app/vod/1",
      materials_url: "https://campusconnect.app/slides/1.pdf",
      email_sent: true,
      vod_clicked: false,
      materials_clicked: false,
      created_at: "2026-08-23T12:00:00Z",
    });

    renderComponent({
      eventId: "evt-1",
      eventTitle: "Python Week 1",
      seriesId: "ser-1",
      recordingUrl: "https://campusconnect.app/vod/1",
      materialsUrl: "https://campusconnect.app/slides/1.pdf",
    });

    expect(await screen.findByText("Event Series Catch-Up Hub")).toBeInTheDocument();
    expect(screen.getByText("Watch Session VOD")).toBeInTheDocument();
    expect(screen.getByText("Slide Deck & Materials")).toBeInTheDocument();
  });

  it("tracks click when user accesses VOD link", async () => {
    vi.mocked(catchupService.getUserSeriesCatchup).mockResolvedValue({
      id: "cup-1",
      series_id: "ser-1",
      missed_event_id: "evt-1",
      user_id: "usr-1",
      recording_url: "https://campusconnect.app/vod/1",
      materials_url: null,
      email_sent: true,
      vod_clicked: false,
      materials_clicked: false,
      created_at: "2026-08-23T12:00:00Z",
    });

    renderComponent({
      eventId: "evt-1",
      eventTitle: "Python Week 1",
      seriesId: "ser-1",
      recordingUrl: null,
    });

    expect(await screen.findByText("Event Series Catch-Up Hub")).toBeInTheDocument();
    const vodLink = await screen.findByText("Watch Session VOD");
    fireEvent.click(vodLink);

    await waitFor(() => {
      expect(catchupService.trackCatchupClick).toHaveBeenCalledWith("cup-1", "vod");
    });
  });
});
