// src/components/lost-found/ImageAutoTagger.integration.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageAutoTagger } from "./ImageAutoTagger";
import { autoTagImage } from "@/lib/imageTagger";

// Mock the autoTagImage lib function.
vi.mock("@/lib/imageTagger", () => ({
  autoTagImage: vi.fn(),
}));

const autoTagImageMock = autoTagImage as ReturnType<typeof vi.fn>;

const uploadMock = vi.fn().mockResolvedValue({ data: { path: "uploads/test.jpg" }, error: null });
const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl: "https://supabase.edu/lost-found/test.jpg" } });

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      }),
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  autoTagImageMock.mockReset();
  uploadMock.mockClear();
  getPublicUrlMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImageAutoTagger Storage Integration", () => {
  it("uploads photo to lost-found bucket and returns publicUrl on success", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: true,
      result: {
        tags: ["red", "bottle"],
        hasPii: false,
      },
    });

    const onTagsChange = vi.fn();
    render(<ImageAutoTagger onTagsChange={onTagsChange} />);

    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;
    const file = new File([new Uint8Array(100)], "red_bottle.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
      expect(getPublicUrlMock).toHaveBeenCalled();
      expect(onTagsChange).toHaveBeenCalledWith(["red", "bottle"], "https://supabase.edu/lost-found/test.jpg");
    });
  });

  it("does not upload photo to storage if PII is detected", async () => {
    autoTagImageMock.mockResolvedValueOnce({
      ok: true,
      result: {
        tags: [],
        hasPii: true,
        piiReason: "Credit Card number spotted.",
      },
    });

    const onTagsChange = vi.fn();
    const onPiiDetected = vi.fn();
    render(<ImageAutoTagger onTagsChange={onTagsChange} onPiiDetected={onPiiDetected} />);

    const input = screen.getByLabelText("Upload item image") as HTMLInputElement;
    const file = new File([new Uint8Array(100)], "pii_image.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onPiiDetected).toHaveBeenCalledWith("Credit Card number spotted.");
      expect(uploadMock).not.toHaveBeenCalled();
      expect(onTagsChange).toHaveBeenCalledWith([], "");
    });
  });
});
