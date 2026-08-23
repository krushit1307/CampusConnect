import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EventWeatherWarningBanner } from "./EventWeatherWarningBanner";
import * as weatherService from "@/services/eventWeatherAlertService";

vi.mock("@/services/eventWeatherAlertService");

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

describe("EventWeatherWarningBanner", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = createTestQueryClient();
  });

  const renderComponent = (props: { eventId: string; eventTitle: string; isOutdoor?: boolean }) =>
    render(
      <QueryClientProvider client={queryClient}>
        <EventWeatherWarningBanner {...props} />
      </QueryClientProvider>,
    );

  it("does not render banner when there are no alerts and event is indoor", () => {
    vi.mocked(weatherService.getEventWeatherAlerts).mockResolvedValue([]);

    const { container } = renderComponent({
      eventId: "evt-1",
      eventTitle: "Indoor Hackathon",
      isOutdoor: false,
    });

    expect(container.firstChild).toBeNull();
  });

  it("renders critical weather warning when severe weather alert exists", async () => {
    vi.mocked(weatherService.getEventWeatherAlerts).mockResolvedValue([
      {
        id: "alert-101",
        event_id: "evt-1",
        organizer_id: "org-1",
        forecast_time: "2026-08-24T17:00:00Z",
        condition: "thunderstorm",
        precipitation_probability: 0.88,
        indoor_backup_url: "/events/evt-1?action=find-indoor-backup",
        created_at: "2026-08-23T12:00:00Z",
      },
    ]);

    renderComponent({
      eventId: "evt-1",
      eventTitle: "Campus BBQ",
      isOutdoor: true,
    });

    expect(await screen.findByText(/CRITICAL WEATHER ALERT/i)).toBeInTheDocument();
    expect(screen.getByText(/Severe impending weather detected \(THUNDERSTORM\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Precipitation probability:/i)).toBeInTheDocument();
    expect(screen.getByText(/88%/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel Event & Notify/i)).toBeInTheDocument();
    expect(screen.getByText(/Change Venue/i)).toBeInTheDocument();
  });

  it("opens CancelEventDangerModal when clicking Cancel Event & Notify", async () => {
    vi.mocked(weatherService.getEventWeatherAlerts).mockResolvedValue([
      {
        id: "alert-101",
        event_id: "evt-1",
        organizer_id: "org-1",
        forecast_time: "2026-08-24T17:00:00Z",
        condition: "thunderstorm",
        precipitation_probability: 0.9,
        indoor_backup_url: "/events/evt-1?action=find-indoor-backup",
        created_at: "2026-08-23T12:00:00Z",
      },
    ]);

    renderComponent({
      eventId: "evt-1",
      eventTitle: "Campus BBQ",
      isOutdoor: true,
    });

    const cancelBtn = await screen.findByText(/Cancel Event & Notify/i);
    fireEvent.click(cancelBtn);

    expect(screen.getByText(/CANCEL CAMPUS BBQ/i)).toBeInTheDocument();
  });
});
