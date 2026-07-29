import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "./PullToRefresh";

describe("PullToRefresh Component", () => {
  it("renders children content correctly", () => {
    render(
      <PullToRefresh onRefresh={vi.fn()} isRefreshing={false}>
        <div>Feed Content</div>
      </PullToRefresh>,
    );

    expect(screen.getByText("Feed Content")).toBeInTheDocument();
  });

  it("displays refreshing status when isRefreshing is true", () => {
    render(
      <PullToRefresh onRefresh={vi.fn()} isRefreshing={true}>
        <div>Feed Content</div>
      </PullToRefresh>,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Refreshing...")).toBeInTheDocument();
  });

  it("handles pull indicator status attributes", () => {
    render(
      <PullToRefresh onRefresh={vi.fn()} isRefreshing={false}>
        <div>Feed Content</div>
      </PullToRefresh>,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("Pull to refresh")).toBeInTheDocument();
  });
});
