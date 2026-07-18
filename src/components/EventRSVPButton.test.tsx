import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EventRSVPButton } from "./EventRSVPButton";

describe("EventRSVPButton", () => {
  it("renders the RSVP action for an unsigned state", () => {
    const markup = renderToStaticMarkup(
      <EventRSVPButton
        eventId="event-1"
        user={{ id: "user-1" }}
        hasRsvpd={false}
        isPending={false}
        onToggle={vi.fn()}
      />,
    );
    expect(markup).toContain("RSVP →");
    expect(markup).toContain('aria-pressed="false"');
  });

  it("renders a disabled pending state", () => {
    const markup = renderToStaticMarkup(
      <EventRSVPButton
        eventId="event-1"
        user={{ id: "user-1" }}
        hasRsvpd
        isPending
        onToggle={vi.fn()}
      />,
    );
    expect(markup).toContain("Updating...");
    expect(markup).toContain("disabled");
  });
});
