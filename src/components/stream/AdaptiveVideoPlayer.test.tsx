import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  AdaptiveVideoPlayer,
  MOCK_FAST_NETWORK,
  MOCK_UNSTABLE_WIFI,
} from "./AdaptiveVideoPlayer";

describe("AdaptiveVideoPlayer Component (#3586)", () => {
  it("renders stream title, quality status badge, and network diagnostics panel", () => {
    render(
      <AdaptiveVideoPlayer
        streamTitle="Virtual Tech Leaders Panel"
        initialNetworkState={MOCK_FAST_NETWORK}
      />
    );

    expect(screen.getByText("Virtual Tech Leaders Panel")).toBeInTheDocument();
    expect(screen.getByTestId("quality-badge")).toHaveTextContent("1080p");
    expect(screen.getByText("Network & Buffer Diagnostics")).toBeInTheDocument();
    expect(screen.getByText("8.5 Mbps")).toBeInTheDocument();
  });

  it("opens quality settings menu and allows selecting a manual resolution", () => {
    const handleQualityChange = vi.fn();
    render(
      <AdaptiveVideoPlayer
        streamTitle="Virtual Tech Leaders Panel"
        initialNetworkState={MOCK_FAST_NETWORK}
        onQualityChange={handleQualityChange}
      />
    );

    const gearBtn = screen.getByRole("button", { name: /Quality settings/i });
    fireEvent.click(gearBtn);

    expect(screen.getByTestId("quality-settings-menu")).toBeInTheDocument();

    const option720p = screen.getByRole("button", { name: /^720p/i });
    fireEvent.click(option720p);

    expect(screen.getByTestId("quality-badge")).toHaveTextContent("Manual: 720p");
    expect(handleQualityChange).toHaveBeenCalled();
  });

  it("automatically degrades quality badge when unstable Wi-Fi is simulated", () => {
    render(
      <AdaptiveVideoPlayer
        streamTitle="Virtual Tech Leaders Panel"
        initialNetworkState={MOCK_FAST_NETWORK}
      />
    );

    const simulateUnstableBtn = screen.getByRole("button", { name: /Unstable Wi-Fi \(1\.2 Mbps\)/i });
    fireEvent.click(simulateUnstableBtn);

    expect(screen.getByTestId("quality-badge")).toHaveTextContent(/480p|360p/);
    expect(screen.getByText("1.2 Mbps")).toBeInTheDocument();
  });
});
