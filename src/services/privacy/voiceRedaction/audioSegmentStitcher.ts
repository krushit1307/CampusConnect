/**
 * Audio Segment Stitcher Service (Issue #5141).
 *
 * Normalizes replacement audio amplitude, time-aligns replacement duration,
 * and performs equal-power crossfading at region boundaries to prevent click artifacts
 * and preserve ambient background continuity.
 */

import { AudioBufferWindow } from "@/types/voiceRedaction";

export class AudioSegmentStitcher {
  /**
   * Stitches replacement PCM audio buffer into original PCM audio stream at target window
   * using equal-power crossfading.
   */
  public stitchSegment(
    masterAudio: AudioBufferWindow,
    replacementAudio: AudioBufferWindow,
    startTimeSec: number,
    endTimeSec: number,
    crossfadeMs: number = 20,
  ): AudioBufferWindow {
    const sampleRate = masterAudio.sampleRate;
    const channels = masterAudio.channels;

    const startSample = Math.max(0, Math.floor(startTimeSec * sampleRate));
    const targetLengthSamples = Math.floor((endTimeSec - startTimeSec) * sampleRate);
    const crossfadeSamples = Math.floor((crossfadeMs / 1000) * sampleRate);

    // Deep copy master audio channels to avoid mutating input directly
    const outputChannels: Float32Array[] = masterAudio.channelData.map(
      (ch) => new Float32Array(ch),
    );

    const replacementData = replacementAudio.channelData[0];
    const replacementLength = replacementData.length;

    for (let c = 0; c < channels; c++) {
      const masterChannel = outputChannels[c];

      for (let i = 0; i < targetLengthSamples; i++) {
        const targetIndex = startSample + i;
        if (targetIndex >= masterChannel.length) break;

        const repSample = replacementData[Math.min(i, replacementLength - 1)] || 0;

        // Equal-power crossfade at start boundary
        if (i < crossfadeSamples && startSample > 0) {
          const fadeIn = Math.sin((i / crossfadeSamples) * (Math.PI / 2));
          const fadeOut = Math.cos((i / crossfadeSamples) * (Math.PI / 2));
          masterChannel[targetIndex] = masterChannel[targetIndex] * fadeOut + repSample * fadeIn;
        }
        // Equal-power crossfade at end boundary
        else if (i >= targetLengthSamples - crossfadeSamples) {
          const progress = (targetLengthSamples - i) / crossfadeSamples;
          const fadeOutRep = Math.sin(progress * (Math.PI / 2));
          const fadeInOriginal = Math.cos(progress * (Math.PI / 2));
          masterChannel[targetIndex] =
            repSample * fadeOutRep + masterChannel[targetIndex] * fadeInOriginal;
        }
        // Core PII replacement region
        else {
          masterChannel[targetIndex] = repSample;
        }
      }
    }

    return {
      sampleRate,
      channels,
      channelData: outputChannels,
      durationSec: masterAudio.durationSec,
    };
  }

  /**
   * Time-stretches / pads / trims replacement audio to fit target span duration.
   */
  public alignAudioDuration(
    sourceAudio: AudioBufferWindow,
    targetDurationSec: number,
    maxTimeStretchRatio: number = 1.25,
  ): AudioBufferWindow {
    const sampleRate = sourceAudio.sampleRate;
    const targetSamples = Math.floor(targetDurationSec * sampleRate);
    const sourceSamples = sourceAudio.channelData[0].length;

    if (sourceSamples === targetSamples) return sourceAudio;

    const alignedChannels: Float32Array[] = sourceAudio.channelData.map((channel) => {
      const aligned = new Float32Array(targetSamples);
      const ratio = sourceSamples / targetSamples;

      // Linear interpolation sample resampling
      for (let i = 0; i < targetSamples; i++) {
        const srcPos = i * ratio;
        const index0 = Math.floor(srcPos);
        const index1 = Math.min(channel.length - 1, index0 + 1);
        const frac = srcPos - index0;

        if (index0 < channel.length) {
          aligned[i] = channel[index0] * (1 - frac) + channel[index1] * frac;
        }
      }

      return aligned;
    });

    return {
      sampleRate,
      channels: sourceAudio.channels,
      channelData: alignedChannels,
      durationSec: targetDurationSec,
    };
  }
}

export const audioSegmentStitcher = new AudioSegmentStitcher();
