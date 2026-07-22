import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
});
