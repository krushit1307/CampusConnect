// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { Modal } from "./modal";

describe("Modal Component", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when pressing the Escape key", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when clicking on the backdrop overlay", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <p>Modal Body Content</p>
      </Modal>,
    );

    const backdrop = screen.getByRole("presentation");
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when clicking inside the modal content", () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <button>Inside Button</button>
      </Modal>,
    );

    const insideButton = screen.getByText("Inside Button");
    fireEvent.click(insideButton);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("loops focus on Tab and Shift+Tab keydown events", () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Focus Loop Modal">
        <button data-testid="first">Button 1</button>
        <button data-testid="second">Button 2</button>
      </Modal>,
    );

    const closeBtn = screen.getByLabelText("Close modal");
    const first = screen.getByTestId("first");
    const second = screen.getByTestId("second");

    // First focusable element should get focused automatically on mount
    expect(document.activeElement).toBe(closeBtn);

    // Tab on the last element wraps focus to the first element (closeBtn)
    second.focus();
    fireEvent.keyDown(second, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);

    // Shift + Tab on the first element wraps focus to the last element
    closeBtn.focus();
    fireEvent.keyDown(closeBtn, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(second);
  });

  it("handles nested modals correctly: only closes the top-most modal on Escape", () => {
    const handleCloseParent = vi.fn();
    const handleCloseChild = vi.fn();

    const NestedModalsComponent = () => {
      const [showChild, setShowChild] = useState(false);
      return (
        <div>
          <Modal isOpen={true} onClose={handleCloseParent} title="Parent Modal">
            <button data-testid="open-child-btn" onClick={() => setShowChild(true)}>
              Open Child
            </button>
            {showChild && (
              <Modal isOpen={true} onClose={handleCloseChild} title="Child Modal">
                <button data-testid="child-btn">Child Focus</button>
              </Modal>
            )}
          </Modal>
        </div>
      );
    };

    render(<NestedModalsComponent />);

    const parentCloseBtn = screen.getByLabelText("Close modal");
    expect(document.activeElement).toBe(parentCloseBtn);

    // Click button to open child modal dynamically
    const openBtn = screen.getByTestId("open-child-btn");
    fireEvent.click(openBtn);

    // Get child close button (it should be the second one in the DOM now since it was appended after parent)
    const closeButtons = screen.getAllByLabelText("Close modal");
    expect(closeButtons.length).toBe(2);
    const childCloseBtn = closeButtons[1];
    expect(document.activeElement).toBe(childCloseBtn);

    // Press Escape key -> should only trigger close of the child modal (top-most in stack)
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleCloseChild).toHaveBeenCalledTimes(1);
    expect(handleCloseParent).not.toHaveBeenCalled();
  });
});
