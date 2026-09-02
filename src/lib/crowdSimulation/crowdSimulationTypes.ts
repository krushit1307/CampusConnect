/**
 * Domain types for the Crowd Flow Fluid Dynamics Simulator (#5133)
 */

export type SimNodeType = "entrance" | "exit" | "food_table" | "stage" | "obstacle";

export interface SimNode {
  id: string;
  type: SimNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  attractionWeight: number; // 0 (none) to 2.0 (strong attraction)
  label: string;
}

export interface CrowdSimConfig {
  maxCapacity: number; // Up to 500
  criticalDensityThreshold: number; // Threshold for bottleneck detection
  canvasWidth: number;
  canvasHeight: number;
  particleSpeed: number; // Base speed px/s
  spawnRate: number; // Particles per second
}

export interface BottleneckState {
  detected: boolean;
  zoneId: string | null;
  zoneLabel: string | null;
  density: number;
  recommendation: string | null;
  contributingNodeLabel: string | null;
}

export interface ParticleData {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  targetId: string | null;
}

export const DEFAULT_SIM_CONFIG: CrowdSimConfig = {
  maxCapacity: 150,
  criticalDensityThreshold: 0.0035, // particles per sq pixel in critical radius
  canvasWidth: 800,
  canvasHeight: 600,
  particleSpeed: 45,
  spawnRate: 15,
};
