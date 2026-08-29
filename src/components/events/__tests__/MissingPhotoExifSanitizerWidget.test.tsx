import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MissingPhotoExifSanitizerWidget } from "../MissingPhotoExifSanitizerWidget";

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      insert: () => Promise.resolve({ data: null, error: null }),
    }),
  }),
}));

// Mock canvas & image orientation utilities
vi.mock("@/utils/exifOrientation", () => ({
  getExifOrientation: () => Promise.resolve(1),
  correctImageOrientation: (url: string) => Promise.resolve(url),
}));

describe("MissingPhotoExifSanitizerWidget Component", () => {
  it("renders widget header and upload dropzone", () => {
    render(
      <MissingPhotoExifSanitizerWidget
        photoTaskId="task-1"
        eventId="evt-1"
        eventTitle="Campus Spring Gala"
      />,
    );

    expect(screen.getByText("Automated Missing Photo EXIF Stripper")).toBeInTheDocument();
    expect(screen.getByText("Campus Spring Gala")).toBeInTheDocument();
    expect(screen.getByText("Select or Drop Missing Event Photo")).toBeInTheDocument();
  });

  it("inspects EXIF metadata when a file is selected", async () => {
    render(
      <MissingPhotoExifSanitizerWidget
        photoTaskId="task-1"
        eventId="evt-1"
        eventTitle="Campus Spring Gala"
      />,
    );

    const file = new File(["dummy data"], "photo_location.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByTestId("exif-file-input");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("photo_location.jpg")).toBeInTheDocument();
      expect(screen.getByText(/GPS: 40.7128° N/i)).toBeInTheDocument();
    });
  });

  it("executes EXIF metadata stripping when sanitize button is clicked", async () => {
    render(
      <MissingPhotoExifSanitizerWidget
        photoTaskId="task-1"
        eventId="evt-1"
        eventTitle="Campus Spring Gala"
      />,
    );

    const file = new File(["dummy data"], "photo_location.jpg", { type: "image/jpeg" });
    const fileInput = screen.getByTestId("exif-file-input");

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId("strip-exif-btn")).toBeInTheDocument();
    });

    const stripBtn = screen.getByTestId("strip-exif-btn");
    fireEvent.click(stripBtn);

    await waitFor(() => {
      expect(screen.getByTestId("stripping-audit-card")).toBeInTheDocument();
      expect(screen.getByText(/Privacy Protected/i)).toBeInTheDocument();
    });
  });
});
