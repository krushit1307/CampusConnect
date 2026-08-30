/**
 * Acoustic Wayfinding Controller (Issue #5142).
 *
 * Coordinates indoor UWB wayfinding with LiDAR obstacle avoidance:
 * 1. Manages navigation lifecycle & venue layout routing state.
 * 2. Connects LiDAR Sensor Adapter frame stream to LiDAR Obstacle Detector.
 * 3. Triggers aggressive STOP haptic override (`navigator.vibrate`) on hazard.
 * 4. Speaks debounced, concise TTS warnings via Web Speech API (`window.speechSynthesis`).
 * 5. Resumes normal wayfinding guidance once obstacle corridor clears.
 */

import { LiDARSensorAdapter, lidarSensorAdapter } from "@/lib/accessibility/lidarSensorAdapter";
import { LiDARObstacleDetector, lidarObstacleDetector } from "@/services/lidarObstacleDetector";
import {
  AcousticWayfindingState,
  HazardSeverity,
  LidarObstacle,
  LiDARFrame,
  WayfindingAudioConfig,
} from "@/types/lidarWayfinding";

export type StateListener = (state: AcousticWayfindingState) => void;

export const DEFAULT_AUDIO_CONFIG: WayfindingAudioConfig = {
  speechEnabled: true,
  hapticsEnabled: true,
  speechRate: 1.0,
  speechVolume: 1.0,
  voiceCooldownMs: 4000, // 4-second debouncing between warnings for same obstacle
};

export class AcousticWayfindingController {
  private adapter: LiDARSensorAdapter;
  private detector: LiDARObstacleDetector;
  private audioConfig: WayfindingAudioConfig;

  private state: AcousticWayfindingState = {
    isNavigating: false,
    isLidarActive: false,
    lidarSupported: true,
    permissionGranted: true,
    currentVenueId: null,
    currentVenueName: null,
    userPosition: null,
    targetDestination: null,
    currentInstruction: null,
    activeObstacle: null,
    hazardSeverity: "none",
    safetyOverrideActive: false,
    lastVoiceWarningTime: 0,
    errorMessage: null,
  };

  private stateListeners: Set<StateListener> = new Set();
  private unsubscribeSensor: (() => void) | null = null;
  private unsubscribeSensorError: (() => void) | null = null;
  private hapticIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastSpokenText: string | null = null;

  constructor(
    adapter: LiDARSensorAdapter = lidarSensorAdapter,
    detector: LiDARObstacleDetector = lidarObstacleDetector,
    audioConfig: Partial<WayfindingAudioConfig> = {},
  ) {
    this.adapter = adapter;
    this.detector = detector;
    this.audioConfig = { ...DEFAULT_AUDIO_CONFIG, ...audioConfig };

    this.state.lidarSupported = LiDARSensorAdapter.isSupported();
  }

  /**
   * Subscribe to controller state changes.
   */
  public subscribe(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Current controller state snapshot.
   */
  public getState(): AcousticWayfindingState {
    return { ...this.state };
  }

  /**
   * Update audio/haptic preferences.
   */
  public setAudioConfig(config: Partial<WayfindingAudioConfig>): void {
    this.audioConfig = { ...this.audioConfig, ...config };
  }

  /**
   * Start acoustic navigation for a specific venue layout and destination.
   */
  public async startNavigation(
    venueId: string,
    venueName: string,
    destination: string,
    initialInstruction: string = "Head straight towards Main Stage entrance",
  ): Promise<boolean> {
    const hasPermission = await this.adapter.requestPermissions();

    this.updateState({
      isNavigating: true,
      permissionGranted: hasPermission,
      currentVenueId: venueId,
      currentVenueName: venueName,
      targetDestination: destination,
      currentInstruction: initialInstruction,
      errorMessage: hasPermission ? null : "Camera/Spatial sensor permissions restricted",
    });

    // Speak initial route instruction
    if (hasPermission && this.audioConfig.speechEnabled) {
      this.speakText(`Navigation started for ${destination}. ${initialInstruction}.`);
    }

    // Subscribe to LiDAR frame stream
    this.unsubscribeSensor = this.adapter.subscribe(this.handleLiDARFrame);
    this.unsubscribeSensorError = this.adapter.onError((err) => {
      this.updateState({ errorMessage: `LiDAR Sensor Warning: ${err.message}` });
    });

    this.adapter.startScanning();
    this.updateState({ isLidarActive: true });

    return true;
  }

  /**
   * Stop navigation and cleanly release hardware resources.
   */
  public stopNavigation(): void {
    this.stopHapticOverride();

    if (this.unsubscribeSensor) {
      this.unsubscribeSensor();
      this.unsubscribeSensor = null;
    }
    if (this.unsubscribeSensorError) {
      this.unsubscribeSensorError();
      this.unsubscribeSensorError = null;
    }

    this.adapter.stopScanning();

    // Cancel speech synthesis
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignored
      }
    }

    this.updateState({
      isNavigating: false,
      isLidarActive: false,
      activeObstacle: null,
      hazardSeverity: "none",
      safetyOverrideActive: false,
      currentInstruction: null,
    });
  }

  /**
   * Inject simulated obstacle for testing & debugging.
   */
  public injectSimulatedObstacle(distanceMeters: number | null, lateralOffset: number = 0): void {
    this.adapter.injectSimulatedObstacle(distanceMeters, lateralOffset);
  }

  /**
   * LiDAR frame handler callback.
   */
  private handleLiDARFrame = (frame: LiDARFrame): void => {
    if (!this.state.isNavigating) return;

    const obstacle = this.detector.detectObstacle(frame);

    if (obstacle) {
      this.handleObstacleDetected(obstacle);
    } else {
      this.handleObstacleCleared();
    }
  };

  /**
   * Process detected obstacle and activate safety override if hazard is immediate.
   */
  private handleObstacleDetected(obstacle: LidarObstacle): void {
    const isImmediate = obstacle.severity === "immediate_hazard";
    const wasOverrideActive = this.state.safetyOverrideActive;

    this.updateState({
      activeObstacle: obstacle,
      hazardSeverity: obstacle.severity,
      safetyOverrideActive: isImmediate,
    });

    if (isImmediate) {
      // 1. Trigger urgent aggressive pulse haptics
      if (this.audioConfig.hapticsEnabled && !wasOverrideActive) {
        this.triggerAggressiveStopHaptics();
      }

      // 2. Speak urgent voice warning with debouncing
      const now = Date.now();
      const shouldSpeak =
        now - this.state.lastVoiceWarningTime >= this.audioConfig.voiceCooldownMs ||
        this.lastSpokenText !== obstacle.speechDescription;

      if (shouldSpeak && this.audioConfig.speechEnabled) {
        this.speakText(obstacle.speechDescription);
        this.updateState({ lastVoiceWarningTime: now });
        this.lastSpokenText = obstacle.speechDescription;
      }
    }
  }

  /**
   * Clear obstacle state when corridor is free of hazards.
   */
  private handleObstacleCleared(): void {
    if (this.state.activeObstacle !== null || this.state.safetyOverrideActive) {
      this.stopHapticOverride();

      const cleared = this.state.safetyOverrideActive;

      this.updateState({
        activeObstacle: null,
        hazardSeverity: "none",
        safetyOverrideActive: false,
      });

      if (cleared && this.audioConfig.speechEnabled) {
        this.speakText("Path cleared. Resume walking.");
        this.lastSpokenText = "Path cleared. Resume walking.";
      }
    }
  }

  /**
   * Executes aggressive pulse STOP vibration pattern (`[200, 100, 200, 100, 400]`).
   */
  private triggerAggressiveStopHaptics(): void {
    this.stopHapticOverride();

    if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
      try {
        // Immediate aggressive pulse pattern
        navigator.vibrate([200, 100, 200, 100, 400]);

        // Repeat pulse every 1.2s while immediate hazard persists
        this.hapticIntervalId = setInterval(() => {
          if (
            this.state.safetyOverrideActive &&
            typeof navigator !== "undefined" &&
            "vibrate" in navigator
          ) {
            navigator.vibrate([200, 100, 200, 100, 400]);
          } else {
            this.stopHapticOverride();
          }
        }, 1200);
      } catch {
        // Ignored if device lacks vibration permission
      }
    }
  }

  private stopHapticOverride(): void {
    if (this.hapticIntervalId) {
      clearInterval(this.hapticIntervalId);
      this.hapticIntervalId = null;
    }
    if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Speaks text instruction via Web Speech API (`SpeechSynthesisUtterance`).
   */
  private speakText(text: string): void {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    try {
      window.speechSynthesis.cancel(); // Cancel queued spoken phrases

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.audioConfig.speechRate;
      utterance.volume = this.audioConfig.speechVolume;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis unavailable:", e);
    }
  }

  private updateState(partial: Partial<AcousticWayfindingState>): void {
    this.state = { ...this.state, ...partial };
    this.stateListeners.forEach((listener) => listener(this.state));
  }
}

export const acousticWayfindingController = new AcousticWayfindingController();
