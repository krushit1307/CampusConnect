export interface PerformanceMetrics {
  fps: number;
  hardwareConcurrency: number;
  effectiveType?: string;
  isBackgroundTab: boolean;
}

export interface PerformanceProfileState {
  reduceAnimations: boolean;
  performanceTier: "HIGH" | "LOW";
  reason?: string;
}

export const LOW_FPS_THRESHOLD = 30;
export const LOW_CPU_CORES_THRESHOLD = 4;

/**
 * Evaluates device performance baseline from hardware specs.
 */
export function evaluateDeviceHardwareBaseline(): { isLowEnd: boolean; cores: number } {
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 4;

  return {
    isLowEnd: cores < LOW_CPU_CORES_THRESHOLD,
    cores,
  };
}

/**
 * Calculates current frame rate (FPS) from frame time delta (in milliseconds).
 */
export function calculateFpsFromDelta(frameTimeDeltaMs: number): number {
  if (frameTimeDeltaMs <= 0) return 60;
  return Math.min(60, Math.round(1000 / frameTimeDeltaMs));
}

/**
 * Determines whether the app should enter low-performance mode (reduce animations).
 */
export function evaluatePerformanceProfile(metrics: PerformanceMetrics): PerformanceProfileState {
  // If the tab is hidden/in background, do not trigger false positive performance degradation
  if (metrics.isBackgroundTab) {
    return {
      reduceAnimations: false,
      performanceTier: "HIGH",
    };
  }

  const isLowFps = metrics.fps < LOW_FPS_THRESHOLD;
  const isLowHardware = metrics.hardwareConcurrency < LOW_CPU_CORES_THRESHOLD;
  const isSlowNetwork = metrics.effectiveType === "2g" || metrics.effectiveType === "slow-2g";

  if (isLowFps || isLowHardware || isSlowNetwork) {
    const reasons: string[] = [];
    if (isLowFps) reasons.push(`FPS dropped below ${LOW_FPS_THRESHOLD} (${metrics.fps})`);
    if (isLowHardware) reasons.push(`Low CPU core count (${metrics.hardwareConcurrency})`);
    if (isSlowNetwork) reasons.push(`Slow connection type (${metrics.effectiveType})`);

    return {
      reduceAnimations: true,
      performanceTier: "LOW",
      reason: reasons.join("; "),
    };
  }

  return {
    reduceAnimations: false,
    performanceTier: "HIGH",
  };
}
