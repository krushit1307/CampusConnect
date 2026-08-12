import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EventCollaborationWorkspace } from "./EventCollaborationWorkspace";

describe("EventCollaborationWorkspace Component (#1780)", () => {
  it("renders workspace title, event title, and default tasks", () => {
    render(
      <EventCollaborationWorkspace eventId="evt-999" eventTitle="Campus Tech Hackathon 2026" />,
    );

    expect(screen.getByText(/Organizer Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Campus Tech Hackathon 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Finalize main stage AV & microphone setup/i)).toBeInTheDocument();
  });

  it("allows adding a new task", () => {
    render(
      <EventCollaborationWorkspace eventId="evt-999" eventTitle="Campus Tech Hackathon 2026" />,
    );

    const input = screen.getByPlaceholderText(/Task description.../i);
    fireEvent.change(input, { target: { value: "Book guest speaker travel" } });

    const addButton = screen.getByRole("button", { name: /Add Task/i });
    fireEvent.click(addButton);

    expect(screen.getByText("Book guest speaker travel")).toBeInTheDocument();
  });

  it("filters tasks by priority", () => {
    render(
      <EventCollaborationWorkspace eventId="evt-999" eventTitle="Campus Tech Hackathon 2026" />,
    );

    const select = screen.getByDisplayValue(/All Priorities/i);
    fireEvent.change(select, { target: { value: "high" } });

    expect(screen.getByText(/Finalize main stage AV & microphone setup/i)).toBeInTheDocument();
    expect(screen.queryByText(/Setup check-in QR scanner terminals/i)).not.toBeInTheDocument();
  });

  it("allows adding a new organizer team member", () => {
    render(
      <EventCollaborationWorkspace eventId="evt-999" eventTitle="Campus Tech Hackathon 2026" />,
    );

    const nameInput = screen.getByPlaceholderText(/Name.../i);
    const emailInput = screen.getByPlaceholderText(/Email.../i);

    fireEvent.change(nameInput, { target: { value: "Taylor Swift" } });
    fireEvent.change(emailInput, { target: { value: "taylor@campus.edu" } });

    const addMemberBtn = screen.getByRole("button", { name: /Add Member/i });
    fireEvent.click(addMemberBtn);

    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
    expect(screen.getByText("taylor@campus.edu")).toBeInTheDocument();
  });
});
