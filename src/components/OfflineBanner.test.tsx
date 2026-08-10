import { render, screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfflineBanner } from "./OfflineBanner";

describe("OfflineBanner", () => {
  it("should not render when online", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("should render with role status when offline event is dispatched", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("No Connection — Showing cached content");
  });
});
