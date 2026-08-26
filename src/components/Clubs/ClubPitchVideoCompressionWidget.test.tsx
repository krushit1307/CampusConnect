import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  ClubPitchVideoCompressionWidget,
  MOCK_COMPLETED_JOB,
} from "./ClubPitchVideoCompressionWidget";

describe("ClubPitchVideoCompressionWidget Component (#4289)", () => {
  it("renders Video Compression Pipeline header, telemetry metrics, and HLS player", () => {
    render(
      <ClubPitchVideoCompressionWidget
        clubName="Computer Science Society"
        initialJob={MOCK_COMPLETED_JOB}
      />
    );

    expect(screen.getByText(/"Club Pitch" Video Compression Pipeline — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText("Raw S3 Upload")).toBeInTheDocument();
    expect(screen.getByText("Compressed HLS Size")).toBeInTheDocument();
    expect(screen.getByText("Bandwidth Savings")).toBeInTheDocument();
    expect(screen.getByText("Transcoded HLS Video Player — Join Computer Science Society! (60-Sec 4K Pitch)")).toBeInTheDocument();
  });

  it("displays correct compression ratio and raw file purge status", () => {
    render(
      <ClubPitchVideoCompressionWidget
        clubName="Computer Science Society"
        initialJob={MOCK_COMPLETED_JOB}
      />
    );

    expect(screen.getByText("500.0 MB")).toBeInTheDocument();
    expect(screen.getByText("24.5 MB")).toBeInTheDocument();
    expect(screen.getByText("95.1%")).toBeInTheDocument();
    expect(screen.getByText(/Raw Upload Purged/i)).toBeInTheDocument();
  });

  it("simulates 500MB raw upload and triggers transcoding callback", async () => {
    vi.useFakeTimers();
    const handleCompleted = vi.fn();

    render(
      <ClubPitchVideoCompressionWidget
        clubName="Computer Science Society"
        initialJob={null}
        onJobCompleted={handleCompleted}
      />
    );

    const uploadBtn = screen.getByRole("button", { name: /Simulate 500MB Raw 4K Upload/i });
    fireEvent.click(uploadBtn);

    expect(screen.getByText(/Serverless Transcoding Pipeline Active.../i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    expect(handleCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "raw_file_purged",
      })
    );

    vi.useRealTimers();
  });
});
