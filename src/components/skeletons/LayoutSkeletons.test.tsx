import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  FeedSkeleton,
  DirectorySkeleton,
  DetailSkeleton,
  PageSkeletonLoader,
} from "./LayoutSkeletons";

describe("Layout Skeletons (#1736)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders FeedSkeleton layout structure correctly", () => {
    render(<FeedSkeleton />);
    expect(screen.getByTestId("feed-skeleton")).toBeInTheDocument();
  });

  it("renders DirectorySkeleton layout structure correctly", () => {
    render(<DirectorySkeleton />);
    expect(screen.getByTestId("directory-skeleton")).toBeInTheDocument();
  });

  it("renders DetailSkeleton layout structure correctly", () => {
    render(<DetailSkeleton />);
    expect(screen.getByTestId("detail-skeleton")).toBeInTheDocument();
  });

  it("PageSkeletonLoader matches /feed route and renders FeedSkeleton after delay", () => {
    render(
      <MemoryRouter initialEntries={["/feed"]}>
        <PageSkeletonLoader delayMs={200} />
      </MemoryRouter>,
    );

    // Before 200ms, should NOT render skeleton to avoid flash
    expect(screen.queryByTestId("feed-skeleton")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("feed-skeleton")).toBeInTheDocument();
  });

  it("PageSkeletonLoader matches /clubs route and renders DirectorySkeleton after delay", () => {
    render(
      <MemoryRouter initialEntries={["/clubs"]}>
        <PageSkeletonLoader delayMs={200} />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("directory-skeleton")).toBeInTheDocument();
  });

  it("PageSkeletonLoader matches /events/event-123 detail route and renders DetailSkeleton after delay", () => {
    render(
      <MemoryRouter initialEntries={["/events/event-123"]}>
        <PageSkeletonLoader delayMs={200} />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("detail-skeleton")).toBeInTheDocument();
  });

  it("PageSkeletonLoader respects forcedLayout prop", () => {
    render(
      <MemoryRouter initialEntries={["/any-route"]}>
        <PageSkeletonLoader forcedLayout="detail" delayMs={200} />
      </MemoryRouter>,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByTestId("detail-skeleton")).toBeInTheDocument();
  });
});
