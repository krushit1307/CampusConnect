/**
 * Campus Meditation & Biofeedback Wellness Pod Utilities
 */

export interface WellnessPodSessionMetrics {
  podId: string;
  heartRateVariabilityScore: number;
  stressReductionIndexPercent: number;
}

/**
 * Calculates biofeedback stress reduction metrics from meditation pod sessions.
 */
export function calculateMeditationPodMetrics(
  initialHeartRate: number,
  postSessionHeartRate: number
): WellnessPodSessionMetrics {
  const diff = Math.max(0, initialHeartRate - postSessionHeartRate);
  const percent = Math.round((diff / initialHeartRate) * 100.0 * 10) / 10;

  return {
    podId: `POD-ZEN-${Math.floor(Math.random() * 50 + 10)}`,
    heartRateVariabilityScore: 82,
    stressReductionIndexPercent: percent,
  };
}
