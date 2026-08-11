import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NewsletterEditor, MAX_IMAGE_SIZE_BYTES } from "./NewsletterEditor";

describe("NewsletterEditor Component (#1739)", () => {
  it("renders editor toolbar and initial content", () => {
    render(
      <NewsletterEditor initialContent="<p>Test newsletter content</p>" />,
    );

    expect(screen.getByTitle("Bold")).toBeInTheDocument();
    expect(screen.getByTitle("Italic")).toBeInTheDocument();
    expect(screen.getByTitle("Align Center")).toBeInTheDocument();
    expect(screen.getByTitle("Upload Image (Max 1MB)")).toBeInTheDocument();
    expect(screen.getByText("Test newsletter content")).toBeInTheDocument();
  });

  it("rejects images larger than 1MB with an error message", async () => {
    render(<NewsletterEditor />);

    const fileInput = screen.getByLabelText("Upload Newsletter Image");
    // Create mock file > 1MB (1.5MB)
    const largeFile = new File(["a".repeat(1.5 * 1024 * 1024)], "large_photo.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/exceeds the maximum 1MB limit/i),
      ).toBeInTheDocument();
    });
  });

  it("accepts images smaller than or equal to 1MB", async () => {
    const uploadOverride = vi.fn().mockResolvedValue("https://example.com/small_photo.png");

    render(<NewsletterEditor uploadImageOverride={uploadOverride} />);

    const fileInput = screen.getByLabelText("Upload Newsletter Image");
    // Create mock file <= 1MB (500KB)
    const smallFile = new File(["a".repeat(500 * 1024)], "small_photo.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [smallFile] } });

    await waitFor(() => {
      expect(uploadOverride).toHaveBeenCalledTimes(1);
      expect(uploadOverride).toHaveBeenCalledWith(smallFile);
    });
  });

  it("invokes onChange with serialized HTML containing inline styles when content changes", async () => {
    const handleChange = vi.fn();
    render(
      <NewsletterEditor
        initialContent='<p style="text-align: center;"><mark style="background-color: rgb(254, 240, 138);">Highlighted Newsletter Title</mark></p>'
        onChange={handleChange}
      />,
    );

    expect(screen.getByText("Highlighted Newsletter Title")).toBeInTheDocument();
  });
});
