import {
  Vector3D,
  AcousticWallConfig,
  AcousticSpeakerConfig,
  AcousticRay,
  AcousticIntersection,
  AcousticSimulationResults,
  WallType,
} from "../types/acoustic";

// Vector operations
export const vecAdd = (v1: Vector3D, v2: Vector3D): Vector3D => ({
  x: v1.x + v2.x,
  y: v1.y + v2.y,
  z: v1.z + v2.z,
});

export const vecSub = (v1: Vector3D, v2: Vector3D): Vector3D => ({
  x: v1.x - v2.x,
  y: v1.y - v2.y,
  z: v1.z - v2.z,
});

export const vecScale = (v: Vector3D, s: number): Vector3D => ({
  x: v.x * s,
  y: v.y * s,
  z: v.z * s,
});

export const vecDot = (v1: Vector3D, v2: Vector3D): number =>
  v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;

export const vecCross = (v1: Vector3D, v2: Vector3D): Vector3D => ({
  x: v1.y * v2.z - v1.z * v2.y,
  y: v1.z * v2.x - v1.x * v2.z,
  z: v1.x * v2.y - v1.y * v2.x,
});

export const vecLength = (v: Vector3D): number => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);

export const vecNormalize = (v: Vector3D): Vector3D => {
  const len = vecLength(v);
  return len === 0 ? { x: 0, y: 0, z: 0 } : vecScale(v, 1 / len);
};

export const vecDist = (v1: Vector3D, v2: Vector3D): number => vecLength(vecSub(v1, v2));

export const vecReflect = (incident: Vector3D, normal: Vector3D): Vector3D => {
  const dot = vecDot(incident, normal);
  return vecSub(incident, vecScale(normal, 2 * dot));
};

/**
 * Rotates a vector around an axis by a given angle in radians (Rodrigues' rotation formula)
 */
export function vecRotate(v: Vector3D, axis: Vector3D, angle: number): Vector3D {
  const k = vecNormalize(axis);
  const cosTheta = Math.cos(angle);
  const sinTheta = Math.sin(angle);

  // v * cos(theta) + (k x v) * sin(theta) + k * (k . v) * (1 - cos(theta))
  const term1 = vecScale(v, cosTheta);
  const term2 = vecScale(vecCross(k, v), sinTheta);
  const term3 = vecScale(k, vecDot(k, v) * (1 - cosTheta));

  return vecAdd(vecAdd(term1, term2), term3);
}

/**
 * Aligns the vector (0, 0, 1) with the target direction vector.
 */
export function alignConeRay(localRay: Vector3D, targetDir: Vector3D): Vector3D {
  const sourceDir = { x: 0, y: 0, z: 1 };
  const targetNorm = vecNormalize(targetDir);

  const dot = vecDot(sourceDir, targetNorm);
  if (dot > 0.9999) {
    return localRay;
  }
  if (dot < -0.9999) {
    return { x: localRay.x, y: -localRay.y, z: -localRay.z };
  }

  const axis = vecCross(sourceDir, targetNorm);
  const angle = Math.acos(dot);
  return vecRotate(localRay, axis, angle);
}

/**
 * Calculates the speed of sound in m/s based on temperature in Celsius
 */
export function getSpeedOfSound(tempCelsius = 20): number {
  return 331.3 + 0.606 * tempCelsius;
}

/**
 * Calculates the intersection of a ray with the venue boundaries (box).
 * Box boundary definitions:
 * Left: X = -width/2, Right: X = width/2
 * Floor: Y = 0, Ceiling: Y = height
 * Back: Z = -depth/2, Front: Z = depth/2
 */
export function intersectRoom(
  origin: Vector3D,
  dir: Vector3D,
  width: number,
  depth: number,
  height: number,
): AcousticIntersection | null {
  const epsilon = 1e-5;
  let tMin = Infinity;
  let hitWall: WallType | null = null;
  let hitNormal: Vector3D = { x: 0, y: 0, z: 0 };

  const halfW = width / 2;
  const halfD = depth / 2;

  // 1. Left Wall (X = -halfW, normal = { x: 1, y: 0, z: 0 })
  if (Math.abs(dir.x) > epsilon) {
    const t = (-halfW - origin.x) / dir.x;
    if (t > epsilon && t < tMin) {
      const y = origin.y + t * dir.y;
      const z = origin.z + t * dir.z;
      if (y >= 0 && y <= height && z >= -halfD && z <= halfD) {
        tMin = t;
        hitWall = "left";
        hitNormal = { x: 1, y: 0, z: 0 };
      }
    }
  }

  // 2. Right Wall (X = halfW, normal = { x: -1, y: 0, z: 0 })
  if (Math.abs(dir.x) > epsilon) {
    const t = (halfW - origin.x) / dir.x;
    if (t > epsilon && t < tMin) {
      const y = origin.y + t * dir.y;
      const z = origin.z + t * dir.z;
      if (y >= 0 && y <= height && z >= -halfD && z <= halfD) {
        tMin = t;
        hitWall = "right";
        hitNormal = { x: -1, y: 0, z: 0 };
      }
    }
  }

  // 3. Floor (Y = 0, normal = { x: 0, y: 1, z: 0 })
  if (Math.abs(dir.y) > epsilon) {
    const t = (0 - origin.y) / dir.y;
    if (t > epsilon && t < tMin) {
      const x = origin.x + t * dir.x;
      const z = origin.z + t * dir.z;
      if (x >= -halfW && x <= halfW && z >= -halfD && z <= halfD) {
        tMin = t;
        hitWall = "floor";
        hitNormal = { x: 0, y: 1, z: 0 };
      }
    }
  }

  // 4. Ceiling (Y = height, normal = { x: 0, y: -1, z: 0 })
  if (Math.abs(dir.y) > epsilon) {
    const t = (height - origin.y) / dir.y;
    if (t > epsilon && t < tMin) {
      const x = origin.x + t * dir.x;
      const z = origin.z + t * dir.z;
      if (x >= -halfW && x <= halfW && z >= -halfD && z <= halfD) {
        tMin = t;
        hitWall = "ceiling";
        hitNormal = { x: 0, y: -1, z: 0 };
      }
    }
  }

  // 5. Back Wall (Z = -halfD, normal = { x: 0, y: 0, z: 1 })
  if (Math.abs(dir.z) > epsilon) {
    const t = (-halfD - origin.z) / dir.z;
    if (t > epsilon && t < tMin) {
      const x = origin.x + t * dir.x;
      const y = origin.y + t * dir.y;
      if (x >= -halfW && x <= halfW && y >= 0 && y <= height) {
        tMin = t;
        hitWall = "back";
        hitNormal = { x: 0, y: 0, z: 1 };
      }
    }
  }

  // 6. Front Wall (Z = halfD, normal = { x: 0, y: 0, z: -1 })
  if (Math.abs(dir.z) > epsilon) {
    const t = (halfD - origin.z) / dir.z;
    if (t > epsilon && t < tMin) {
      const x = origin.x + t * dir.x;
      const y = origin.y + t * dir.y;
      if (x >= -halfW && x <= halfW && y >= 0 && y <= height) {
        tMin = t;
        hitWall = "front";
        hitNormal = { x: 0, y: 0, z: -1 };
      }
    }
  }

  if (hitWall === null) {
    return null;
  }

  const hitPoint = vecAdd(origin, vecScale(dir, tMin));

  return {
    point: hitPoint,
    distance: tMin,
    wallType: hitWall,
    normal: hitNormal,
  };
}

/**
 * Main simulator class for 3D acoustic ray-tracing.
 */
export class AcousticRayTracer {
  private width: number;
  private depth: number;
  private height: number;
  private walls: Record<WallType, AcousticWallConfig>;

  constructor(width: number, depth: number, height: number, wallConfigs: AcousticWallConfig[]) {
    this.width = width;
    this.depth = depth;
    this.height = height;
    this.walls = {} as Record<WallType, AcousticWallConfig>;

    wallConfigs.forEach((config) => {
      this.walls[config.type] = config;
    });
  }

  /**
   * Generates deterministic rays within the speaker's dispersion cone.
   */
  public generateSpeakerRays(speaker: AcousticSpeakerConfig, rayCount: number): AcousticRay[] {
    const rays: AcousticRay[] = [];
    const coneRad = (speaker.coneAngle * Math.PI) / 360; // half-angle of the cone in radians

    // Speaker main direction calculations
    const yawRad = (speaker.yaw * Math.PI) / 180;
    const pitchRad = (speaker.pitch * Math.PI) / 180;

    const mainDir: Vector3D = {
      x: Math.cos(pitchRad) * Math.sin(yawRad),
      y: Math.sin(pitchRad),
      z: Math.cos(pitchRad) * Math.cos(yawRad),
    };

    const origin: Vector3D = { x: speaker.x, y: speaker.y, z: speaker.z };

    // Deterministic Fibonacci spiral inside a cone
    const goldenRatioAngle = Math.PI * (3 - Math.sqrt(5)); // Golden angle in radians

    for (let i = 0; i < rayCount; i++) {
      const z = 1 - (1 - Math.cos(coneRad)) * ((i + 0.5) / rayCount);
      const radius = Math.sqrt(1 - z * z);
      const theta = goldenRatioAngle * i;

      const localRayDir: Vector3D = {
        x: radius * Math.cos(theta),
        y: radius * Math.sin(theta),
        z: z,
      };

      // Rotate local cone ray direction to align with the speaker direction
      const finalDir = vecNormalize(alignConeRay(localRayDir, mainDir));

      rays.push({
        origin,
        direction: finalDir,
        energy: 1.0 / rayCount, // normalize initial energy per ray
        bounces: 0,
        points: [origin],
      });
    }

    return rays;
  }

  /**
   * Runs the ray-tracing simulation.
   */
  public runSimulation(
    speakers: AcousticSpeakerConfig[],
    rayCountPerSpeaker = 200,
    maxBounces = 4,
    tempCelsius = 20,
    humidityPct = 50,
  ): AcousticSimulationResults {
    const allRays: AcousticRay[] = [];
    const speedOfSound = getSpeedOfSound(tempCelsius);

    // Air absorption coefficient (simplified attenuation constant)
    // E(d) = E(0) * e^(-m * d)
    // m is typically in range 0.002 to 0.015 depending on humidity
    const humidityTerm = Math.max(10, Math.min(90, humidityPct)) / 100;
    const airAbsorptionCoeff = 0.012 - 0.008 * humidityTerm; // air damping factor

    let totalDirectPower = 0;
    let totalReflectedPower = 0;

    // Time-based energy buckets (resolution: 2ms up to 1.5 seconds)
    const bucketResolutionMs = 2;
    const maxTimeMs = 1500;
    const bucketCount = Math.ceil(maxTimeMs / bucketResolutionMs);
    const energyBuckets = new Float32Array(bucketCount);

    speakers.forEach((speaker) => {
      const initialSpeakerPower = Math.pow(10, speaker.dbOutput / 10);
      const rays = this.generateSpeakerRays(speaker, rayCountPerSpeaker);

      rays.forEach((ray) => {
        let currentOrigin = { ...ray.origin };
        let currentDir = { ...ray.direction };
        let currentEnergy = ray.energy * initialSpeakerPower;
        let elapsedDistance = 0;

        for (let bounce = 0; bounce <= maxBounces; bounce++) {
          const hit = intersectRoom(currentOrigin, currentDir, this.width, this.depth, this.height);

          if (!hit) {
            break;
          }

          const dist = hit.distance;
          elapsedDistance += dist;

          // Apply air absorption to energy
          const airAttenuation = Math.exp(-airAbsorptionCoeff * dist);
          currentEnergy *= airAttenuation;

          // Record ray point
          ray.points.push(hit.point);

          const timeElapsedMs = (elapsedDistance / speedOfSound) * 1000;
          const bucketIndex = Math.floor(timeElapsedMs / bucketResolutionMs);

          if (bucketIndex >= 0 && bucketIndex < bucketCount) {
            energyBuckets[bucketIndex] += currentEnergy;
          }

          if (bounce === 0) {
            totalDirectPower += currentEnergy;
          } else {
            totalReflectedPower += currentEnergy;
          }

          if (bounce === maxBounces) {
            break;
          }

          // Apply wall absorption coefficient
          const wallConfig = this.walls[hit.wallType];
          const absorption = wallConfig ? wallConfig.absorptionCoefficient : 0.1;
          currentEnergy *= 1 - absorption;

          // Stop tracing if ray energy fades out significantly
          if (currentEnergy < initialSpeakerPower * (1e-6 / rayCountPerSpeaker)) {
            break;
          }

          // Calculate reflection direction
          currentDir = vecNormalize(vecReflect(currentDir, hit.normal));
          currentOrigin = vecAdd(hit.point, vecScale(currentDir, 0.001)); // tiny offset to avoid self-collision
        }

        allRays.push(ray);
      });
    });

    // Sabine RT60 Calculation: RT60 = 0.161 * V / S_eff
    const volume = this.width * this.depth * this.height;
    const areaLeftRight = this.depth * this.height * 2;
    const areaFrontBack = this.width * this.height * 2;
    const areaFloorCeiling = this.width * this.depth * 2;

    const totalSurfaceArea = areaLeftRight + areaFrontBack + areaFloorCeiling;

    const sEff =
      areaLeftRight *
        ((this.walls.left.absorptionCoefficient + this.walls.right.absorptionCoefficient) / 2) +
      areaFrontBack *
        ((this.walls.front.absorptionCoefficient + this.walls.back.absorptionCoefficient) / 2) +
      areaFloorCeiling *
        ((this.walls.floor.absorptionCoefficient + this.walls.ceiling.absorptionCoefficient) / 2);

    const rt60SabineSeconds = sEff > 0 ? (0.161 * volume) / sEff : 9.99;

    // Ray-Traced RT60 Calculation based on decay curve
    // Find time when cumulative energy in room decays by 60 dB (10^-6 of peak)
    let peakEnergy = 0;
    for (let i = 0; i < bucketCount; i++) {
      if (energyBuckets[i] > peakEnergy) {
        peakEnergy = energyBuckets[i];
      }
    }

    let decayCutoffIndex = -1;
    const thresholdEnergy = peakEnergy * 1e-6;

    // Find the last bucket that still has energy above threshold
    for (let i = bucketCount - 1; i >= 0; i--) {
      if (energyBuckets[i] > thresholdEnergy) {
        decayCutoffIndex = i;
        break;
      }
    }

    // If the energy at the cutoff is still significant (e.g. > 1% of peak, meaning it decayed less than 20 dB),
    // then the decay is incomplete, and we must fall back to Sabine formula.
    const isIncompleteDecay =
      decayCutoffIndex !== -1 && energyBuckets[decayCutoffIndex] > peakEnergy * 0.01;

    const rt60RayTracedSeconds =
      decayCutoffIndex !== -1 && !isIncompleteDecay
        ? (decayCutoffIndex * bucketResolutionMs) / 1000
        : rt60SabineSeconds; // fallback to Sabine if decay is slow/incomplete

    // Direct-to-Reverberant Ratio: DRR = 10 * log10(DirectPower / ReflectedPower)
    const directToReverberantRatioDb =
      totalDirectPower > 0 && totalReflectedPower > 0
        ? 10 * Math.log10(totalDirectPower / totalReflectedPower)
        : 12;

    // Check for Flutter Echo (high reflections between parallel walls)
    const isLeftRightReflective =
      this.walls.left.absorptionCoefficient < 0.1 && this.walls.right.absorptionCoefficient < 0.1;
    const isFrontBackReflective =
      this.walls.front.absorptionCoefficient < 0.1 && this.walls.back.absorptionCoefficient < 0.1;
    const flutterEchoDetected = isLeftRightReflective || isFrontBackReflective;

    // Warnings and actionable recommendations
    let warningSeverity: "none" | "moderate" | "severe" = "none";
    let warningMessage: string | undefined;
    const actionableGuidance: string[] = [];

    if (rt60RayTracedSeconds > 1.8) {
      warningSeverity = "severe";
      warningMessage = `Severe Reverb Risk: Simulated decay time (RT60 = ${rt60RayTracedSeconds.toFixed(2)}s) is extremely high. Spoken word and amplified audio will sound muddy or distorted.`;
    } else if (rt60RayTracedSeconds > 1.3) {
      warningSeverity = "moderate";
      warningMessage = `Moderate Reverb Warning: Simulated decay time (RT60 = ${rt60RayTracedSeconds.toFixed(2)}s) is higher than recommended for educational speeches or lectures.`;
    }

    // Populate dynamic organizer guidance
    if (rt60RayTracedSeconds > 1.3) {
      if (
        this.walls.left.absorptionCoefficient < 0.2 ||
        this.walls.right.absorptionCoefficient < 0.2
      ) {
        actionableGuidance.push(
          "Apply Wall Damping: Side walls are highly reflective. Try mounting heavy velvet curtains or acoustic panels on the left and right walls.",
        );
      }
      if (this.walls.ceiling.absorptionCoefficient < 0.2) {
        actionableGuidance.push(
          "Ceiling Treatment: Install suspended acoustic baffles or tiles to reduce vertical sound bounces.",
        );
      }
      if (this.walls.floor.absorptionCoefficient < 0.15) {
        actionableGuidance.push(
          "Floor Coverings: Lay down temporary carpets or area rugs across the main layout paths to absorb low-frequency noise.",
        );
      }

      // Check speaker tilt and yaw optimization
      const poorlyAimedSpeakers = speakers.filter(
        (s) => Math.abs(s.pitch) < 5 || Math.abs(s.yaw % 90) < 10,
      );
      if (poorlyAimedSpeakers.length > 0) {
        actionableGuidance.push(
          "Rotate & Angle Speakers: Angle speakers inward by 10-15 degrees and tilt them down slightly towards the audience. Avoid aiming speakers directly perpendicular to flat walls.",
        );
      }

      // Check excessive volume
      const loudSpeakers = speakers.filter((s) => s.dbOutput > 105);
      if (loudSpeakers.length > 0) {
        actionableGuidance.push(
          "Optimize Amplifier Output: The speakers are set to a very high volume (exceeding 105 dB). Try lowering output settings to minimize reverberation energy in the space.",
        );
      }
    }

    if (flutterEchoDetected) {
      actionableGuidance.push(
        "Prevent Flutter Echoes: Parallel reflective walls detected. Rotate the speaker array or place diffusion panels along side surfaces to scatter sound waves.",
      );
    }

    return {
      rt60SabineSeconds,
      rt60RayTracedSeconds,
      directEnergy: totalDirectPower,
      reflectedEnergy: totalReflectedPower,
      directToReverberantRatioDb,
      warningSeverity,
      warningMessage,
      actionableGuidance,
      flutterEchoDetected,
      rays: allRays,
    };
  }
}
