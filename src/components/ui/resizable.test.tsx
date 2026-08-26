import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createRef } from "react";

import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./resizable";

let rafId = 0;
beforeEach(() => {
  rafId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rafId++;
    cb(rafId);
    return rafId;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Mock react-resizable-panels since its components require real DOM layout
vi.mock("react-resizable-panels", () => {
  type MockProps = Record<string, any>;

  const Group = vi.fn(({ children, className, id, "data-testid": testId, ...props }: MockProps) => {
    return (
      <div className={className} id={id} data-testid={testId} data-mock-panel-group="" {...props}>
        {children}
      </div>
    );
  });

  const Panel = vi.fn(({ children, className, id, "data-testid": testId, ...props }: MockProps) => {
    return (
      <div className={className} id={id} data-testid={testId} data-mock-panel="" {...props}>
        {children}
      </div>
    );
  });

  const Separator = vi.fn(
    ({ children, className, id, "data-testid": testId, elementRef, ...props }: MockProps) => {
      return (
        <div
          ref={elementRef}
          className={className}
          id={id}
          data-testid={testId}
          role="separator"
          tabIndex={0}
          data-mock-separator=""
          {...props}
        >
          {children}
        </div>
      );
    },
  );

  return { Group, Panel, Separator };
});

describe("ResizablePanelGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children correctly", () => {
    render(
      <ResizablePanelGroup>
        <ResizablePanel>Panel 1</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Panel 2</ResizablePanel>
      </ResizablePanelGroup>,
    );

    expect(screen.getByText("Panel 1")).toBeInTheDocument();
    expect(screen.getByText("Panel 2")).toBeInTheDocument();
  });

  it("includes an aria-live region for screen reader announcements", () => {
    const { container } = render(
      <ResizablePanelGroup>
        <ResizablePanel>Panel 1</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Panel 2</ResizablePanel>
      </ResizablePanelGroup>,
    );

    const liveRegions = container.querySelectorAll('[role="status"]');
    expect(liveRegions.length).toBeGreaterThanOrEqual(1);

    const groupAnnouncer = (
      liveRegions[0]?.parentElement?.querySelector("[data-mock-panel-group]")
        ? liveRegions[0]
        : liveRegions[1]
    ) as HTMLElement;
    expect(groupAnnouncer).toHaveAttribute("aria-live", "polite");
    expect(groupAnnouncer).toHaveAttribute("aria-atomic", "true");
    expect(groupAnnouncer).toHaveClass("sr-only");
  });

  it("announces panel sizes via onLayout callback", () => {
    const { container } = render(
      <ResizablePanelGroup>
        <ResizablePanel>Panel 1</ResizablePanel>
        <ResizableHandle />
        <ResizablePanel>Panel 2</ResizablePanel>
      </ResizablePanelGroup>,
    );

    const groupAnnouncer = container.querySelector(":scope > [role='status']") as HTMLElement;
    expect(groupAnnouncer).toBeInTheDocument();
  });

  it("accepts and applies custom className", () => {
    render(
      <ResizablePanelGroup className="custom-class">
        <ResizablePanel>Content</ResizablePanel>
      </ResizablePanelGroup>,
    );

    const group = document.querySelector("[data-mock-panel-group]");
    expect(group).toHaveClass("custom-class");
  });

  it("passes additional props to Group", () => {
    render(
      <ResizablePanelGroup id="test-group">
        <ResizablePanel>Content</ResizablePanel>
      </ResizablePanelGroup>,
    );

    const group = document.querySelector("[data-mock-panel-group]");
    expect(group).toHaveAttribute("id", "test-group");
  });
});

describe("ResizablePanel", () => {
  it("renders children", () => {
    render(<ResizablePanel>Panel Content</ResizablePanel>);
    expect(screen.getByText("Panel Content")).toBeInTheDocument();
  });

  it("accepts and applies className", () => {
    render(<ResizablePanel className="custom-panel">Content</ResizablePanel>);

    const panel = document.querySelector("[data-mock-panel]");
    expect(panel).toHaveClass("custom-panel");
  });
});

describe("ResizableHandle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with tabIndex={0} for keyboard focusability", () => {
    render(<ResizableHandle />);

    const handle = document.querySelector("[data-mock-separator]");
    expect(handle).toBeInTheDocument();
    expect(handle).toHaveAttribute("tabindex", "0");
  });

  it("renders with role separator", () => {
    render(<ResizableHandle />);

    const handle = screen.getByRole("separator");
    expect(handle).toBeInTheDocument();
  });

  it("renders with an aria-label describing the control", () => {
    render(<ResizableHandle />);

    const handle = screen.getByRole("separator");
    expect(handle).toHaveAttribute("aria-label", "Drag to resize or use arrow keys");
  });

  it("includes an aria-live region for screen reader announcements", () => {
    const { container } = render(<ResizableHandle />);

    const liveRegion = container.querySelector(":scope > [role='status']") as HTMLElement;
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveClass("sr-only");
  });

  it("renders with visual handle when withHandle is true", () => {
    const { container } = render(<ResizableHandle withHandle />);

    const handle = document.querySelector("[data-mock-separator]");
    expect(handle).toBeInTheDocument();
    const gripIcon = container.querySelector("svg");
    expect(gripIcon).toBeInTheDocument();
  });

  it("forwards elementRef to the underlying separator", () => {
    const ref = createRef<HTMLDivElement>();

    render(<ResizableHandle elementRef={ref} />);

    expect(ref.current).toBeInTheDocument();
    expect(ref.current).toHaveAttribute("data-mock-separator");
  });

  it("announces panel resize on arrow key press", () => {
    const { container } = render(<ResizableHandle />);

    const handle = screen.getByRole("separator");
    const liveRegion = container.querySelector(":scope > [role='status']") as HTMLElement;

    handle.setAttribute("aria-valuenow", "75");
    act(() => {
      fireEvent.keyDown(handle, { key: "ArrowLeft" });
    });

    expect(liveRegion).toHaveTextContent(/Panel resized to 75 percent/i);
  });

  it("does not announce on non-arrow key press", () => {
    const { container } = render(<ResizableHandle />);

    const handle = screen.getByRole("separator");
    const liveRegion = container.querySelector(":scope > [role='status']") as HTMLElement;

    fireEvent.keyDown(handle, { key: "Tab" });
    expect(liveRegion).toHaveTextContent("");
  });

  it("applies custom className", () => {
    render(<ResizableHandle className="custom-handle" />);

    const handle = document.querySelector("[data-mock-separator]");
    expect(handle).toHaveClass("custom-handle");
  });

  it("passes additional props to Separator", () => {
    render(<ResizableHandle id="test-handle" disabled />);

    const handle = document.querySelector("[data-mock-separator]");
    expect(handle).toHaveAttribute("id", "test-handle");
    expect(handle).toHaveAttribute("disabled");
  });
});
