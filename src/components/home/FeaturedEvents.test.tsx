import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { FeaturedEvents } from "./FeaturedEvents";
import { sortFeaturedEvents, type FeaturedEvent } from "./featuredGrid";

// The repo-wide test-setup.ts mocks React's useRef (always null) and runs
// useEffect eagerly during render, which breaks ref-based scroll listeners.
// Restore the real React hooks so the carousel's scroll/snap behaviour is
// exercised against a real ref + effect cycle.
vi.unmock("react");

// Mock framer-motion to a passthrough so we don't need a real animation
// environment in jsdom — keeps the test focused on layout/classes.
// We strip framer-only props (layoutId, etc.) so React doesn't warn about
// unknown DOM attributes during the render assertions.
vi.mock("framer-motion", () => {
  const elements = {
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
  };

  return {
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    m: elements,
    motion: elements,
    useMotionValue: (init: number) => ({
      get: () => init,
      set: vi.fn(),
      onChange: vi.fn(),
    }),
    useSpring: (value: unknown) => value,
    useTransform: (_value: unknown, _input: number[], output: (string | number)[]) => ({
      get: () => output[0] ?? 0,
    }),
  };
});

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

describe("FeaturedEvents — scroll-snap carousel (#2006)", () => {
  afterEach(() => cleanup());

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

  describe("<FeaturedEvents /> rendering", () => {
    beforeEach(() => {
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

    it("renders a native scroll-snap track with a hidden scrollbar", () => {
      renderFeatured([makeEvent({ id: "1", popularity_score: 10 })]);
      const track = screen.getByTestId("featured-events-carousel");
      expect(track.className).toContain("overflow-x-auto");
      expect(track.className).toContain("snap-x");
      expect(track.className).toContain("snap-mandatory");
      expect(track.className).toContain("scroll-smooth");
      expect(track.className).toContain("scrollbar-width:none");
    });

    it("lays out cards at 85% width with center snap alignment", () => {
      renderFeatured([makeEvent({ id: "1" }), makeEvent({ id: "2" })]);
      const slides = [
        screen.getByTestId("featured-event-hero"),
        ...screen.getAllByTestId("featured-event-slide"),
      ];
      for (const slide of slides) {
        expect(slide.className).toContain("flex-[0_0_85%]");
        expect(slide.className).toContain("snap-center");
      }
    });

    it("caps rendering at 5 slides", () => {
      const events = Array.from({ length: 8 }, (_, i) =>
        makeEvent({ id: `e${i}`, popularity_score: 100 - i }),
      );
      renderFeatured(events);
      const links = screen.getAllByRole("link", { name: /Featured event/i });
      expect(links).toHaveLength(5);
    });

    it("marks the top event as the hero slide with description and badge", () => {
      const events = [
        makeEvent({ id: "hero", popularity_score: 100, description: "Top-tier hackathon" }),
        makeEvent({ id: "b", popularity_score: 50, description: "Big workshop" }),
        makeEvent({ id: "c", popularity_score: 10, description: "Tiny meetup" }),
      ];
      renderFeatured(events);

      expect(screen.getByTestId("featured-event-hero")).toBeInTheDocument();
      expect(screen.getAllByTestId("featured-event-slide")).toHaveLength(2);
      // Hero gets a "Featured" badge; the others do not.
      expect(screen.getAllByText("Featured")).toHaveLength(1);
      // Hero description is rendered; the others are not.
      expect(screen.getByText("Top-tier hackathon")).toBeInTheDocument();
      expect(screen.queryByText("Big workshop")).not.toBeInTheDocument();
      expect(screen.queryByText("Tiny meetup")).not.toBeInTheDocument();
    });

    it("links every slide to /events/<id>", () => {
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

    it("uses object-cover object-center so wide/tall cards never distort the image", () => {
      renderFeatured([
        makeEvent({ id: "hero", banner_url: "https://example.com/b.jpg", popularity_score: 100 }),
      ]);
      const img = screen.getByAltText("Event hero") as HTMLImageElement;
      expect(img.className).toContain("object-cover");
      expect(img.className).toContain("object-center");
    });

    it("shows prev/next controls only on desktop", () => {
      renderFeatured([makeEvent({ id: "1" }), makeEvent({ id: "2" })]);
      const prev = screen.getByRole("button", { name: /Previous featured events/i });
      const next = screen.getByRole("button", { name: /Next featured events/i });
      // Hidden on mobile (natural swiping), prominent on desktop.
      expect(prev.className).toContain("hidden");
      expect(prev.className).toContain("md:inline-flex");
      expect(next.className).toContain("hidden");
      expect(next.className).toContain("md:inline-flex");
    });

    it("navigates with the native scrollBy API when Next/Prev are clicked", () => {
      renderFeatured([
        makeEvent({ id: "e1", popularity_score: 100 }),
        makeEvent({ id: "e2", popularity_score: 50 }),
        makeEvent({ id: "e3", popularity_score: 10 }),
      ]);
      const track = screen.getByTestId("featured-events-carousel");

      // jsdom has no layout, so give the track measurable dimensions and a
      // scroll offset so both buttons become enabled.
      Object.defineProperty(track, "scrollWidth", { configurable: true, value: 1200 });
      Object.defineProperty(track, "clientWidth", { configurable: true, value: 400 });
      Object.defineProperty(track, "scrollLeft", { configurable: true, value: 300 });
      const scrollBy = vi.fn();
      track.scrollBy = scrollBy;
      fireEvent.scroll(track); // recompute the enabled/disabled state

      fireEvent.click(screen.getByRole("button", { name: /Next featured events/i }));
      expect(scrollBy).toHaveBeenCalledWith({ left: 300, behavior: "smooth" });

      fireEvent.click(screen.getByRole("button", { name: /Previous featured events/i }));
      expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: "smooth" });
    });
  });
});
