import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  DragToDismissLightbox,
  DISMISS_OFFSET_THRESHOLD,
  DISMISS_VELOCITY_THRESHOLD,
} from "./DragToDismissLightbox";

describe("DragToDismissLightbox Component (#1751)", () => {
  const sampleImage = "https://images.unsplash.com/photo-1540575467063-178a50c2df87";

  it("renders lightbox image when open", () => {
    render(
      <DragToDismissLightbox
        src={sampleImage}
        alt="Campus Concert Photo"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText("Campus Concert Photo")).toBeInTheDocument();
    expect(screen.getByText(/Swipe down to dismiss/i)).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(
      <DragToDismissLightbox
        src={sampleImage}
        alt="Campus Concert Photo"
        isOpen={false}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onClose when user clicks the Close X button", () => {
    const handleClose = vi.fn();
    render(
      <DragToDismissLightbox
        src={sampleImage}
        alt="Campus Concert Photo"
        isOpen={true}
        onClose={handleClose}
      />,
    );

    const closeBtn = screen.getByRole("button", { name: /Close lightbox/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("toggles zoom state when zoom button is clicked and hides drag hint", () => {
    render(
      <DragToDismissLightbox
        src={sampleImage}
        alt="Campus Concert Photo"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    const zoomBtn = screen.getByRole("button", { name: /Zoom in/i });
    fireEvent.click(zoomBtn);

    // Zoomed in: button switches to Zoom out and drag hint is hidden
    expect(screen.getByRole("button", { name: /Zoom out/i })).toBeInTheDocument();
    expect(screen.queryByText(/Swipe down to dismiss/i)).not.toBeInTheDocument();
  });
});
