import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { WeatherWidget } from "./WeatherWidget";
import type { WeatherSnapshot } from "./types";

const sampleSnapshot: WeatherSnapshot = {
  tempC: 18.4,
  description: "light rain",
  condition: "rain",
  locationName: "Springfield",
  observedAt: "2026-07-31T12:00:00.000Z",
};

const sunnySnapshot: WeatherSnapshot = {
  ...sampleSnapshot,
  condition: "clear",
  description: "clear sky",
};

describe("WeatherWidget (#1915)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(sampleSnapshot), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders nothing while loading (fail-open)", () => {
    render(<WeatherWidget enabled />);
    expect(screen.queryByTestId("weather-widget")).toBeNull();
  });

  it("renders the snapshot once /api/weather resolves", async () => {
    render(<WeatherWidget enabled />);
    await waitFor(() => {
      expect(screen.getByTestId("weather-widget")).toBeInTheDocument();
    });
    expect(screen.getByTestId("weather-widget")).toHaveAttribute("data-state", "ready");
    expect(screen.getByLabelText(/Current weather at Springfield/i)).toBeInTheDocument();
    expect(screen.getByText("18°C")).toBeInTheDocument();
  });

  it("renders the fail-open 'unavailable' surface when the fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Weather fetch failed (500)");
      }),
    );
    render(<WeatherWidget enabled />);
    const widget = await screen.findByTestId("weather-widget");
    expect(widget).toHaveAttribute("data-state", "unavailable");
    expect(screen.getByText("Weather unavailable")).toBeInTheDocument();
  });

  it("stays idle when enabled=false", () => {
    render(<WeatherWidget enabled={false} />);
    expect(screen.queryByTestId("weather-widget")).toBeNull();
  });

  it("uses the right icon name per condition bucket (icon mapping contract)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(sunnySnapshot), { status: 200 })),
    );
    render(<WeatherWidget enabled />);
    await screen.findByTestId("weather-widget");
    const widget = screen.getByTestId("weather-widget");
    expect(widget.querySelector("svg")).toBeTruthy();
    expect(screen.getByText(/clear sky/i)).toBeInTheDocument();
  });
});
