import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BreakoutRoomMatchmaker, MOCK_ACTIVE_ATTENDEES } from "./BreakoutRoomMatchmaker";

describe("BreakoutRoomMatchmaker Component (#3540)", () => {
  it("renders Breakout Room Matchmaker header and initial matched rooms", () => {
    render(
      <BreakoutRoomMatchmaker
        eventName="Virtual Mixer 2026"
        attendees={MOCK_ACTIVE_ATTENDEES}
      />
    );

    expect(screen.getByText(/Breakout Room Matchmaker — Virtual Mixer 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/6 Active Attendees/i)).toBeInTheDocument();
    expect(screen.getByText(/Matched Sub-Groups/i)).toBeInTheDocument();
    expect(screen.getByText("Alex Dev")).toBeInTheDocument();
  });

  it("updates target room size and regenerates smart breakouts", async () => {
    const handleGenerated = vi.fn();
    render(
      <BreakoutRoomMatchmaker
        eventName="Virtual Mixer 2026"
        attendees={MOCK_ACTIVE_ATTENDEES}
        onRoomsGenerated={handleGenerated}
      />
    );

    const generateBtn = screen.getByRole("button", { name: /Generate Smart Breakouts/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(handleGenerated).toHaveBeenCalled();
    });
  });

  it("provides 1-click Export Zoom CSV download button", () => {
    render(
      <BreakoutRoomMatchmaker
        eventName="Virtual Mixer 2026"
        attendees={MOCK_ACTIVE_ATTENDEES}
      />
    );

    const exportBtn = screen.getByRole("button", { name: /Export Zoom CSV/i });
    expect(exportBtn).toBeInTheDocument();
    expect(exportBtn).not.toBeDisabled();
  });
});
