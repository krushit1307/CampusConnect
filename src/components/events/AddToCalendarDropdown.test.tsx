// src/components/events/AddToCalendarDropdown.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddToCalendarDropdown } from "./AddToCalendarDropdown";
import type { CalendarEvent } from "@/lib/addToCalendar";

const sampleEvent: CalendarEvent = {
  id: "evt-123",
  title: "Tech Symposium 2026",
  description: "A full-day symposium.",
  start_date: "2026-08-15T19:30:00.000Z",
  end_date: "2026-08-15T22:00:00.000Z",
  location: "Main Auditorium",
  eventUrl: "https://campusconnect.app/events/evt-123",
};

// Mock window.open
const openSpy = vi.fn();
vi.stubGlobal("open", openSpy);

// Mock downloadIcsFile (we test it separately in addToCalendar.test.ts)
vi.mock("@/lib/addToCalendar", async () => {
  const actual = await vi.importActual<typeof import("@/lib/addToCalendar")>("@/lib/addToCalendar");
  return {
    ...actual,
    downloadIcsFile: vi.fn(),
  };
});

import { downloadIcsFile, getGoogleCalendarUrl } from "@/lib/addToCalendar";
const downloadIcsFileMock = downloadIcsFile as ReturnType<typeof vi.fn>;

beforeEach(() => {
  openSpy.mockReset();
  downloadIcsFileMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AddToCalendarDropdown", () => {
  it("renders the trigger button", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    expect(screen.getByRole("button", { name: /add to calendar/i })).toBeInTheDocument();
  });

  it("opens the dropdown on click", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    expect(screen.getByRole("menu", { name: /choose calendar provider/i })).toBeInTheDocument();
    expect(screen.getByText("Apple Calendar")).toBeInTheDocument();
    expect(screen.getByText("Google Calendar")).toBeInTheDocument();
    expect(screen.getByText("Outlook")).toBeInTheDocument();
    expect(screen.getByText("Yahoo Calendar")).toBeInTheDocument();
  });

  it("opens Google Calendar in a new tab when clicked", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByText("Google Calendar"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("text=Tech+Symposium+2026");
  });

  it("triggers .ics download for Apple Calendar", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByText("Apple Calendar"));

    expect(downloadIcsFileMock).toHaveBeenCalledWith(sampleEvent);
  });

  it("triggers .ics download for Outlook", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByText("Outlook"));

    expect(downloadIcsFileMock).toHaveBeenCalledWith(sampleEvent);
  });

  it("opens Yahoo Calendar in a new tab when clicked", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByText("Yahoo Calendar"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = openSpy.mock.calls[0][0];
    expect(url).toContain("calendar.yahoo.com");
  });

  it("closes the dropdown after selecting an option", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    const trigger = screen.getByRole("button", { name: /add to calendar/i });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Google Calendar"));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <AddToCalendarDropdown event={sampleEvent} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows a brief 'Added!' flash after selecting", async () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    fireEvent.click(screen.getByRole("button", { name: /add to calendar/i }));
    fireEvent.click(screen.getByText("Apple Calendar"));

    await waitFor(() => {
      expect(screen.getByText("Added!")).toBeInTheDocument();
    });
  });

  it("exposes aria-haspopup and aria-expanded", () => {
    render(<AddToCalendarDropdown event={sampleEvent} />);
    const trigger = screen.getByRole("button", { name: /add to calendar/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
