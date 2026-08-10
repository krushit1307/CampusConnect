import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventRsvpCancelDialog } from "./EventRsvpCancelDialog";

describe("EventRsvpCancelDialog", () => {
  it("shows the required cancellation confirmation question", () => {
    render(
      <EventRsvpCancelDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        eventTitle="Campus Hackathon"
      />,
    );

    expect(screen.getByText("Are you sure you want to cancel your RSVP?")).toBeInTheDocument();
    expect(screen.getByText(/Campus Hackathon/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep rsvp/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /yes, cancel rsvp/i })).toBeInTheDocument();
  });

  it("only executes the cancel action when the user confirms", () => {
    const onConfirm = vi.fn();

    render(
      <EventRsvpCancelDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        eventTitle="Campus Hackathon"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /keep rsvp/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, cancel rsvp/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables dialog actions while cancellation is pending", () => {
    render(
      <EventRsvpCancelDialog
        open
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        eventTitle="Campus Hackathon"
        isPending
      />,
    );

    expect(screen.getByRole("button", { name: /keep rsvp/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelling/i })).toBeDisabled();
  });
});
