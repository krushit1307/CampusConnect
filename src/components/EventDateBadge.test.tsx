import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { EventDateBadge } from "./EventDateBadge";

describe("EventDateBadge", () => {
  it("shows TBA when no event date is available", () => {
    const markup = renderToStaticMarkup(<EventDateBadge eventDate={null} />);
    expect(markup).toContain("TBA");
  });

  it("renders a formatted date", () => {
    const markup = renderToStaticMarkup(<EventDateBadge eventDate="2026-07-20T10:00:00.000Z" />);
    expect(markup).not.toContain("TBA");
  });

  describe("Accessibility", () => {
    it("should have no accessibility violations when date is null", async () => {
      const { container } = render(<EventDateBadge eventDate={null} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have no accessibility violations when date is provided", async () => {
      const { container } = render(<EventDateBadge eventDate="2026-07-20T10:00:00.000Z" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper aria-label when date is null", () => {
      const { container } = render(<EventDateBadge eventDate={null} />);
      const badge = container.querySelector("p");
      expect(badge).toBeInTheDocument();
      expect(badge?.getAttribute("aria-label")).toContain("Event date:");
      expect(badge?.getAttribute("aria-label")).toContain("TBA");
    });

    it("should have proper aria-label when date is provided", () => {
      const { container } = render(<EventDateBadge eventDate="2026-07-20T10:00:00.000Z" />);
      const badge = container.querySelector("p");
      expect(badge).toBeInTheDocument();
      expect(badge?.getAttribute("aria-label")).toContain("Event date:");
      expect(badge?.textContent).toBeTruthy();
    });
  });
});
