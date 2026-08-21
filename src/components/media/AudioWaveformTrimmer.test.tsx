import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { AudioWaveformTrimmer } from "./AudioWaveformTrimmer";

// The real loader spawns a Vite `?worker` Web Worker, which is not available
// in jsdom. Stub the loader so the component test focuses on the trimmer UI.
vi.mock("@/lib/audio/waveformLoader", () => ({
  computeWaveformPeaks: vi.fn(async () => ({
    peaks: [0.5, 0.8, 0.3, 0.2, 0.9, 0.4, 0.6],
    duration: 10,
    sampleRate: 44100,
  })),
}));

const ctx2d = {
  scale: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
};

function makeAudioFile(name = "clip.mp3"): File {
  const bytes = new Uint8Array(16).fill(1);
  return new File([bytes], name, { type: "audio/mpeg" });
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    ctx2d as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 100,
    bottom: 50,
    width: 100,
    height: 50,
    toJSON: () => ({}),
  } as DOMRect);

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => 96,
  });

  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();

  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function selectFile(file: File = makeAudioFile()) {
  const input = screen.getByTestId("audio-waveform-file-input");
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByTestId("trim-start-thumb");
}

describe("AudioWaveformTrimmer (#2399)", () => {
  it("renders the upload picker when no file is loaded", () => {
    render(<AudioWaveformTrimmer />);
    expect(screen.getByTestId("audio-waveform-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("trim-start-thumb")).not.toBeInTheDocument();
  });

  it("decodes a selected file into a waveform with two trim thumbs", async () => {
    render(<AudioWaveformTrimmer />);

    await selectFile();

    expect(screen.getByTestId("audio-waveform")).toBeInTheDocument();
    expect(screen.getByTestId("trim-start-thumb")).toBeInTheDocument();
    expect(screen.getByTestId("trim-end-thumb")).toBeInTheDocument();
    expect(screen.getByTestId("waveform-play-button")).toBeInTheDocument();
    expect(screen.getByTestId("audio-waveform-audio")).toBeInTheDocument();
    expect(ctx2d.fillRect).toHaveBeenCalled();
  });

  it("reports the initial full-range trim selection", async () => {
    const onTrimChange = vi.fn();
    render(<AudioWaveformTrimmer onTrimChange={onTrimChange} />);

    await selectFile();

    await waitFor(() => {
      const call = onTrimChange.mock.calls.at(-1)?.[0] as
        { trimStartTime: number; trimEndTime: number; duration: number; file: File } | undefined;
      expect(call?.trimStartTime).toBe(0);
      expect(call?.trimEndTime).toBe(10);
      expect(call?.duration).toBe(10);
      expect(call?.file.name).toBe("clip.mp3");
    });
  });

  it("drags the start thumb and emits the new trim start", async () => {
    const onTrimChange = vi.fn();
    render(<AudioWaveformTrimmer onTrimChange={onTrimChange} />);

    await selectFile();

    const startThumb = screen.getByTestId("trim-start-thumb");
    fireEvent.pointerDown(startThumb, { clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 20 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      const call = onTrimChange.mock.calls.at(-1)?.[0] as {
        trimStartTime: number;
      };
      expect(call.trimStartTime).toBeCloseTo(2, 1);
    });

    expect(screen.getByTestId("trim-range-label")).toHaveTextContent(/Trim 00:02\.0/);
  });

  it("moves the thumbs with arrow keys", async () => {
    const onTrimChange = vi.fn();
    render(<AudioWaveformTrimmer onTrimChange={onTrimChange} />);

    await selectFile();

    const startThumb = screen.getByTestId("trim-start-thumb");
    fireEvent.keyDown(startThumb, { key: "ArrowRight" });
    await waitFor(() => {
      const call = onTrimChange.mock.calls.at(-1)?.[0] as {
        trimStartTime: number;
      };
      expect(call.trimStartTime).toBeCloseTo(0.1, 3);
    });

    const endThumb = screen.getByTestId("trim-end-thumb");
    fireEvent.keyDown(endThumb, { key: "ArrowLeft", shiftKey: true });
    await waitFor(() => {
      const call = onTrimChange.mock.calls.at(-1)?.[0] as {
        trimEndTime: number;
      };
      expect(call.trimEndTime).toBeCloseTo(9, 3);
    });
  });

  it("plays the audio region when Play is clicked", async () => {
    render(<AudioWaveformTrimmer />);

    await selectFile();

    fireEvent.click(screen.getByTestId("waveform-play-button"));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
  });

  it("stops playback when the playhead reaches the trim end", async () => {
    const onPlaybackStateChange = vi.fn();
    const { container } = render(
      <AudioWaveformTrimmer onPlaybackStateChange={onPlaybackStateChange} />,
    );

    await selectFile();

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();

    fireEvent.timeUpdate(audio!, { target: { currentTime: 10 } });

    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    await waitFor(() => {
      expect(onPlaybackStateChange).toHaveBeenLastCalledWith(false);
    });
  });

  it("exposes the internal audio element on mount", () => {
    const onAudioElementMount = vi.fn();
    render(<AudioWaveformTrimmer onAudioElementMount={onAudioElementMount} />);

    expect(onAudioElementMount).toHaveBeenCalledWith(expect.any(HTMLAudioElement));
  });

  it("rejects non-audio files with an error message", async () => {
    render(<AudioWaveformTrimmer />);

    const input = screen.getByTestId("audio-waveform-file-input");
    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [textFile] } });

    expect(await screen.findByTestId("audio-waveform-error")).toHaveTextContent(
      /Please select an audio file/i,
    );
  });
});
