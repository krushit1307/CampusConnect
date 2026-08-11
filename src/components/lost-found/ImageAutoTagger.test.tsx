// src/components/lost-found/ImageAutoTagger.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageAutoTagger } from "./ImageAutoTagger";

// Mock the autoTagImage lib function.
vi.mock("@/lib/imageTagger", () => ({
  autoTagImage: vi.fn(),
}));

import { autoTagImage } from "@/lib/imageTagger";
const autoTagImageMock = autoTagImage as ReturnType<typeof vi.fn>;

beforeEach(() => {
  autoTagImageMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImageAutoTagger", () => {
  it("renders the upload zone in the idle state", () => {
    render(<ImageAutoTagger onTagsChange={() => {}} />);
    expect(screen.getByText("Upload a photo of the item")).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop or click/)).toBeInTheDocument();
  });

  it("renders an error message when autoTagImage returns an error", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: false,
      error: { error: "Image compression failed." },
    });

    render(<ImageAutoTagger onTagsChange={() => {}} />);
    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;

    const file = new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Image compression failed.")).toBeInTheDocument();
    });
  });

  it("renders the PII warning when PII is detected", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: true,
      result: {
        tags: [],
        hasPii: true,
        piiReason: "Visible credit card number detected.",
      },
    });

    const onPiiDetected = vi.fn();
    render(<ImageAutoTagger onTagsChange={() => {}} onPiiDetected={onPiiDetected} />);
    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Sensitive Information Detected")).toBeInTheDocument();
      expect(screen.getByText("Visible credit card number detected.")).toBeInTheDocument();
    });
    expect(onPiiDetected).toHaveBeenCalledWith("Visible credit card number detected.");
  });

  it("renders auto-generated tags on success and calls onTagsChange", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: true,
      result: {
        tags: ["water bottle", "blue", "stickers"],
        hasPii: false,
      },
    });

    const onTagsChange = vi.fn();
    render(<ImageAutoTagger onTagsChange={onTagsChange} />);
    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Auto-Generated Tags")).toBeInTheDocument();
      expect(screen.getByText("water bottle")).toBeInTheDocument();
      expect(screen.getByText("blue")).toBeInTheDocument();
      expect(screen.getByText("stickers")).toBeInTheDocument();
    });

    expect(onTagsChange).toHaveBeenCalledWith(["water bottle", "blue", "stickers"]);
  });

  it("allows the user to remove a tag by clicking ×", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: true,
      result: {
        tags: ["water bottle", "blue", "stickers"],
        hasPii: false,
      },
    });

    const onTagsChange = vi.fn();
    render(<ImageAutoTagger onTagsChange={onTagsChange} />);
    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("stickers")).toBeInTheDocument();
    });

    // Click the × on the "stickers" tag.
    const removeBtn = screen.getByLabelText('Remove tag "stickers"');
    fireEvent.click(removeBtn);

    expect(screen.queryByText("stickers")).not.toBeInTheDocument();
    expect(onTagsChange).toHaveBeenLastCalledWith(["water bottle", "blue"]);
  });

  it("shows a re-analyze button after success", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: true,
      result: {
        tags: ["water bottle"],
        hasPii: false,
      },
    });

    render(<ImageAutoTagger onTagsChange={() => {}} />);
    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(100)], "test.jpg", { type: "image/jpeg" })] },
    });

    await waitFor(() => {
      expect(screen.getByText("Re-analyze image")).toBeInTheDocument();
    });
  });
});
