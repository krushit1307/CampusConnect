import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import EventScoreboardDashboard from "./events.$eventId.scoreboard";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

vi.mock("@/lib/supabase/client", () => {
  const updateMock = vi.fn().mockResolvedValue({ error: null });
  const eqMock = vi.fn().mockReturnValue({ update: updateMock });

  return {
    createClient: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            score_data: {
              homeTeam: "Alpha",
              awayTeam: "Beta",
              homeScore: 0,
              awayScore: 0,
              status: "not_started",
              updatedAt: new Date().toISOString(),
            },
          },
          error: null,
        }),
        update: updateMock,
      }),
    })),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...(actual as any),
    useParams: () => ({ eventId: "event-123" }),
  };
});

describe("EventScoreboardDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    render(
      <MemoryRouter>
        <EventScoreboardDashboard />
      </MemoryRouter>,
    );
  };

  it("loads and displays initial scoreboard data", async () => {
    renderComponent();

    expect(screen.getByRole("status")).toBeInTheDocument(); // Loading spinner wait

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Beta")).toBeInTheDocument();
  });

  it("updates score successfully when plus button is clicked", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument();
    });

    const plusButtons = screen.getAllByRole("button", { name: "" }); // icon buttons
    // The first plus button would be the 2nd button in the group of 4 (minus, plus, minus, plus)
    // We can rely on specific icons if we want, or just get all and find one that increases score.
    // In our component, we render Minus, Plus. Let's find by class or just blindly click the second icon button.

    // Better way:
    const supabase = createClient();
    const updateSpy = vi.mocked(supabase.from("events").update);

    // Find the button with Plus icon? They don't have aria labels, let's use all button elements
    const buttons = screen.getAllByRole("button");
    // [0: back, 1: start, 2: pause, 3: finish, 4: home_minus, 5: home_plus, 6: away_minus, 7: away_plus]
    const homePlusButton = buttons[5];

    fireEvent.click(homePlusButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalled();
    });
  });

  it("disables minus button when score is 0", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Alpha")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button");
    const homeMinusButton = buttons[4];

    expect(homeMinusButton).toBeDisabled();
  });
});
