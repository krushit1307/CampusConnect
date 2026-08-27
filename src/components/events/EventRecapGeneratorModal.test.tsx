import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventRecapGeneratorModal } from "./EventRecapGeneratorModal";
import * as recapGenerator from "../../lib/eventRecapGenerator";

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-organizer" } } }),
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

describe("EventRecapGeneratorModal Component (#2804)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with tone options when open", () => {
    render(
      <EventRecapGeneratorModal eventId="ev-100" clubId="club-1" isOpen={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText(/AI Event Recap Generator/i)).toBeInTheDocument();
    expect(screen.getByText(/Recap Tone:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate AI Recap/i })).toBeInTheDocument();
  });

  it("triggers recap generation and displays editable markdown draft", async () => {
    vi.spyOn(recapGenerator, "generateEventRecap").mockResolvedValueOnce({
      success: true,
      recapMarkdown: "# AI Compiled Recap\n\nAwesome turnout with 45 students!",
      heroPhotos: ["https://example.com/img1.jpg"],
      attendanceCount: 45,
      clubId: "club-1",
      eventTitle: "Annual Hackathon",
    });

    render(
      <EventRecapGeneratorModal eventId="ev-100" clubId="club-1" isOpen={true} onClose={vi.fn()} />,
    );

    const generateBtn = screen.getByRole("button", { name: /Generate AI Recap/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/AI compiled the recap using 45 attendee insights/i),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue(/Awesome turnout with 45 students/i)).toBeInTheDocument();
    });
  });

  it("warns user on data scarcity", async () => {
    vi.spyOn(recapGenerator, "generateEventRecap").mockResolvedValueOnce({
      success: false,
      isDataScarcity: true,
      error: "Insufficient verified attendees to compile a recap.",
    });

    render(
      <EventRecapGeneratorModal
        eventId="ev-sparse"
        clubId="club-1"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    const generateBtn = screen.getByRole("button", { name: /Generate AI Recap/i });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Insufficient verified attendees to compile a recap/i),
      ).toBeInTheDocument();
    });
  });
});
