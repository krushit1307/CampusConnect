import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AvFallbackBroadcasterDashboard } from "./AvFallbackBroadcasterDashboard";
import { evaluatePresenterPingFailure } from "@/lib/avFallbackBroadcaster";

describe("AvFallbackBroadcasterDashboard Component (#4668)", () => {
  it("renders Fallback Broadcaster header, video monitor canvas, and control panel", () => {
    render(
      <AvFallbackBroadcasterDashboard
        eventTitle="Campus Innovation Summit Keynote"
      />
    );

    expect(screen.getByText(/"Audio\/Visual Check" Fallback Broadcaster — Campus Innovation Summit Keynote/i)).toBeInTheDocument();
    expect(screen.getByText("Live Broadcast Monitor Canvas (Output Stream)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cut to Live/i })).toBeInTheDocument();
  });

  it("displays fallback slate active status when presenter ping check fails", () => {
    const fallbackState = evaluatePresenterPingFailure(false);
    render(<AvFallbackBroadcasterDashboard initialState={fallbackState} />);

    expect(screen.getByText(/Presenter Ping: FAILED \/ AFK/i)).toBeInTheDocument();
    expect(screen.getByText(/"Starting Soon\..." Fallback Slate Loop/i)).toBeInTheDocument();
  });

  it("crossfades stream from fallback slate to live WebRTC feed on Cut to Live click", async () => {
    vi.useFakeTimers();
    const handleSwap = vi.fn();
    const fallbackState = evaluatePresenterPingFailure(false);

    render(
      <AvFallbackBroadcasterDashboard
        initialState={fallbackState}
        onSourceSwapped={handleSwap}
      />
    );

    const cutToLiveBtn = screen.getByRole("button", { name: /Cut to Live/i });
    fireEvent.click(cutToLiveBtn);

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(handleSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSource: "live_webrtc",
        status: "cut_to_live",
      })
    );

    expect(screen.getByText(/Live Presenter WebRTC Stream Active/i)).toBeInTheDocument();

    vi.useRealTimers();
  });
});
