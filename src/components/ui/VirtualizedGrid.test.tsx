import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { VirtualizedGrid } from "./VirtualizedGrid";

// Setup ResizeObserver mock for virtualizer testing environment
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

beforeEach(() => {
  global.ResizeObserver = MockResizeObserver as any;
});

describe("VirtualizedGrid Component", () => {
  const mockItems = Array.from({ length: 30 }, (_, i) => ({
    id: `club-${i}`,
    name: `Club ${i}`,
    desc: `Description for club ${i}`,
  }));

  it("renders virtual items within scrollable viewport boundary container", () => {
    render(
      <VirtualizedGrid
        items={mockItems}
        itemHeight={200}
        gap={16}
        renderItem={(item) => <div data-testid={item.id}>{item.name}</div>}
      />,
    );

    // Bounding container should be rendered
    const container = screen.getByTestId("virtualized-grid-container");
    expect(container).toBeInTheDocument();

    // Verify first few virtual grid items are present in DOM
    expect(screen.getByTestId("virtual-grid-item-0")).toBeInTheDocument();
    expect(screen.getByTestId("club-0")).toHaveTextContent("Club 0");

    expect(screen.getByTestId("virtual-grid-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("club-1")).toHaveTextContent("Club 1");
  });
});
