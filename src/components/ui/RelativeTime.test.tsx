import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RelativeTime } from "./RelativeTime";
import { getNextRelativeUpdateDelay } from "@/hooks/useRelativeTime";

describe("RelativeTime Component & Hook (#1750)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders relative timestamp string initially", () => {
    const now = new Date();
    render(<RelativeTime date={now} />);

    const timeElement = screen.getByRole("time");
    expect(timeElement).toBeInTheDocument();
    expect(timeElement.textContent).toMatch(/less than a minute ago|just now|0 minutes ago/i);
  });

  it("getNextRelativeUpdateDelay calculates correct thresholds and returns null for dates > 24 hours", () => {
    const nowMs = Date.now();

    // 10 seconds ago -> delay should be ~50,000 ms (until 60s mark)
    const tenSecAgo = new Date(nowMs - 10000);
    const delay1 = getNextRelativeUpdateDelay(tenSecAgo);
    expect(delay1).toBeGreaterThan(45000);
    expect(delay1).toBeLessThanOrEqual(50000);

    // 2 days ago -> returns null (no timer needed)
    const twoDaysAgo = new Date(nowMs - 2 * 24 * 60 * 60 * 1000);
    const delay2 = getNextRelativeUpdateDelay(twoDaysAgo);
    expect(delay2).toBeNull();
  });

  it("automatically ticks over relative time string after 61 seconds without page reload", () => {
    const postDate = new Date();
    render(<RelativeTime date={postDate} />);

    // Initial state
    expect(screen.getByRole("time").textContent).toMatch(/less than a minute ago|just now|0 minutes ago/i);

    // Advance fake timers by 61 seconds
    act(() => {
      vi.advanceTimersByTime(61000);
    });

    // Should now automatically update to 1 minute ago!
    expect(screen.getByRole("time").textContent).toMatch(/1 minute ago|1 min ago|about 1 minute ago/i);
  });

  it("renders fallback text for invalid or missing date", () => {
    render(<RelativeTime date={null} fallback="Unknown time" />);
    expect(screen.getByText("Unknown time")).toBeInTheDocument();
  });
});
