import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CloneEventSeriesDialog, MOCK_SERIES_EVENTS } from "./CloneEventSeriesDialog";

describe("CloneEventSeriesDialog Component (#3538)", () => {
  it("renders Clone Event Series dialog header and events preview table", () => {
    render(
      <CloneEventSeriesDialog
        seriesTitle="Fall Workshop Series"
        events={MOCK_SERIES_EVENTS}
        isOpen={true}
      />,
    );

    expect(screen.getByText(/Clone & Shift Event Series — Fall Workshop Series/i)).toBeInTheDocument();
    expect(screen.getByText("Fall Workshop #1: Intro to AI & LLMs")).toBeInTheDocument();
    expect(screen.getByText("Fall Workshop #2: Prompt Engineering")).toBeInTheDocument();
  });

  it("updates live preview timestamps when target start date changes", () => {
    render(
      <CloneEventSeriesDialog
        seriesTitle="Fall Workshop Series"
        events={MOCK_SERIES_EVENTS}
        isOpen={true}
      />,
    );

    const dateInput = screen.getByLabelText(/Target Spring\/New Start Date & Time \*/i);
    fireEvent.change(dateInput, { target: { value: "2026-02-01T18:00" } });

    expect(screen.getByText(/Feb 1, 2026/i)).toBeInTheDocument();
  });

  it("executes series clone action and triggers success callback", async () => {
    const handleSuccess = vi.fn();
    render(
      <CloneEventSeriesDialog
        seriesTitle="Fall Workshop Series"
        events={MOCK_SERIES_EVENTS}
        isOpen={true}
        onCloneSuccess={handleSuccess}
      />,
    );

    const cloneBtn = screen.getByRole("button", { name: /Clone Series \(4 Events\)/i });
    fireEvent.click(cloneBtn);

    await waitFor(() => {
      expect(screen.getByText("Series Cloned to Draft Successfully!")).toBeInTheDocument();
    });

    expect(handleSuccess).toHaveBeenCalledWith(expect.stringContaining("series-spring-"), 4);
  });
});
