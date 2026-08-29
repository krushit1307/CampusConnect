import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LiveCollaborativeNotes, MOCK_INITIAL_CURSORS } from "./LiveCollaborativeNotes";

describe("LiveCollaborativeNotes Component (#3564)", () => {
  it("renders Collaborative Notes header, active presence indicators, and content", () => {
    render(
      <LiveCollaborativeNotes
        eventTitle="Guest Lecture: Intro to LLMs"
        initialCursors={MOCK_INITIAL_CURSORS}
        isOrganizer={true}
      />
    );

    expect(screen.getByText(/Live Collaborative Study Guide — Guest Lecture: Intro to LLMs/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Note-Takers \(4\):/i)).toBeInTheDocument();
    expect(screen.getByText(/Alex Rivera is typing\.\.\./i)).toBeInTheDocument();
  });

  it("handles live typing input and triggers content change", () => {
    const handleChange = vi.fn();
    render(
      <LiveCollaborativeNotes
        eventTitle="Guest Lecture: Intro to LLMs"
        initialContent="Initial notes"
        onContentChange={handleChange}
      />
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Initial notes updated with new ideas" } });

    expect(handleChange).toHaveBeenCalledWith("Initial notes updated with new ideas");
  });

  it("allows event organizer to freeze document into read-only mode", () => {
    const handleFreeze = vi.fn();
    render(
      <LiveCollaborativeNotes
        eventTitle="Guest Lecture: Intro to LLMs"
        isOrganizer={true}
        initialFrozen={false}
        onFreezeToggle={handleFreeze}
      />
    );

    const freezeBtn = screen.getByRole("button", { name: /Freeze Document/i });
    fireEvent.click(freezeBtn);

    expect(handleFreeze).toHaveBeenCalledWith(true);
  });

  it("exports study guide document", () => {
    render(
      <LiveCollaborativeNotes
        eventTitle="Guest Lecture: Intro to LLMs"
        initialContent="Key takeaways..."
      />
    );

    const exportBtn = screen.getByRole("button", { name: /Export Guide \(\.MD\)/i });
    fireEvent.click(exportBtn);

    expect(screen.getByText(/Study guide exported! Sent to event attendee digital swag bags\./i)).toBeInTheDocument();
  });
});
