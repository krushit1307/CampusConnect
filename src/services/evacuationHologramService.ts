import {
  Vector3D,
  EulerOrientation,
  VenueSpatialNode,
  EvacuationRouteStep,
  ArSpatialEvacuationPlan,
} from '../types/evacuationHologram';

// Pre-mapped venue nodes (e.g. Student Union Auditorium / Sports Arena)
const defaultVenueNodes: VenueSpatialNode[] = [
  {
    id: 'node-stage-front',
    name: 'Main Stage Floor',
    position: { x: 0, y: 0, z: 0 },
    isExit: false,
    exitCapacityRate: 0,
    currentSmokeDensityPpm: 120, // Moderate smoke
    currentBottleneckScore: 85, // Heavy bottleneck
    connectedNodeIds: ['node-aisle-left', 'node-aisle-right', 'node-center-seats'],
  },
  {
    id: 'node-center-seats',
    name: 'Center Seating Section B',
    position: { x: 0, y: 0, z: 12 },
    isExit: false,
    exitCapacityRate: 0,
    currentSmokeDensityPpm: 240, // High smoke danger
    currentBottleneckScore: 90, // Severe crush risk
    connectedNodeIds: ['node-stage-front', 'node-aisle-left', 'node-aisle-right', 'node-rear-lobby'],
  },
  {
    id: 'node-aisle-left',
    name: 'West Wing Corridor',
    position: { x: -15, y: 0, z: 10 },
    isExit: false,
    exitCapacityRate: 0,
    currentSmokeDensityPpm: 35, // Clear air
    currentBottleneckScore: 20, // Low crowd
    connectedNodeIds: ['node-stage-front', 'node-center-seats', 'node-exit-west'],
  },
  {
    id: 'node-aisle-right',
    name: 'East Wing Corridor (Blocked by Debris)',
    position: { x: 15, y: 0, z: 10 },
    isExit: false,
    exitCapacityRate: 0,
    currentSmokeDensityPpm: 450, // Critical hazard
    currentBottleneckScore: 99, // Blocked
    connectedNodeIds: ['node-stage-front', 'node-center-seats', 'node-exit-east'],
  },
  {
    id: 'node-rear-lobby',
    name: 'Rear Main Lobby',
    position: { x: 0, y: 0, z: 28 },
    isExit: false,
    exitCapacityRate: 0,
    currentSmokeDensityPpm: 180,
    currentBottleneckScore: 75,
    connectedNodeIds: ['node-center-seats', 'node-exit-south'],
  },
  {
    id: 'node-exit-west',
    name: 'Emergency Exit 1A - West Courtyard',
    position: { x: -22, y: 0, z: 15 },
    isExit: true,
    exitCapacityRate: 150,
    currentSmokeDensityPpm: 5,
    currentBottleneckScore: 10,
    connectedNodeIds: ['node-aisle-left'],
  },
  {
    id: 'node-exit-east',
    name: 'Emergency Exit 1B - East Alley (Compromised)',
    position: { x: 25, y: 0, z: 15 },
    isExit: true,
    exitCapacityRate: 0,
    currentSmokeDensityPpm: 500,
    currentBottleneckScore: 100,
    connectedNodeIds: ['node-aisle-right'],
  },
  {
    id: 'node-exit-south',
    name: 'Emergency Exit 2 - South Plaza Gate',
    position: { x: 0, y: 0, z: 36 },
    isExit: true,
    exitCapacityRate: 120,
    currentSmokeDensityPpm: 40,
    currentBottleneckScore: 45,
    connectedNodeIds: ['node-rear-lobby'],
  },
];

export class EvacuationHologramService {
  private venueNodes: Map<string, VenueSpatialNode> = new Map();

  constructor(customNodes?: VenueSpatialNode[]) {
    const nodesToUse = customNodes || defaultVenueNodes;
    nodesToUse.forEach((n) => this.venueNodes.set(n.id, n));
  }

  public getVenueNodes(): VenueSpatialNode[] {
    return Array.from(this.venueNodes.values());
  }

  public updateNodeHazards(nodeId: string, smokeDensity: number, bottleneckScore: number) {
    const node = this.venueNodes.get(nodeId);
    if (node) {
      node.currentSmokeDensityPpm = smokeDensity;
      node.currentBottleneckScore = bottleneckScore;
    }
  }

  /**
   * Find the closest physical node to user coordinates
   */
  public findClosestNode(userPos: Vector3D): VenueSpatialNode {
    let closest = Array.from(this.venueNodes.values())[0];
    let minDistance = Infinity;

    for (const node of this.venueNodes.values()) {
      const dx = node.position.x - userPos.x;
      const dy = node.position.y - userPos.y;
      const dz = node.position.z - userPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance < minDistance) {
        minDistance = distance;
        closest = node;
      }
    }
    return closest;
  }

  /**
   * Calculates Dijkstra/A* path weighted by smoke density and crush bottleneck score
   */
  public computeSafeHolographicEvacRoute(
    userPos: Vector3D,
    userOrientation: EulerOrientation,
    emergencyType: 'fire' | 'crush_risk' | 'structural_collapse' | 'active_threat' | 'simulated_drill' = 'fire'
  ): ArSpatialEvacuationPlan {
    const startNode = this.findClosestNode(userPos);
    const exits = Array.from(this.venueNodes.values()).filter((n) => n.isExit && n.currentBottleneckScore < 95);

    if (exits.length === 0) {
      throw new Error('All exits compromised. Seek shelter-in-place safety zone immediately.');
    }

    // Dijkstra weighted path search: Edge Cost = physical_distance * (1 + smokeWeight + bottleneckWeight)
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    for (const node of this.venueNodes.keys()) {
      distances.set(node, Infinity);
      previous.set(node, null);
      unvisited.add(node);
    }
    distances.set(startNode.id, 0);

    while (unvisited.size > 0) {
      // Get unvisited node with lowest distance
      let currentId: string | null = null;
      let lowestDist = Infinity;
      for (const id of unvisited) {
        const d = distances.get(id)!;
        if (d < lowestDist) {
          lowestDist = d;
          currentId = id;
        }
      }

      if (!currentId || lowestDist === Infinity) break;
      unvisited.delete(currentId);

      const currentNode = this.venueNodes.get(currentId)!;
      for (const neighborId of currentNode.connectedNodeIds) {
        if (!unvisited.has(neighborId)) continue;
        const neighbor = this.venueNodes.get(neighborId);
        if (!neighbor) continue;

        const dx = neighbor.position.x - currentNode.position.x;
        const dy = neighbor.position.y - currentNode.position.y;
        const dz = neighbor.position.z - currentNode.position.z;
        const baseDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Hazard multiplier calculation:
        // Smoke > 300 ppm or Bottleneck > 80 exponentially penalizes path
        const smokeFactor = neighbor.currentSmokeDensityPpm / 100;
        const bottleneckFactor = neighbor.currentBottleneckScore / 50;
        const hazardWeight = 1.0 + smokeFactor * 1.5 + bottleneckFactor * 2.0;

        const effectiveDistance = distances.get(currentId)! + baseDistance * hazardWeight;
        if (effectiveDistance < distances.get(neighborId)!) {
          distances.set(neighborId, effectiveDistance);
          previous.set(neighborId, currentId);
        }
      }
    }

    // Select the best exit with lowest cumulative path cost
    let bestExit = exits[0];
    let lowestExitCost = Infinity;
    for (const exit of exits) {
      const cost = distances.get(exit.id)!;
      if (cost < lowestExitCost) {
        lowestExitCost = cost;
        bestExit = exit;
      }
    }

    // Reconstruct route path
    const pathNodeIds: string[] = [];
    let curr: string | null = bestExit.id;
    while (curr) {
      pathNodeIds.unshift(curr);
      curr = previous.get(curr) || null;
    }

    // Generate 3D holographic projection arrow steps
    const routeSteps: EvacuationRouteStep[] = [];
    let totalPhysicalDistance = 0;

    for (let i = 0; i < pathNodeIds.length - 1; i++) {
      const fromNode = this.venueNodes.get(pathNodeIds[i])!;
      const toNode = this.venueNodes.get(pathNodeIds[i + 1])!;
      const dx = toNode.position.x - fromNode.position.x;
      const dy = toNode.position.y - fromNode.position.y;
      const dz = toNode.position.z - fromNode.position.z;
      const stepDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      totalPhysicalDistance += stepDist;

      const stepColor =
        toNode.currentBottleneckScore > 60
          ? '#f59e0b' // Amber for moderate congestion
          : '#10b981'; // Emerald for clear safe route

      routeSteps.push({
        stepIndex: i + 1,
        fromNodeId: fromNode.id,
        toNodeId: toNode.id,
        fromPos: fromNode.position,
        toPos: toNode.position,
        hologramArrowColor: stepColor,
        distanceMeters: Math.round(stepDist * 10) / 10,
        hazardRiskMultiplier: 1.0 + toNode.currentBottleneckScore / 100,
        instructionText: `Follow glowing holographic markers towards ${toNode.name}`,
      });
    }

    const estimatedWalkingSpeedMps = 1.2; // 1.2 m/s average evacuation pace
    const estimatedTimeSec = Math.round(totalPhysicalDistance / estimatedWalkingSpeedMps);

    return {
      eventId: 'evt-campus-arena-2026',
      emergencyType,
      userCurrentLocation: userPos,
      userOrientation,
      safestExitNodeId: bestExit.id,
      safestExitName: bestExit.name,
      totalDistanceMeters: Math.round(totalPhysicalDistance * 10) / 10,
      estimatedEvacTimeSeconds: estimatedTimeSec,
      routeSteps,
      hologramProjectionConfig: {
        arrowScale: { x: 1.5, y: 0.2, z: 2.0 },
        pulsingFrequencyHz: 2.5,
        glowingIntensityLumens: 800,
        floorAnchorTrackingMethod: 'ARCore_VPS',
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const evacuationHologramService = new EvacuationHologramService();
