export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type WallType = "left" | "right" | "floor" | "ceiling" | "front" | "back";

export interface AcousticWallConfig {
  type: WallType;
  name: string;
  absorptionCoefficient: number; // 0 to 1 (0 = fully reflective, 1 = fully absorbent)
  materialPreset: string;
}

export interface AcousticSpeakerConfig {
  id: string;
  label: string;
  x: number; // position in meters
  y: number;
  z: number;
  yaw: number; // rotation in horizontal plane (degrees, 0 is facing +Z)
  pitch: number; // rotation in vertical plane (degrees, tilt up/down)
  coneAngle: number; // dispersion angle in degrees (e.g. 90)
  dbOutput: number; // volume in dB at 1m (e.g. 90 to 120)
}

export interface AcousticRay {
  origin: Vector3D;
  direction: Vector3D;
  energy: number; // relative energy (starts at 1.0 per ray)
  bounces: number;
  points: Vector3D[]; // path of the ray including reflections
}

export interface AcousticIntersection {
  point: Vector3D;
  distance: number;
  wallType: WallType;
  normal: Vector3D;
}

export interface AcousticSimulationConfig {
  rayCount: number;
  maxBounces: number;
  tempCelsius: number;
  humidityPct: number;
}

export interface AcousticSimulationResults {
  rt60SabineSeconds: number;
  rt60RayTracedSeconds: number;
  directEnergy: number;
  reflectedEnergy: number;
  directToReverberantRatioDb: number;
  warningSeverity: "none" | "moderate" | "severe";
  warningMessage?: string;
  actionableGuidance: string[];
  flutterEchoDetected: boolean;
  rays: AcousticRay[];
}

export const ACOUSTIC_MATERIAL_PRESETS: Record<string, { name: string; absorption: number }> = {
  concrete: { name: "Smooth Concrete (Reflective)", absorption: 0.02 },
  brick: { name: "Unpainted Brick", absorption: 0.03 },
  plaster: { name: "Plaster on Concrete", absorption: 0.05 },
  glass: { name: "Standard Glass Windows", absorption: 0.1 },
  wood_panel: { name: "Plywood Wood Paneling", absorption: 0.15 },
  carpet_thin: { name: "Thin Carpet on Concrete", absorption: 0.25 },
  carpet_thick: { name: "Thick Carpet with Underlay", absorption: 0.55 },
  curtains_heavy: { name: "Heavy Velvet Curtains", absorption: 0.6 },
  acoustic_foam: { name: "Acoustic Damping Foam Panels", absorption: 0.85 },
  open_space: { name: "Fully Open / Sound Absorbing", absorption: 0.99 },
};
