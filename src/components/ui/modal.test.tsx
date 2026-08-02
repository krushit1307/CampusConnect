// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { Modal } from "./modal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function mock(this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function mock(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  });
});

describe("Modal Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
  });

  it("does not render as open when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    const dialog = screen.queryByRole("dialog", { hidden: true });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveAttribute("open");
  });

  it("calls onClose when the native close event fires (e.g., Escape key)", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent(dialog, new Event("close"));
    
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking outside the dialog boundaries", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    
    // Mock getBoundingClientRect
    dialog.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      right: 500,
      top: 100,
      bottom: 500,
      width: 400,
      height: 400,
      x: 100,
      y: 100,
      toJSON: () => {}
    }));

    // Click outside (e.clientX = 50)
    fireEvent.click(dialog, { clientX: 50, clientY: 50 });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the dialog boundaries", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <button>Inside Button</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    
    dialog.getBoundingClientRect = vi.fn(() => ({
      left: 100,
      right: 500,
      top: 100,
      bottom: 500,
      width: 400,
      height: 400,
      x: 100,
      y: 100,
      toJSON: () => {}
    }));

    // Click inside (e.clientX = 200)
    fireEvent.click(dialog, { clientX: 200, clientY: 200 });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("handles dynamic opening and closing", () => {
    const { rerender } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog).not.toHaveAttribute("open");

    // Open
    rerender(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
    expect(dialog).toHaveAttribute("open");

    // Close
    rerender(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1);
    expect(dialog).not.toHaveAttribute("open");
  });
});
