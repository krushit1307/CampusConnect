export interface SphereCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface OrientationAngle {
  pitch: number; // Vertical angle (-90 to 90 degrees)
  yaw: number; // Horizontal angle (0 to 360 degrees)
}

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Validates whether an uploaded image meets the strict 2:1 aspect ratio required for 360 equirectangular panoramas.
 */
export function validateEquirectangularAspectRatio(dimensions: ImageDimensions): boolean {
  if (dimensions.width <= 0 || dimensions.height <= 0) return false;
  const ratio = dimensions.width / dimensions.height;
  // Allow slight rounding tolerance (1.98 to 2.02)
  return Math.abs(ratio - 2.0) <= 0.02;
}

/**
 * Detects whether the current browser environment supports WebGL rendering contexts.
 */
export function isWebGlSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Converts camera pitch and yaw angles (in degrees) to 3D Cartesian coordinates on a sphere unit.
 */
export function convertAnglesToSphereVector(
  angles: OrientationAngle,
  radius = 1.0,
): SphereCoordinates {
  // Clamp pitch to avoid gimbal lock at exact poles
  const clampedPitch = Math.max(-89.9, Math.min(89.9, angles.pitch));

  const pitchRad = (clampedPitch * Math.PI) / 180;
  const yawRad = (angles.yaw * Math.PI) / 180;

  const x = radius * Math.cos(pitchRad) * Math.sin(yawRad);
  const y = radius * Math.sin(pitchRad);
  const z = radius * Math.cos(pitchRad) * Math.cos(yawRad);

  return {
    x: Number(x.toFixed(4)),
    y: Number(y.toFixed(4)),
    z: Number(z.toFixed(4)),
  };
}
