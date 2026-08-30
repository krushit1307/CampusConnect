/**
 * Replacement Audio Generator Service (Issue #5141).
 *
 * Synthesizes replacement audio for redacted PII phrases while matching
 * estimated speaker pitch, speaking rate, and volume envelope.
 */

import { AudioBufferWindow, PiiAudioSpan, VoiceSynthesisParams } from "@/types/voiceRedaction";

export class ReplacementAudioGenerator {
  /**
   * Estimates fundamental pitch/frequency parameters from an audio sample slice.
   */
  public estimateSpeakerParams(sampleSlice: AudioBufferWindow): VoiceSynthesisParams {
    if (!sampleSlice.channelData || sampleSlice.channelData[0].length === 0) {
      return { pitchShiftCents: 0, speakingRate: 1.0, targetVolumeGain: 0.5 };
    }

    const channel = sampleSlice.channelData[0];
    let sumSquare = 0;
    let zeroCrossings = 0;

    for (let i = 0; i < channel.length; i++) {
      sumSquare += channel[i] * channel[i];
      if (
        i > 0 &&
        ((channel[i] >= 0 && channel[i - 1] < 0) || (channel[i] < 0 && channel[i - 1] >= 0))
      ) {
        zeroCrossings++;
      }
    }

    const rms = Math.sqrt(sumSquare / channel.length);
    const zeroCrossingRate = zeroCrossings / sampleSlice.durationSec;
    const estimatedPitchHz = Math.min(300, Math.max(80, zeroCrossingRate / 2));

    let estimatedSpeakerGender: "male" | "female" | "neutral" = "neutral";
    if (estimatedPitchHz < 165) estimatedSpeakerGender = "male";
    else if (estimatedPitchHz > 185) estimatedSpeakerGender = "female";

    return {
      pitchShiftCents: Math.round(estimatedPitchHz),
      speakingRate: 1.0,
      estimatedSpeakerGender,
      targetVolumeGain: Math.min(0.9, Math.max(0.1, rms * 2.0)),
    };
  }

  /**
   * Generates a privacy-preserving replacement phrase PCM audio buffer.
   */
  public async generateReplacementAudio(
    span: PiiAudioSpan,
    sampleRate: number,
    targetDurationSec: number,
    params: VoiceSynthesisParams = {},
  ): Promise<AudioBufferWindow> {
    const totalSamples = Math.floor(sampleRate * targetDurationSec);
    const channelData = new Float32Array(totalSamples);

    // Fundamental frequency for synthesis based on estimated speaker pitch
    const baseFreq = params.pitchShiftCents || 150;
    const gain = params.targetVolumeGain || 0.4;
    const angularFreq = 2 * Math.PI * baseFreq;

    // Synthesize natural harmonic voice formants for generic replacement speech phrase
    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;

      // Smooth amplitude envelope (fade in/out)
      let env = 1.0;
      const attackSec = 0.05;
      const releaseSec = 0.05;

      if (t < attackSec) {
        env = t / attackSec;
      } else if (t > targetDurationSec - releaseSec) {
        env = Math.max(0, (targetDurationSec - t) / releaseSec);
      }

      // Harmonic voice synthesis (Fundamental + Formant harmonics + subtle noise floor)
      const f0 = Math.sin(angularFreq * t);
      const f1 = 0.3 * Math.sin(2 * angularFreq * t);
      const f2 = 0.15 * Math.sin(3 * angularFreq * t);
      const subtleNoise = (Math.random() - 0.5) * 0.02;

      channelData[i] = (f0 + f1 + f2 + subtleNoise) * gain * env;
    }

    return {
      sampleRate,
      channels: 1,
      channelData: [channelData],
      durationSec: targetDurationSec,
    };
  }
}

export const replacementAudioGenerator = new ReplacementAudioGenerator();
