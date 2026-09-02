import { SpatialPoint, VenueCanvasLayout, EmergencyExit } from '../../shared/schemas/evacuationAR';

export interface PathNode {
  position: SpatialPoint;
  distanceToExit: number;
}

/**
 * Calculates shortest safe path from current user location to nearest available emergency exit.
 */
export class EvacuationPathfinder {
  private layout: VenueCanvasLayout;

  constructor(layout: VenueCanvasLayout) {
    this.layout = layout;
  }

  public findNearestExitPath(userPos: SpatialPoint): SpatialPoint[] {
    const accessibleExits = this.layout.exits.filter((e) => e.isAccessible);
    if (accessibleExits.length === 0) return [];

    // Find closest exit by Euclidean distance
    let nearestExit: EmergencyExit = accessibleExits[0];
    let minDistance = Infinity;

    accessibleExits.forEach((exit) => {
      const dist = this.calculateDistance(userPos, exit.coordinates);
      if (dist < minDistance) {
        minDistance = dist;
        nearestExit = exit;
      }
    });

    // Compute waypoints sequence (User -> Nodes -> Exit)
    return [userPos, nearestExit.coordinates];
  }

  private calculateDistance(p1: SpatialPoint, p2: SpatialPoint): number {
    return Math.sqrt(
      Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2) + Math.pow(p2.z - p1.z, 2)
    );
  }
}
