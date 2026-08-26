import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SkeletonCrossfade } from "./SkeletonCrossfade";

describe("SkeletonCrossfade", () => {
  it("renders skeleton when isLoading is true", () => {
    render(
      <SkeletonCrossfade
        isLoading={true}
        skeleton={<div data-testid="skeleton">Loading Skeleton</div>}
      >
        <div data-testid="content">Actual Content</div>
      </SkeletonCrossfade>,
    );

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("renders content when isLoading is false", () => {
    render(
      <SkeletonCrossfade
        isLoading={false}
        skeleton={<div data-testid="skeleton">Loading Skeleton</div>}
      >
        <div data-testid="content">Actual Content</div>
      </SkeletonCrossfade>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  it("applies container custom className and layoutId", () => {
    const { container } = render(
      <SkeletonCrossfade
        isLoading={false}
        skeleton={<div>Skeleton</div>}
        className="custom-container"
        layoutId="test-layout"
      >
        <div>Content</div>
      </SkeletonCrossfade>,
    );

    expect(container.firstElementChild).toHaveClass("custom-container");
  });

  it("handles loading-to-content transition on re-render", () => {
    const { rerender } = render(
      <SkeletonCrossfade
        isLoading={true}
        skeleton={<div data-testid="skeleton">Loading Skeleton</div>}
      >
        <div data-testid="content">Actual Content</div>
      </SkeletonCrossfade>,
    );

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();

    rerender(
      <SkeletonCrossfade
        isLoading={false}
        skeleton={<div data-testid="skeleton">Loading Skeleton</div>}
      >
        <div data-testid="content">Actual Content</div>
      </SkeletonCrossfade>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
