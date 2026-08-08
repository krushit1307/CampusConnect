/// <reference lib="webworker" />

import { computePeaks, downmixToMono, normalizePeaks } from "@/lib/audio/waveform";

export interface WaveformWorkerRequest {
  fileId: string;
  arrayBuffer: ArrayBuffer;
  bucketCount: number;
}

export interface WaveformWorkerResponse {
  fileId: string;
  peaks: number[];
  duration: number;
  sampleRate: number;
  error?: string;
}

/**
 * AudioWaveform Web Worker (#2399)
 *
 * Decodes the raw audio bytes with an OfflineAudioContext and computes the
 * waveform peaks off the main thread, so decoding a large clip never freezes
 * the UI (issue edge case: heavy CPU/RAM on 10-minute MP3s).
 */
self.onmessage = async (event: MessageEvent<WaveformWorkerRequest>) => {
  const { fileId, arrayBuffer, bucketCount } = event.data;

  try {
    const OfflineAudioCtor = (
      self as unknown as { OfflineAudioContext: typeof OfflineAudioContext }
    ).OfflineAudioContext;

    if (!OfflineAudioCtor) {
      throw new Error("OfflineAudioContext is not available in this worker");
    }

    // 1x1 context is enough to decode; decodeAudioData is independent of
    // the rendering buffer geometry.
    const context = new OfflineAudioCtor(1, 1, 44100);
    const audioBuffer = await context.decodeAudioData(arrayBuffer);

    const channels: Float32Array[] = [];
    for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
      channels.push(audioBuffer.getChannelData(c));
    }

    const mono = downmixToMono(channels);
    const rawPeaks = computePeaks(mono, bucketCount);

    const response: WaveformWorkerResponse = {
      fileId,
      peaks: normalizePeaks(rawPeaks),
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
    };

    self.postMessage(response);
  } catch (error) {
    const response: WaveformWorkerResponse = {
      fileId,
      peaks: [],
      duration: 0,
      sampleRate: 0,
      error: error instanceof Error ? error.message : "Unknown waveform worker error",
    };

    self.postMessage(response);
  }
};
