import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "./PullToRefresh.tsx";

describe("PullToRefresh Component (#1917)", () => {
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

  it("uses a 100px activation threshold (#1917 spec)", () => {
    // Source-level regression check so a future drift back to 80px fails CI.
    const src = fs.readFileSync(path.resolve(__dirname, "PullToRefresh.tsx"), "utf8");
    expect(src).toMatch(/ACTIVATION_THRESHOLD\s*=\s*100\b/);
    expect(src).toMatch(/window\.scrollY\s*===\s*0/);
  });
});
