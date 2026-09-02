// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpatialWayfindingPanel } from "@/components/accessibility/SpatialWayfindingPanel";

describe("SpatialWayfindingPanel (accessibility)", () => {
  it("renders keyboard-accessible controls with accessible names", () => {
    render(<SpatialWayfindingPanel />);

    const start = screen.getByRole("button", { name: /start navigation/i });
    const stop = screen.getByRole("button", { name: /stop navigation/i });
    const destination = screen.getByRole("combobox", { name: /destination/i });

    expect(start).toBeEnabled();
    expect(stop).toBeDisabled();
    expect(destination).toBeEnabled();
  });

  it("announces the idle state through a live region", () => {
    render(<SpatialWayfindingPanel />);

    const live = screen.getByRole("status");
    expect(live).toHaveTextContent(/select a destination and press start navigation/i);
  });

  it("announces navigation status updates asynchronously", async () => {
    render(<SpatialWayfindingPanel />);

    const live = screen.getByRole("status");
    fireEvent.click(screen.getByRole("button", { name: /start navigation/i }));

    await waitForText(live, /target is approximately 7\.1 meters ahead and to your right/i);

    expect(screen.getByRole("button", { name: /stop navigation/i })).toBeEnabled();
  });

  it("stops navigation and returns the live region to the stopped message", async () => {
    render(<SpatialWayfindingPanel />);

    const live = screen.getByRole("status");
    fireEvent.click(screen.getByRole("button", { name: /start navigation/i }));
    await waitForText(live, /target is approximately/i);

    fireEvent.click(screen.getByRole("button", { name: /stop navigation/i }));

    expect(live).toHaveTextContent(/spatial wayfinding is stopped/i);
    expect(screen.getByRole("button", { name: /start navigation/i })).toBeEnabled();
  });
});

async function waitForText(element: HTMLElement, pattern: RegExp, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pattern.test(element.textContent ?? "")) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for text ${pattern} in "$${element.textContent}"`);
}
