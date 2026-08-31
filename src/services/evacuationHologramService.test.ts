import { describe, it, expect, beforeEach } from 'vitest';
import { EvacuationHologramService } from './evacuationHologramService';

describe('EvacuationHologramService', () => {
  let service: EvacuationHologramService;

  beforeEach(() => {
    service = new EvacuationHologramService();
  });

  it('should compute safe evacuation path avoiding high smoke and bottlenecks', () => {
    // Stage fire scenario: node-stage-front and node-aisle-right are heavily blocked
    service.updateNodeHazards('node-stage-front', 350, 95);
    service.updateNodeHazards('node-aisle-right', 480, 100);
    service.updateNodeHazards('node-aisle-left', 20, 15);

    const userPos = { x: 0, y: 0, z: 2 };
    const userOrientation = { pitch: 0, yaw: 0, roll: 0 };

    const plan = service.computeSafeHolographicEvacRoute(userPos, userOrientation, 'fire');

    expect(plan).toBeDefined();
    expect(plan.safestExitNodeId).toBe('node-exit-west');
    expect(plan.routeSteps.length).toBeGreaterThan(0);
    expect(plan.totalDistanceMeters).toBeGreaterThan(0);
    expect(plan.estimatedEvacTimeSeconds).toBeGreaterThan(0);

    // Verify hologram projection specs
    expect(plan.hologramProjectionConfig.glowingIntensityLumens).toBe(800);
    expect(plan.hologramProjectionConfig.pulsingFrequencyHz).toBe(2.5);
  });

  it('should dynamically reroute if rear lobby gets crushed', () => {
    // Crush risk at rear lobby and south exit
    service.updateNodeHazards('node-rear-lobby', 300, 99);
    service.updateNodeHazards('node-exit-south', 150, 98);
    service.updateNodeHazards('node-aisle-left', 10, 10);

    const userPos = { x: 0, y: 0, z: 15 };
    const plan = service.computeSafeHolographicEvacRoute(userPos, { pitch: 0, yaw: 0, roll: 0 }, 'crush_risk');

    expect(plan.safestExitNodeId).toBe('node-exit-west');
    expect(plan.routeSteps.some((s) => s.toNodeId === 'node-exit-west')).toBe(true);
  });

  it('should find closest node accurately from 3D coordinates', () => {
    const node = service.findClosestNode({ x: -14, y: 0, z: 11 });
    expect(node.id).toBe('node-aisle-left');
  });
});
