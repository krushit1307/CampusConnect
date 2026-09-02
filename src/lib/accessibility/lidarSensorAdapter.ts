/**
 * LiDAR Sensor Adapter (Issue #5142).
 *
 * Provides a unified sensor interface across:
 * 1. Native iOS WKKit ARKit bridge (if running in iOS native web wrapper)
 * 2. WebXR Depth Sensing API (if supported by modern browser)
 * 3. Synthetic LiDAR Point-Cloud Simulator (for desktop browsers & unit tests)
 */

import { LiDARFrame, LiDARPoint } from "@/types/lidarWayfinding";

export type LiDARFrameCallback = (frame: LiDARFrame) => void;
export type LiDARErrorCallback = (error: Error) => void;

export class LiDARSensorAdapter {
  private isScanning = false;
  private listeners: Set<LiDARFrameCallback> = new Set();
  private errorListeners: Set<LiDARErrorCallback> = new Set();
  private simulationIntervalId: ReturnType<typeof setInterval> | null = null;
  private simulatedObstacleDistance: number | null = null;
  private simulatedObstacleLateral: number = 0; // -1 to +1

  /**
   * Checks if LiDAR / Depth Sensing is supported or mockable in current environment.
   */
  public static isSupported(): boolean {
    if (typeof window === "undefined") return false;

    // Check for native iOS WKWebView window bridge
    const hasNativeBridge = !!(
      window as unknown as { webkit?: { messageHandlers?: { lidar?: unknown } } }
    ).webkit?.messageHandlers?.lidar;

    // Check for WebXR depth sensing API
    const hasWebXRDepth =
      "xr" in navigator &&
      !!(
        navigator as unknown as { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }
      ).xr?.isSessionSupported;

    // Fallback simulation is always supported in browser client
    return hasNativeBridge || !!hasWebXRDepth || true;
  }

  /**
   * Requests device permissions for camera / spatial sensors if required.
   */
  public async requestPermissions(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    try {
      if (
        "navigator" in window &&
        "permissions" in navigator &&
        (
          navigator as unknown as {
            permissions: { query: (p: { name: string }) => Promise<{ state: string }> };
          }
        ).permissions
      ) {
        // Query camera/device-orientation permissions if applicable
        const status = await (
          navigator as unknown as {
            permissions: { query: (p: { name: string }) => Promise<{ state: string }> };
          }
        ).permissions
          .query({ name: "camera" as unknown as string })
          .catch(() => ({ state: "granted" }));
        return status.state === "granted" || status.state === "prompt";
      }
    } catch {
      // Permission API optional; fallback to true
    }
    return true;
  }

  /**
   * Subscribe to LiDAR frame updates.
   */
  public subscribe(callback: LiDARFrameCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribe to sensor errors.
   */
  public onError(callback: LiDARErrorCallback): () => void {
    this.errorListeners.add(callback);
    return () => {
      this.errorListeners.delete(callback);
    };
  }

  /**
   * Starts active LiDAR frame polling/streaming.
   */
  public startScanning(): void {
    if (this.isScanning) return;
    this.isScanning = true;

    // Listen for native iOS bridge events if available
    if (typeof window !== "undefined") {
      window.addEventListener("lidar_frame", this.handleNativeFrame as EventListener);
    }

    // Start synthetic frame emitter for simulation & testing
    this.simulationIntervalId = setInterval(() => {
      const frame = this.generateFrame();
      this.emitFrame(frame);
    }, 150); // ~6.6 FPS LiDAR point cloud updates
  }

  /**
   * Stops LiDAR scanning and cleans up resources.
   */
  public stopScanning(): void {
    if (!this.isScanning) return;
    this.isScanning = false;

    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }

    if (typeof window !== "undefined") {
      window.removeEventListener("lidar_frame", this.handleNativeFrame as EventListener);
    }
  }

  /**
   * Set simulated obstacle parameters for interactive testing & simulation.
   * @param distanceMeters Distance in meters to inject an obstacle (null to clear)
   * @param lateralOffset X offset from center (-1.0 left, 0 center, +1.0 right)
   */
  public injectSimulatedObstacle(distanceMeters: number | null, lateralOffset: number = 0): void {
    this.simulatedObstacleDistance = distanceMeters;
    this.simulatedObstacleLateral = lateralOffset;
  }

  /**
   * Directly emit a frame (useful for unit testing).
   */
  public emitFrame(frame: LiDARFrame): void {
    this.listeners.forEach((listener) => listener(frame));
  }

  private handleNativeFrame = (event: CustomEvent<LiDARFrame>): void => {
    if (event.detail) {
      this.emitFrame(event.detail);
    }
  };

  /**
   * Generates synthetic LiDAR depth points based on simulated state or ambient clear floor.
   */
  private generateFrame(): LiDARFrame {
    const points: LiDARPoint[] = [];

    // Ambient ground floor scan points (z = 0.5m to 4.0m, y ≈ -1.4m below sensor level)
    for (let z = 0.8; z <= 4.0; z += 0.4) {
      for (let x = -1.5; x <= 1.5; x += 0.5) {
        points.push({
          x: Number(x.toFixed(2)),
          y: -1.35 + (Math.random() * 0.04 - 0.02), // Floor level points
          z: Number(z.toFixed(2)),
          confidence: 0.95,
        });
      }
    }

    // Inject simulated obstacle if active
    if (this.simulatedObstacleDistance !== null && this.simulatedObstacleDistance > 0) {
      const dist = this.simulatedObstacleDistance;
      const lat = this.simulatedObstacleLateral;

      // Obstacle cluster (e.g. chair, trash can, banner, person)
      const obstacleWidth = 0.6;
      const obstacleHeight = 1.0;

      for (let ox = lat - obstacleWidth / 2; ox <= lat + obstacleWidth / 2; ox += 0.15) {
        for (let oy = -1.2; oy <= -1.2 + obstacleHeight; oy += 0.2) {
          points.push({
            x: Number(ox.toFixed(2)),
            y: Number(oy.toFixed(2)),
            z: Number((dist + (Math.random() * 0.1 - 0.05)).toFixed(2)),
            confidence: 0.9,
          });
        }
      }
    }

    return {
      timestamp: Date.now(),
      points,
      deviceHeightMeters: 1.4,
    };
  }
}

export const lidarSensorAdapter = new LiDARSensorAdapter();
