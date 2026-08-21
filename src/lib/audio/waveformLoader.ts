import WaveformWorker from "@/workers/waveform.worker?worker";
import {
  computePeaks,
  decodeAudioArrayBuffer,
  downmixToMono,
  normalizePeaks,
  type WaveformResult,
} from "./waveform";

const WORKER_TIMEOUT_MS = 15_000;

/**
 * Computes waveform peaks for an audio File without blocking the UI thread.
 *
 * Strategy (#2399):
 * 1. Read the file bytes as an ArrayBuffer.
 * 2. Transfer them to the AudioWaveform Web Worker, which decodes them with
 *    an OfflineAudioContext and returns normalized per-bucket peaks.
 * 3. If the worker is unavailable, fails, or times out, fall back to decoding
 *    on the main thread (decodeAudioData is async/off-main-thread in modern
 *    browsers) and computing the peaks synchronously.
 */
export async function computeWaveformPeaks(
  file: File,
  bucketCount: number,
): Promise<WaveformResult> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const result = await computeWithWorker(arrayBuffer, bucketCount);
    if (result) return result;
  } catch (error) {
    console.warn("[waveform] Worker failed, falling back to main thread:", error);
  }

  return computeOnMainThread(arrayBuffer, bucketCount);
}

function computeWithWorker(
  arrayBuffer: ArrayBuffer,
  bucketCount: number,
): Promise<WaveformResult | null> {
  return new Promise((resolve) => {
    let worker: WaveformWorker | null = null;

    const cleanup = () => {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, WORKER_TIMEOUT_MS);

    try {
      worker = new WaveformWorker();
    } catch {
      cleanup();
      resolve(null);
      return;
    }

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as {
        fileId: string;
        peaks: number[];
        duration: number;
        sampleRate: number;
        error?: string;
      };

      if (data.error) {
        cleanup();
        resolve(null);
        return;
      }

      cleanup();
      resolve({
        peaks: data.peaks,
        duration: data.duration,
        sampleRate: data.sampleRate,
      });
    };

    worker.onerror = () => {
      cleanup();
      resolve(null);
    };

    const fileId = `wf-${Date.now()}`;
    worker.postMessage({ fileId, arrayBuffer, bucketCount }, [arrayBuffer]);
  });
}

async function computeOnMainThread(
  arrayBuffer: ArrayBuffer,
  bucketCount: number,
): Promise<WaveformResult> {
  const audioBuffer = await decodeAudioArrayBuffer(arrayBuffer);

  const channels: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  const mono = downmixToMono(channels);
  const rawPeaks = computePeaks(mono, bucketCount);

  return {
    peaks: normalizePeaks(rawPeaks),
    duration: audioBuffer.duration,
    sampleRate: audioBuffer.sampleRate,
  };
}
