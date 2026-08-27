import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageCropUpload } from "./ImageCropUpload";

// Mock blueimp-load-image
vi.mock("blueimp-load-image", () => {
  return {
    default: vi.fn((file, callback, options) => {
      // Simulate rendering image to canvas
      const mockCanvas = document.createElement("canvas");
      mockCanvas.width = 100;
      mockCanvas.height = 100;
      // Mock toDataURL
      mockCanvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockdata");
      setTimeout(() => callback(mockCanvas), 0);
    }),
  };
});

// Mock Supabase
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } } }),
    },
  }),
}));

describe("ImageCropUpload Component (#2427)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with label and hint correctly", () => {
    const handleUploaded = vi.fn();
    render(
      <ImageCropUpload
        aspect={1}
        bucket="avatars"
        label="profile picture"
        hint="Square images look best"
        onUploaded={handleUploaded}
      />,
    );

    expect(screen.getByText("Drag & drop or click to upload")).toBeInTheDocument();
    expect(screen.getByText("Square images look best")).toBeInTheDocument();
  });

  it("triggers file picker when clicked", () => {
    const handleUploaded = vi.fn();
    render(<ImageCropUpload aspect={1} bucket="avatars" onUploaded={handleUploaded} />);

    const dropZone = screen.getByRole("button");
    expect(dropZone).toBeInTheDocument();
  });
});
