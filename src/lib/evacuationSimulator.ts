export interface Point2D {
  x: number;
  y: number;
}

export interface ExitNode extends Point2D {
  id: string;
  widthFeet: number; // Width of doorway in feet
  maxThroughputPerSec: number; // e.g., 2 persons/sec per foot of width
}

export interface CrowdParticle {
  id: number;
  position: Point2D;
  targetExitId: string;
  speed: number;
  isEvacuated: boolean;
}

export interface EvacuationSimulationConfig {
  maxCapacity: number;
  roomBounds: { width: number; height: number };
  exits: ExitNode[];
}

export interface SimulationStepResult {
  tickCount: number;
  activeParticlesCount: number;
  evacuatedCount: number;
  bottleneckDensities: Record<string, number>; // exitId -> particle density
  criticalBottlenecks: string[]; // List of exit IDs in critical red state
  isSimulationComplete: boolean;
}

export const CRITICAL_DENSITY_THRESHOLD_PER_FOOT = 15.0; // Persons per foot threshold

/**
 * Spawns N crowd particles randomly distributed within the venue room bounds.
 */
export function spawnCrowdParticles(config: EvacuationSimulationConfig): CrowdParticle[] {
  const particles: CrowdParticle[] = [];
  const exitCount = config.exits.length;

  for (let i = 0; i < config.maxCapacity; i++) {
    const targetExit = config.exits[i % exitCount];
    particles.push({
      id: i,
      position: {
        x: Math.random() * config.roomBounds.width,
        y: Math.random() * config.roomBounds.height,
      },
      targetExitId: targetExit.id,
      speed: 2.5 + Math.random() * 1.5, // 2.5 to 4.0 units per tick
      isEvacuated: false,
    });
  }

  return particles;
}

/**
 * Advances particle flocking simulation by 1 tick towards target exits and checks for bottleneck density.
 */
export function stepEvacuationSimulation(
  particles: CrowdParticle[],
  exits: ExitNode[],
): { updatedParticles: CrowdParticle[]; stepMetrics: SimulationStepResult } {
  const exitMap = new Map<string, ExitNode>(exits.map((e) => [e.id, e]));
  const exitCongestion: Record<string, number> = {};

  for (const exit of exits) {
    exitCongestion[exit.id] = 0;
  }

  const updatedParticles = particles.map((p) => {
    if (p.isEvacuated) return p;

    const exit = exitMap.get(p.targetExitId);
    if (!exit) return p;

    const dx = exit.x - p.position.x;
    const dy = exit.y - p.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Particle reached exit
    if (distance <= p.speed + 2.0) {
      return { ...p, isEvacuated: true };
    }

    // Move particle towards exit
    const unitX = dx / distance;
    const unitY = dy / distance;
    const newPos = {
      x: p.position.x + unitX * p.speed,
      y: p.position.y + unitY * p.speed,
    };

    // Track proximity density (within 30 units of doorway)
    if (distance <= 30.0) {
      exitCongestion[p.targetExitId] = (exitCongestion[p.targetExitId] || 0) + 1;
    }

    return { ...p, position: newPos };
  });

  const bottleneckDensities: Record<string, number> = {};
  const criticalBottlenecks: string[] = [];

  for (const exit of exits) {
    const count = exitCongestion[exit.id] || 0;
    const densityPerFoot = Number((count / exit.widthFeet).toFixed(2));
    bottleneckDensities[exit.id] = densityPerFoot;

    if (densityPerFoot >= CRITICAL_DENSITY_THRESHOLD_PER_FOOT) {
      criticalBottlenecks.push(exit.id);
    }
  }

  const activeParticlesCount = updatedParticles.filter((p) => !p.isEvacuated).length;
  const evacuatedCount = updatedParticles.length - activeParticlesCount;

  return {
    updatedParticles,
    stepMetrics: {
      tickCount: 1,
      activeParticlesCount,
      evacuatedCount,
      bottleneckDensities,
      criticalBottlenecks,
      isSimulationComplete: activeParticlesCount === 0,
    },
  };
}
