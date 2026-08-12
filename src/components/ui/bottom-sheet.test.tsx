import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BottomSheet } from "./bottom-sheet";

describe("BottomSheet Component (#1734)", () => {
  it("renders title, description, and children when open", () => {
    render(
      <BottomSheet
        isOpen={true}
        onClose={vi.fn()}
        title="Test Drawer Title"
        description="Test drawer description text"
      >
        <div>Drawer Body Content</div>
      </BottomSheet>,
    );

    expect(screen.getByText("Test Drawer Title")).toBeInTheDocument();
    expect(screen.getByText("Test drawer description text")).toBeInTheDocument();
    expect(screen.getByText("Drawer Body Content")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet isOpen={true} onClose={handleClose} title="Test Drawer" showCloseButton={true}>
        <div>Content</div>
      </BottomSheet>,
    );

    const closeBtn = screen.getByRole("button", { name: /Close drawer/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders with custom snapPoints configuration", () => {
    render(
      <BottomSheet isOpen={true} onClose={vi.fn()} title="SnapPoint Drawer" snapPoints={[0.5, 1]}>
        <div>SnapPoint Body</div>
      </BottomSheet>,
    );

    expect(screen.getByText("SnapPoint Body")).toBeInTheDocument();
  });
});
