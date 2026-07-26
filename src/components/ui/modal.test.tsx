// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
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
});
