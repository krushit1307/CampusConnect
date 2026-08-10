import { describe, it, expect } from "vitest";
import {
  clamp,
  formatTime,
  downmixToMono,
  computePeaks,
  normalizePeaks,
  getAudioContextConstructor,
} from "./waveform";

describe("clamp", () => {
  it("returns the value when inside the range", () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });

  it("clamps values below the minimum", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
  });

  it("clamps values above the maximum", () => {
    expect(clamp(2, 0, 1)).toBe(1);
  });
});

describe("formatTime", () => {
  it("formats zero as 00:00.0", () => {
    expect(formatTime(0)).toBe("00:00.0");
  });

  it("formats seconds as mm:ss.t", () => {
    expect(formatTime(62.4)).toBe("01:02.4");
    expect(formatTime(125.5)).toBe("02:05.5");
    expect(formatTime(9.4)).toBe("00:09.4");
  });

  it("treats negative, NaN and non-finite values as zero", () => {
    expect(formatTime(-5)).toBe("00:00.0");
    expect(formatTime(Number.NaN)).toBe("00:00.0");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("00:00.0");
  });
});

describe("downmixToMono", () => {
  it("returns an empty buffer for zero channels", () => {
    expect(downmixToMono([]).length).toBe(0);
  });

  it("returns the same array for a single channel", () => {
    const channel = new Float32Array([0.5, 0.25, -1]);
    expect(downmixToMono([channel])).toBe(channel);
  });

  it("averages multiple channels sample-by-sample", () => {
    const left = new Float32Array([1, 0, -1]);
    const right = new Float32Array([0, 0.5, -0.5]);
    const mono = downmixToMono([left, right]);
    expect(Array.from(mono)).toEqual([0.5, 0.25, -0.75]);
  });
});

describe("computePeaks", () => {
  it("returns an empty array for zero buckets or an empty signal", () => {
    expect(computePeaks(new Float32Array([1, 2]), 0)).toEqual([]);
    expect(computePeaks(new Float32Array(0), 100)).toEqual([]);
  });

  it("returns the absolute peak of each bucket", () => {
    const mono = new Float32Array([0.2, -1, 0.4, 0.5, -0.25, 0.1]);
    // 6 samples across 3 buckets => 2 samples per bucket
    expect(computePeaks(mono, 3)).toEqual([1, 0.5, 0.25]);
  });
});

describe("normalizePeaks", () => {
  it("scales peaks to the [0, 1] range", () => {
    expect(normalizePeaks([2, 1, 3])).toEqual([2 / 3, 1 / 3, 1]);
  });

  it("applies the scale factor", () => {
    expect(normalizePeaks([2, 1, 3], 2)).toEqual([4 / 3, 2 / 3, 2]);
  });

  it("handles an all-silence signal without dividing by zero", () => {
    expect(normalizePeaks([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("getAudioContextConstructor", () => {
  it("returns undefined when no AudioContext is available", () => {
    // jsdom does not ship a Web Audio implementation.
    expect(getAudioContextConstructor()).toBeUndefined();
  });
});
