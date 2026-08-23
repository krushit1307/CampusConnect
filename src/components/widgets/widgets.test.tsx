import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { normalizeWidgetConfig, normalizeWidgetsConfig } from "./types";
import { toSpotifyEmbedUrl } from "./SpotifyWidget";
import { toYouTubeEmbedUrl } from "./YouTubeWidget";
import { getTimeLeft } from "./CountdownWidget";
import { WidgetRenderer } from "./WidgetRenderer";

describe("normalizeWidgetsConfig (#2737)", () => {
  it("returns an empty array for non-array input", () => {
    expect(normalizeWidgetsConfig(null)).toEqual([]);
    expect(normalizeWidgetsConfig("nope")).toEqual([]);
    expect(normalizeWidgetsConfig({ type: "weather" })).toEqual([]);
  });

  it("drops entries with unknown widget types", () => {
    const widgets = normalizeWidgetsConfig([
      { id: "a", type: "weather", location: "London" },
      { id: "b", type: "crypto-miner" },
    ]);
    expect(widgets).toHaveLength(1);
    expect(widgets[0].type).toBe("weather");
  });

  it("fills in a generated id and defaults enabled to true", () => {
    const config = normalizeWidgetConfig({ type: "countdown" });
    expect(config).not.toBeNull();
    expect(config!.id).toMatch(/^widget-/);
    expect(config!.enabled).toBe(true);
  });

  it("keeps only string params that are present", () => {
    const config = normalizeWidgetConfig({
      id: "w1",
      type: "weather",
      enabled: false,
      location: "London",
      videoId: 42,
    });
    expect(config!.location).toBe("London");
    expect(config!.videoId).toBeUndefined();
    expect(config!.enabled).toBe(false);
  });
});

describe("toSpotifyEmbedUrl (#2737)", () => {
  it("normalizes open.spotify.com links to embed URLs", () => {
    expect(toSpotifyEmbedUrl("https://open.spotify.com/playlist/abc123")).toBe(
      "https://open.spotify.com/embed/playlist/abc123",
    );
    expect(toSpotifyEmbedUrl("https://open.spotify.com/album/xyz?theme=0")).toBe(
      "https://open.spotify.com/embed/album/xyz?theme=0",
    );
  });

  it("rejects non-Spotify origins and malformed URLs (iframe security)", () => {
    expect(toSpotifyEmbedUrl("https://evil.example/playlist/abc")).toBeNull();
    expect(toSpotifyEmbedUrl("not a url")).toBeNull();
    expect(toSpotifyEmbedUrl("")).toBeNull();
    expect(toSpotifyEmbedUrl("https://open.spotify.com/playlist/")).toBeNull();
  });
});

describe("toYouTubeEmbedUrl (#2737)", () => {
  it("builds a privacy-enhanced nocookie embed URL for valid ids", () => {
    expect(toYouTubeEmbedUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("rejects ids that are not exactly 11 safe characters", () => {
    expect(toYouTubeEmbedUrl("short")).toBeNull();
    expect(toYouTubeEmbedUrl("../../etc/passwd!!")).toBeNull();
    expect(toYouTubeEmbedUrl("")).toBeNull();
  });
});

describe("getTimeLeft (#2737)", () => {
  it("returns all-zero once the target date has passed", () => {
    expect(getTimeLeft("2000-01-01T00:00:00Z")).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    });
  });

  it("returns null for unparseable dates", () => {
    expect(getTimeLeft("not-a-date")).toBeNull();
  });

  it("computes remaining time for a future date", () => {
    const target = new Date(Date.now() + 2 * 86_400_000 + 3_600_000);
    const left = getTimeLeft(target.toISOString());
    expect(left).not.toBeNull();
    expect(left!.days).toBe(2);
    expect(left!.hours).toBeGreaterThanOrEqual(0);
    expect(left!.hours).toBeLessThanOrEqual(1);
  });
});

describe("WidgetRenderer (#2737)", () => {
  it("renders nothing when no widgets are configured", () => {
    const { container } = render(<WidgetRenderer widgets={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("skips disabled widgets", () => {
    render(
      <WidgetRenderer
        widgets={[{ id: "off", type: "weather", enabled: false, location: "London" }]}
      />,
    );
    expect(screen.queryByText(/Weather unavailable|Loading weather/)).toBeNull();
  });

  it("renders enabled widgets in config order via the registry", () => {
    vi.useFakeTimers();
    render(
      <WidgetRenderer
        widgets={[
          { id: "c1", type: "countdown", enabled: true, title: "Hackathon starts in" },
          { id: "w1", type: "weather", enabled: true, location: "London" },
        ]}
      />,
    );
    expect(screen.getByText("Hackathon starts in")).toBeInTheDocument();
    // Weather fetch is stubbed away; fail-open shows the loading surface.
    expect(screen.getByText("Loading weather...")).toBeInTheDocument();
    const titles = screen.getAllByRole("heading", { level: 3 });
    expect(titles[0]).toHaveTextContent("Hackathon starts in");
    vi.useRealTimers();
  });
});
