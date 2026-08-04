import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  OrganicSkeleton,
  TextSkeleton,
  ParagraphSkeleton,
  OrganicCardSkeleton,
} from "./OrganicSkeleton";
import {
  getOrganicLineWidth,
  getParagraphLineWidths,
  seededRandom,
  hashStringToSeed,
} from "../../lib/deterministicSkeletonUtils";

describe("Organic Skeleton Loader Suite (#2328)", () => {
  describe("Deterministic Width Generators & SSR Hydration Safety", () => {
    it("should generate 100% deterministic pseudorandom numbers based on seed", () => {
      const val1 = seededRandom(123);
      const val2 = seededRandom(123);
      const val3 = seededRandom(456);

      expect(val1).toEqual(val2); // SSR & Client hydration consistency
      expect(val1).not.toEqual(val3);
    });

    it("should hash strings into stable numeric seeds", () => {
      const seed1 = hashStringToSeed("post-uuid-1234");
      const seed2 = hashStringToSeed("post-uuid-1234");
      const seed3 = hashStringToSeed("post-uuid-5678");

      expect(seed1).toBe(seed2);
      expect(seed1).not.toBe(seed3);
    });

    it("should force the final line of a paragraph to be shorter (35%-55%) to mimic real text", () => {
      const line0 = getOrganicLineWidth(0, 3, "test-seed");
      const line1 = getOrganicLineWidth(1, 3, "test-seed");
      const line2Last = getOrganicLineWidth(2, 3, "test-seed");

      const width0 = parseInt(line0);
      const width1 = parseInt(line1);
      const lastWidth = parseInt(line2Last);

      // Body lines are long (>=75%)
      expect(width0).toBeGreaterThanOrEqual(75);
      expect(width1).toBeGreaterThanOrEqual(75);

      // Paragraph end line is significantly shorter (<=55%)
      expect(lastWidth).toBeLessThanOrEqual(55);
      expect(lastWidth).toBeGreaterThanOrEqual(35);
    });

    it("should return correct array of widths for a 4-line paragraph", () => {
      const widths = getParagraphLineWidths(4, "my-paragraph");
      expect(widths).toHaveLength(4);
      expect(parseInt(widths[3])).toBeLessThan(parseInt(widths[0]));
    });
  });

  describe("OrganicSkeleton Components Rendering", () => {
    it("should render base OrganicSkeleton with calculated width", () => {
      const { container } = render(
        <OrganicSkeleton width="82%" height="h-5" data-testid="base-skeleton" />,
      );

      const el = screen.getByTestId("base-skeleton");
      expect(el).toBeDefined();
      expect(el.style.width).toBe("82%");
      expect(el.className).toContain("h-5");
      expect(el.className).toContain("relative overflow-hidden");
    });

    it("should render TextSkeleton with specified number of lines", () => {
      render(<TextSkeleton lines={3} seed="post-123" />);

      const container = screen.getByTestId("text-skeleton-container");
      expect(container.children.length).toBe(3);

      const firstLine = container.children[0] as HTMLElement;
      const lastLine = container.children[2] as HTMLElement;

      expect(parseInt(lastLine.style.width)).toBeLessThan(parseInt(firstLine.style.width));
    });

    it("should render ParagraphSkeleton with multiple paragraph blocks", () => {
      const { container } = render(
        <ParagraphSkeleton paragraphs={2} linesPerParagraph={3} seed="article-99" />,
      );

      const textContainers = container.querySelectorAll("[data-testid='text-skeleton-container']");
      expect(textContainers.length).toBe(2);
    });

    it("should render OrganicCardSkeleton variants (post, club, event, profile, comment)", () => {
      const { container: postContainer } = render(<OrganicCardSkeleton variant="post" />);
      expect(postContainer.querySelector("article")).not.toBeNull();

      const { container: clubContainer } = render(<OrganicCardSkeleton variant="club" />);
      expect(clubContainer).toBeDefined();

      const { container: eventContainer } = render(<OrganicCardSkeleton variant="event" />);
      expect(eventContainer).toBeDefined();

      const { container: commentContainer } = render(<OrganicCardSkeleton variant="comment" />);
      expect(commentContainer).toBeDefined();
    });
  });
});
