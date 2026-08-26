// src/components/EventDualClockTime.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventDualClockTime } from "./EventDualClockTime";
import type { DualClockEventTime } from "@/lib/timezone";

vi.mock("@/lib/utils", () => ({
  cn: (...args: Array<string | false | null | undefined>) =>
    args.filter(Boolean).join(" "),
}));

function makeDualClock(overrides: Partial<DualClockEventTime> = {}): DualClockEventTime {
  return {
    localStart: "1:00 PM",
    localEnd: "3:00 PM",
    venueStart: "5:00 PM",
    venueEnd: "7:00 PM",
    venueTimeZone: "Europe/London",
    venueTzAbbrev: "BST",
    userTimeZone: "America/New_York",
    userTzAbbrev: "EDT",
    isDualClock: true,
    relativeDayHint: null,
    startUtcIso: "2026-08-15T17:00:00.000Z",
    endUtcIso: "2026-08-15T19:00:00.000Z",
    ...overrides,
  };
}

describe("EventDualClockTime — null / loading", () => {
  it("renders a TBA placeholder when data is null", () => {
    render(<EventDualClockTime data={null} />);
    expect(screen.getByText(/Date & time TBA/i)).toBeInTheDocument();
  });
});

describe("EventDualClockTime — dual-clock variant (tz differ)", () => {
  it("renders both clocks with the correct labels", () => {
    render(<EventDualClockTime data={makeDualClock()} venueLabel="London Campus" />);
    expect(screen.getByText(/Starts at/i)).toBeInTheDocument();
    expect(screen.getByText("1:00 PM")).toBeInTheDocument();
    expect(screen.getByText("EDT")).toBeInTheDocument();
    expect(screen.getByText(/Your Local Time/i)).toBeInTheDocument();
    expect(screen.getByText("5:00 PM")).toBeInTheDocument();
    expect(screen.getByText("BST")).toBeInTheDocument();
    expect(screen.getByText(/London Campus/i)).toBeInTheDocument();
  });

  it("renders the end-time row when localEnd is set", () => {
    render(<EventDualClockTime data={makeDualClock()} />);
    expect(screen.getByText(/Ends at/i)).toBeInTheDocument();
    expect(screen.getByText("3:00 PM")).toBeInTheDocument();
  });

  it("omits the end-time row when localEnd is empty", () => {
    render(
      <EventDualClockTime
        data={makeDualClock({ localEnd: "", venueEnd: "", endUtcIso: null })}
      />,
    );
    expect(screen.queryByText(/Ends at/i)).toBeNull();
  });

  it("renders the relativeDayHint badge when crossing midnight", () => {
    render(
      <EventDualClockTime
        data={makeDualClock({ relativeDayHint: "next day" })}
        venueLabel="Tokyo Campus"
      />,
    );
    expect(screen.getByText("next day")).toBeInTheDocument();
  });

  it("renders a <time dateTime=...> element with the UTC instant for SEO", () => {
    const { container } = render(<EventDualClockTime data={makeDualClock()} />);
    const timeEl = container.querySelector("time[datetime]");
    expect(timeEl).not.toBeNull();
    expect(timeEl?.getAttribute("datetime")).toBe("2026-08-15T17:00:00.000Z");
  });
});

describe("EventDualClockTime — single-clock variant (tz match)", () => {
  it("renders a single line when isDualClock is false", () => {
    render(
      <EventDualClockTime
        data={makeDualClock({
          isDualClock: false,
          venueTimeZone: "America/New_York",
          venueTzAbbrev: "EDT",
        })}
      />,
    );
    expect(screen.queryByText(/Your Local Time/i)).toBeNull();
    expect(screen.getByText(/1:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/3:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/EDT/i)).toBeInTheDocument();
  });
});

describe("EventDualClockTime — compact variant", () => {
  it("renders compact dual-clock with 'you' suffix", () => {
    render(
      <EventDualClockTime
        data={makeDualClock()}
        variant="compact"
        venueLabel="London Campus"
      />,
    );
    expect(screen.getByText("1:00 PM")).toBeInTheDocument();
    expect(screen.getByText(/you/i)).toBeInTheDocument();
    expect(screen.getByText("5:00 PM")).toBeInTheDocument();
    expect(screen.getByText("BST")).toBeInTheDocument();
  });

  it("renders compact single-clock when tz match", () => {
    render(
      <EventDualClockTime
        data={makeDualClock({ isDualClock: false })}
        variant="compact"
      />,
    );
    expect(screen.getByText(/·/)).toBeInTheDocument();
  });
});
