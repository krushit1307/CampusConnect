import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

// Problematic component for testing error boundary behavior
function ProblematicWidget({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Simulated widget failure");
  }
  return <div data-testid="widget-content">Widget operating normally</div>;
}

describe("WidgetErrorBoundary Component (#1737)", () => {
  // Suppress console.error calls during intentional error boundary testing
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("renders child content normally when no error occurs", () => {
    render(
      <WidgetErrorBoundary title="Upcoming Events">
        <ProblematicWidget shouldThrow={false} />
      </WidgetErrorBoundary>,
    );

    expect(screen.getByTestId("widget-content")).toBeInTheDocument();
    expect(screen.getByText("Widget operating normally")).toBeInTheDocument();
  });

  it("catches child component error and displays localized WidgetErrorFallback UI without crashing parent", () => {
    render(
      <div data-testid="parent-container">
        <h1>Dashboard Header</h1>
        <WidgetErrorBoundary title="Upcoming Events">
          <ProblematicWidget shouldThrow={true} />
        </WidgetErrorBoundary>
        <div>Other Dashboard Content</div>
      </div>,
    );

    // Parent elements must still render!
    expect(screen.getByText("Dashboard Header")).toBeInTheDocument();
    expect(screen.getByText("Other Dashboard Content")).toBeInTheDocument();

    // Localized error fallback must be visible
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Events")).toBeInTheDocument();
    expect(screen.getByText(/Simulated widget failure/i)).toBeInTheDocument();
  });

  it("resets error state when Retry button is clicked", () => {
    function TestContainer() {
      const [shouldThrow, setShouldThrow] = useState(true);
      return (
        <WidgetErrorBoundary title="Test Widget" onReset={() => setShouldThrow(false)}>
          <ProblematicWidget shouldThrow={shouldThrow} />
        </WidgetErrorBoundary>
      );
    }

    render(<TestContainer />);

    expect(screen.getByRole("alert")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn);

    // Should re-render normal widget content
    expect(screen.getByTestId("widget-content")).toBeInTheDocument();
  });

  it("disables retry button when maxRetries threshold is reached", () => {
    render(
      <WidgetErrorBoundary title="Max Retry Widget" maxRetries={2}>
        <ProblematicWidget shouldThrow={true} />
      </WidgetErrorBoundary>,
    );

    const retryBtn1 = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn1);

    const retryBtn2 = screen.getByRole("button", { name: /Retry/i });
    fireEvent.click(retryBtn2);

    // After 2 retries, maxRetries is reached
    expect(screen.getByText(/Max retries reached/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/i })).not.toBeInTheDocument();
  });
});
