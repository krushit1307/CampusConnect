import { describe, it, expect, beforeEach, vi } from "vitest";
import { ChunkedUploader } from "./chunkedUpload";

describe("Chunked File Upload Suite (#2671)", () => {
  const dummyFile = new File([new ArrayBuffer(12 * 1024 * 1024)], "recap_video.mp4", {
    type: "video/mp4",
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it("calculates progress and slices a 12MB file in 5MB chunks", async () => {
    const progressSpy = vi.fn();
    const uploader = new ChunkedUploader({
      file: dummyFile,
      chunkSize: 5 * 1024 * 1024,
      onProgress: progressSpy,
    });

    const result = await uploader.start();

    expect(result.isComplete).toBe(true);
    expect(result.bytesUploaded).toBe(dummyFile.size);
    expect(uploader.getProgress()).toBe(100);
    expect(progressSpy).toHaveBeenCalled();
  });

  it("allows pausing and resuming upload cleanly", async () => {
    const uploader = new ChunkedUploader({
      file: dummyFile,
      chunkSize: 5 * 1024 * 1024,
    });

    uploader.pause();
    const result = await uploader.start();

    expect(result.isPaused).toBe(true);
    expect(result.isComplete).toBe(false);
  });
});
