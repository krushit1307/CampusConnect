import { HapticPayload } from '@/types/accessibilityHaptics';

/**
 * Extracts bass frequency amplitude (20Hz - 100Hz) from FFT frequency data array.
 * Converts raw amplitude into a normalized haptic vibration duration and intensity payload.
 */
export function processAudioFftToHaptics(
  frequencyData: Uint8Array,
  sampleRate: number = 44100,
  fftSize: number = 2048
): HapticPayload {
  const binWidth = sampleRate / fftSize; // Hz per bin (~21.5 Hz at 44.1k/2048)

  // Sub-bass & Bass range: ~20Hz to 100Hz (Bins 1 to 5)
  const bassBinStart = Math.max(1, Math.floor(20 / binWidth));
  const bassBinEnd = Math.min(frequencyData.length - 1, Math.ceil(100 / binWidth));

  let bassSum = 0;
  let bassCount = 0;
  for (let i = bassBinStart; i <= bassBinEnd; i++) {
    bassSum += frequencyData[i];
    bassCount++;
  }
  const avgBass = bassCount > 0 ? Math.round(bassSum / bassCount) : 0;

  // Mid range: 100Hz - 2000Hz
  const midBinEnd = Math.min(frequencyData.length - 1, Math.ceil(2000 / binWidth));
  let midSum = 0;
  let midCount = 0;
  for (let i = bassBinEnd + 1; i <= midBinEnd; i++) {
    midSum += frequencyData[i];
    midCount++;
  }
  const avgMid = midCount > 0 ? Math.round(midSum / midCount) : 0;

  // High range: >2000Hz
  let trebleSum = 0;
  let trebleCount = 0;
  for (let i = midBinEnd + 1; i < frequencyData.length; i++) {
    trebleSum += frequencyData[i];
    trebleCount++;
  }
  const avgTreble = trebleCount > 0 ? Math.round(trebleSum / trebleCount) : 0;

  const intensityPercent = Math.min(100, Math.round((avgBass / 255) * 100));
  // Map bass amplitude to vibration duration: 0 to 120ms
  const vibrationDurationMs = avgBass > 140 ? Math.round((avgBass / 255) * 120) : 0;

  return {
    timestamp: Date.now(),
    bassAmplitude: avgBass,
    midAmplitude: avgMid,
    trebleAmplitude: avgTreble,
    vibrationDurationMs,
    intensityPercent,
    frequencyBand: avgBass > 180 ? 'sub_bass' : 'bass',
  };
}

/**
 * Triggers native hardware vibration via Navigator.vibrate if supported on device.
 */
export function triggerDeviceVibration(durationMs: number) {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      if (durationMs > 0) {
        navigator.vibrate(durationMs);
      }
    } catch (e) {
      // Ignored if device does not permit vibration without user gesture
    }
  }
}
