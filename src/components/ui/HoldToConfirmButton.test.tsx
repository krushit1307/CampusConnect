import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function mock(this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function mock(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  });
});

describe("HoldToConfirmButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders with default text and SVG progress circle", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm}>Delete Club</HoldToConfirmButton>);

    const button = screen.getByRole("button", { name: /Delete Club/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByTestId("hold-progress-svg")).toBeInTheDocument();
    expect(screen.getByTestId("hold-progress-circle")).toBeInTheDocument();
  });

  it("triggers onConfirm after holding for full duration (3000ms)", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm}>Delete Club</HoldToConfirmButton>);

    const button = screen.getByRole("button", { name: /Delete Club/i });

    // Press down
    fireEvent.mouseDown(button);
    expect(onConfirm).not.toHaveBeenCalled();

    // Fast-forward 2999ms -> still not called
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Fast-forward remaining 1ms -> total 3000ms -> should execute onConfirm
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("snaps back and does NOT trigger onConfirm if released before 3000ms (e.g. 1000ms)", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm}>Delete Club</HoldToConfirmButton>);

    const button = screen.getByRole("button", { name: /Delete Club/i });

    // Press down
    fireEvent.mouseDown(button);

    // Advance 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Release mouse
    fireEvent.mouseUp(button);

    // Advance past remaining duration
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // onConfirm must NOT have been called
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels hold if mouse leaves button area before duration completes", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm}>Delete Club</HoldToConfirmButton>);

    const button = screen.getByRole("button", { name: /Delete Club/i });

    fireEvent.mouseDown(button);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    fireEvent.mouseLeave(button);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("handles touch events (onTouchStart / onTouchEnd / onTouchCancel)", () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm}>Delete Club</HoldToConfirmButton>);

    const button = screen.getByRole("button", { name: /Delete Club/i });

    // Start touch
    fireEvent.touchStart(button);

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    // Touch end early
    fireEvent.touchEnd(button);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onConfirm).not.toHaveBeenCalled();

    // Full touch hold
    fireEvent.touchStart(button);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("bypasses hold animation and opens fallback confirmation modal on keyboard Enter keypress", () => {
    const onConfirm = vi.fn();
    render(
      <HoldToConfirmButton
        onConfirm={onConfirm}
        confirmTitle="Delete Club Modal?"
        confirmDescription="Are you sure you want to delete this club?"
      >
        Delete Club
      </HoldToConfirmButton>,
    );

    const button = screen.getByRole("button", { name: /Delete Club/i });

    // Press Enter key on focused button
    fireEvent.keyDown(button, { key: "Enter" });

    // Modal should be opened with fallback title and description
    expect(screen.getByText("Delete Club Modal?")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this club?")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    // Click modal confirm button
    const confirmModalBtn = screen.getByRole("button", { name: /Confirm/i });
    fireEvent.click(confirmModalBtn);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("opens fallback modal on keyboard Space keypress", () => {
    const onConfirm = vi.fn();
    render(
      <HoldToConfirmButton onConfirm={onConfirm} confirmTitle="Confirm Action">
        Delete Club
      </HoldToConfirmButton>,
    );

    const button = screen.getByRole("button", { name: /Delete Club/i });

    fireEvent.keyDown(button, { key: " " });

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("does not trigger hold or open modal when disabled", () => {
    const onConfirm = vi.fn();
    render(
      <HoldToConfirmButton onConfirm={onConfirm} disabled>
        Delete Club
      </HoldToConfirmButton>,
    );

    const button = screen.getByRole("button", { name: /Delete Club/i });
    expect(button).toBeDisabled();

    fireEvent.mouseDown(button);
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.keyDown(button, { key: "Enter" });
    expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
  });
});
