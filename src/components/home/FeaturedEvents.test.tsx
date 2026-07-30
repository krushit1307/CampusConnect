import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { FeaturedEvents } from "./FeaturedEvents";
import {
  pickFeaturedSlot,
  sortFeaturedEvents,
  FEATURED_SLOT_CLASSES,
  type FeaturedEvent,
} from "./featuredGrid";

// Mock framer-motion to a passthrough so we don't need a real animation
// environment in jsdom — keeps the test focused on layout/classes.
// We strip framer-only props (layoutId, etc.) so React doesn't warn about
// unknown DOM attributes during the render assertions.
vi.mock("framer-motion", () => ({
  motion: {
    img: ({
      children,
      layoutId,
      ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { layoutId?: string }) => (
      <img {...props}>{children}</img>
    ),
    div: ({
      children,
      layoutId,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { layoutId?: string }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

// framer-motion's `motion` typing is opaque to React's JSX without an
// import; alias the typing here so the mock above compiles cleanly.
import type React from "react";

function makeEvent(overrides: Partial<FeaturedEvent> = {}): FeaturedEvent {
  // Default title tracks the id so test queries by id/title stay readable.
  const id = overrides.id ?? "evt";
  return {
    id,
    title: overrides.title ?? `Event ${id}`,
    description: overrides.description ?? null,
    event_date: overrides.event_date ?? "2026-09-01T10:00:00Z",
    banner_url: overrides.banner_url ?? null,
    popularity_score: overrides.popularity_score ?? 0,
    is_featured: overrides.is_featured ?? false,
    clubs: overrides.clubs ?? { name: "Test Club" },
  };
}

function renderFeatured(events: FeaturedEvent[]) {
  return render(
    <BrowserRouter>
      <FeaturedEvents events={events} />
    </BrowserRouter>,
  );
}

describe("FeaturedEvents — magazine grid (#1852)", () => {
  afterEach(() => cleanup());

  describe("pickFeaturedSlot", () => {
    it("returns 'standard' for an empty feed", () => {
      expect(pickFeaturedSlot(makeEvent({ id: "x" }), 0, 0, [])).toBe("standard");
    });

    it("makes a single event the hero so the section never looks half-empty", () => {
      const e = makeEvent({ id: "solo" });
      expect(pickFeaturedSlot(e, 0, 1, [e])).toBe("hero");
    });

    it("makes both of two events heroes (2x 2x2 fills a 4-col row)", () => {
      const a = makeEvent({ id: "a" });
      const b = makeEvent({ id: "b" });
      expect(pickFeaturedSlot(a, 0, 2, [a, b])).toBe("hero");
      expect(pickFeaturedSlot(b, 1, 2, [a, b])).toBe("hero");
    });

    it("picks hero + landscape + portrait + standard for the first five slots", () => {
      const events = [
        makeEvent({ id: "1", popularity_score: 100 }),
        makeEvent({ id: "2", popularity_score: 80 }),
        makeEvent({ id: "3", popularity_score: 60 }),
        makeEvent({ id: "4", popularity_score: 40 }),
        makeEvent({ id: "5", popularity_score: 20 }),
      ];

      expect(pickFeaturedSlot(events[0], 0, 5, events)).toBe("hero");
      expect(pickFeaturedSlot(events[1], 1, 5, events)).toBe("featured-landscape");
      expect(pickFeaturedSlot(events[2], 2, 5, events)).toBe("featured-portrait");
      expect(pickFeaturedSlot(events[3], 3, 5, events)).toBe("standard");
      expect(pickFeaturedSlot(events[4], 4, 5, events)).toBe("standard");
    });
  });

  describe("sortFeaturedEvents", () => {
    it("promotes explicitly featured events to the top regardless of score", () => {
      const events = [makeEvent({ id: "low" }), makeEvent({ id: "featured", is_featured: true })];
      const sorted = sortFeaturedEvents(events);
      expect(sorted[0].id).toBe("featured");
      expect(sorted[1].id).toBe("low");
    });

    it("sorts by popularity_score desc, ties broken by soonest event_date", () => {
      const events = [
        makeEvent({ id: "soon-low", popularity_score: 5, event_date: "2026-08-01T10:00:00Z" }),
        makeEvent({ id: "far-high", popularity_score: 100, event_date: "2027-01-01T10:00:00Z" }),
        makeEvent({ id: "soon-mid", popularity_score: 50, event_date: "2026-09-01T10:00:00Z" }),
      ];
      const sorted = sortFeaturedEvents(events);
      expect(sorted.map((e) => e.id)).toEqual(["far-high", "soon-mid", "soon-low"]);
    });

    it("treats missing popularity_score as zero", () => {
      const events = [
        makeEvent({ id: "no-score", popularity_score: null }),
        makeEvent({ id: "scored", popularity_score: 1 }),
      ];
      const sorted = sortFeaturedEvents(events);
      expect(sorted[0].id).toBe("scored");
      expect(sorted[1].id).toBe("no-score");
    });

    it("returns a new array — does not mutate the input", () => {
      const events = [makeEvent({ id: "a" }), makeEvent({ id: "b" })];
      const original = [...events];
      sortFeaturedEvents(events);
      expect(events).toEqual(original);
    });
  });

  describe("FEATURED_SLOT_CLASSES", () => {
    it("every slot falls back to a 1x1 single-column mobile layout", () => {
      for (const cls of Object.values(FEATURED_SLOT_CLASSES)) {
        // Mobile: must include the unprefixed col-span-1 row-span-1 so dense
        // grids collapse to a vertical stack below the md breakpoint.
        expect(cls).toContain("col-span-1");
        expect(cls).toContain("row-span-1");
      }
    });

    it("only hero, landscape, and portrait carry md: spans", () => {
      expect(FEATURED_SLOT_CLASSES.standard).not.toMatch(/md:/);
      expect(FEATURED_SLOT_CLASSES["featured-landscape"]).toMatch(/md:col-span-2 md:row-span-1/);
      expect(FEATURED_SLOT_CLASSES["featured-portrait"]).toMatch(/md:col-span-1 md:row-span-2/);
      expect(FEATURED_SLOT_CLASSES.hero).toMatch(/md:col-span-2 md:row-span-2/);
    });
  });

  describe("<FeaturedEvents /> rendering", () => {
    beforeEach(() => {
      // matchMedia isn't fully wired in jsdom — FeaturedEvents doesn't use it
      // (the parent route does), but stub it anyway for safety.
      if (!window.matchMedia) {
        Object.defineProperty(window, "matchMedia", {
          writable: true,
          value: vi.fn().mockImplementation((query: string) => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
          })),
        });
      }
    });

    it("renders nothing when the feed is empty", () => {
      const { container } = renderFeatured([]);
      expect(container.firstChild).toBeNull();
    });

    it("renders the dense magazine grid container with grid-flow-dense", () => {
      renderFeatured([makeEvent({ id: "1", popularity_score: 10 })]);
      const grid = screen.getByTestId("featured-events-grid");
      expect(grid.className).toContain("grid");
      expect(grid.className).toContain("grid-cols-1");
      expect(grid.className).toContain("md:grid-cols-4");
      // The whole point of #1852's dense packing:
      expect(grid.className).toContain("md:grid-flow-dense");
    });

    it("caps rendering at 5 tiles so the grid stays tightly packed", () => {
      const events = Array.from({ length: 8 }, (_, i) =>
        makeEvent({ id: `e${i}`, popularity_score: 100 - i }),
      );
      renderFeatured(events);
      // Hero + landscape + portrait + 2 standard = 5 cards rendered.
      const tiles = screen.getAllByRole("link", { name: /Featured event/i });
      expect(tiles).toHaveLength(5);
    });

    it("applies the correct span classes per slot tier", () => {
      const events = [
        makeEvent({ id: "hero", popularity_score: 100 }),
        makeEvent({ id: "land", popularity_score: 80 }),
        makeEvent({ id: "port", popularity_score: 60 }),
        makeEvent({ id: "std1", popularity_score: 40 }),
      ];
      renderFeatured(events);

      const hero = screen.getByTestId("featured-event-hero");
      expect(hero.className).toMatch(/md:col-span-2 md:row-span-2/);

      const land = screen.getByTestId("featured-event-featured-landscape");
      expect(land.className).toMatch(/md:col-span-2 md:row-span-1/);

      const port = screen.getByTestId("featured-event-featured-portrait");
      expect(port.className).toMatch(/md:col-span-1 md:row-span-2/);

      const std = screen.getByTestId("featured-event-standard");
      expect(std.className).not.toMatch(/md:col-span-/);
    });

    it("renders the hero description and 'Featured' badge on the hero card only", () => {
      // Need 3+ events so only index 0 becomes the hero; with 2 events both
      // collapse into the hero slot (intentional fallback in pickFeaturedSlot).
      const events = [
        makeEvent({
          id: "hero",
          popularity_score: 100,
          description: "Top-tier hackathon",
        }),
        makeEvent({ id: "land", popularity_score: 50, description: "Big workshop" }),
        makeEvent({ id: "std", popularity_score: 10, description: "Tiny meetup" }),
      ];
      renderFeatured(events);

      // Hero gets a "Featured" badge; landscape + standard do not.
      expect(screen.getAllByText("Featured")).toHaveLength(1);
      // Hero description is rendered; others are not.
      expect(screen.getByText("Top-tier hackathon")).toBeInTheDocument();
      expect(screen.queryByText("Big workshop")).not.toBeInTheDocument();
      expect(screen.queryByText("Tiny meetup")).not.toBeInTheDocument();
    });

    it("links every tile to /events/<id>", () => {
      renderFeatured([
        makeEvent({ id: "alpha", popularity_score: 50 }),
        makeEvent({ id: "beta", popularity_score: 30 }),
      ]);
      expect(
        screen.getByRole("link", { name: /Featured event: Event alpha/i }).getAttribute("href"),
      ).toBe("/events/alpha");
      expect(
        screen.getByRole("link", { name: /Featured event: Event beta/i }).getAttribute("href"),
      ).toBe("/events/beta");
    });

    it("uses object-cover object-center so wide/tall tiles never distort the image", () => {
      renderFeatured([
        makeEvent({ id: "hero", banner_url: "https://example.com/b.jpg", popularity_score: 100 }),
      ]);
      const img = screen.getByAltText("Event hero") as HTMLImageElement;
      expect(img.className).toContain("object-cover");
      expect(img.className).toContain("object-center");
    });
  });
});
