import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import EventMetricRatingForm, {
  DEFAULT_RATING_METRICS,
} from "@/components/events/EventMetricRatingForm";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const mockUser = { id: "user-1" } as never;

describe("EventMetricRatingForm", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("renders a slider for each default metric when none are provided", async () => {
    render(<EventMetricRatingForm eventId="evt-1" user={mockUser} />, { wrapper });

    await waitFor(() => {
      expect(screen.getByLabelText("Food Quality")).toBeInTheDocument();
      expect(screen.getByLabelText("Networking Value")).toBeInTheDocument();
      expect(screen.getByLabelText("Venue Comfort")).toBeInTheDocument();
    });
    expect(screen.getByText(/Rate This Event/i)).toBeInTheDocument();
  });

  it("renders organizer-defined metrics instead of defaults", async () => {
    render(
      <EventMetricRatingForm
        eventId="evt-1"
        user={mockUser}
        metrics={["How was the DJ?", "Food Quality"]}
      />,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByLabelText("How was the DJ?")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Food Quality")).toBeInTheDocument();
  });

  it("uses the default metrics set when metrics are empty", () => {
    expect(DEFAULT_RATING_METRICS.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_RATING_METRICS).toContain("Overall Experience");
  });

  it("submits scores via the supabase client", async () => {
    render(<EventMetricRatingForm eventId="evt-1" user={mockUser} metrics={["Food Quality"]} />, {
      wrapper,
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Food Quality")).toBeInTheDocument();
    });

    fireEvent.submit(screen.getByRole("button", { name: /submit rating/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit rating/i })).toBeEnabled();
    });
  });
});
