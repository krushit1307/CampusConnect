import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TimeAgo } from "./TimeAgo";
import {
  tickGlobalTimeAgo,
  resetTimeAgoRegistry,
  getRegisteredTimeAgoCount,
} from "@/lib/timeAgoRegistry";

describe("TimeAgo Component (Zero React Re-render Formatter)", () => {
  beforeEach(() => {
    resetTimeAgoRegistry();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    resetTimeAgoRegistry();
    vi.useRealTimers();
  });

  it("renders initial timestamp and formats to 'Just now' on mount", () => {
    const now = new Date();
    render(<TimeAgo date={now.toISOString()} />);

    const element = screen.getByText("Just now");
    expect(element).toBeInTheDocument();
  });

  it("updates text to '1 min ago' after 60 seconds without triggering React re-renders", () => {
    let renderCount = 0;
    const TestWrapper = ({ date }: { date: string }) => {
      renderCount++;
      return <TimeAgo date={date} data-testid="time-ago-span" />;
    };

    const pastDate = new Date(Date.now() - 5000); // 5 seconds ago
    const { getByTestId } = render(<TestWrapper date={pastDate.toISOString()} />);

    const span = getByTestId("time-ago-span");
    expect(span.textContent).toBe("Just now");
    expect(renderCount).toBe(1);

    // Advance time by 60 seconds
    vi.advanceTimersByTime(60000);
    tickGlobalTimeAgo();

    // Verify DOM text updated directly
    expect(span.textContent).toBe("1 min ago");

    // CRITICAL: Verify component render count remains 1 (0 React re-renders!)
    expect(renderCount).toBe(1);
  });

  it("unregisters from global timer loop when unmounted", () => {
    const date = new Date().toISOString();
    const { unmount } = render(<TimeAgo date={date} />);

    expect(getRegisteredTimeAgoCount()).toBe(1);

    unmount();

    expect(getRegisteredTimeAgoCount()).toBe(0);
  });
});
