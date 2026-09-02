// =============================================================================
// Utility: Evacuation Bottleneck Simulator
// Issue: #5290 - Interactive "Event Layout" Emergency Exit Evacuation Bottleneck Simulator
// Description: Spawns one particle per unit of event capacity across the walkable
// floor, routes every particle to its nearest exit door with a multi-source BFS
// over the furniture grid, then drains each door at the flow rate its physical
// width supports to produce the Time To Evacuate (TTE). Layouts whose TTE exceeds
// the fire marshal's limit are hard-blocked at save time — visualizing a bottleneck
// is useless if the organizer can click past it.
// =============================================================================

import { FloorplanAsset, FireExit, VenueBounds } from "./types";

/** Unobstructed evacuation walking speed (~1.2 m/s). */
export const WALKING_SPEED_FT_PER_SEC = 4;

/**
 * Occupants per foot of door width per second.
 *
 * 0.5 gives the figure quoted in #5290: a standard 4 ft door passes 2 people per
 * second. Doubling a door's width doubles its throughput, which is what makes
 * "add another exit aisle" an actual remedy rather than a slogan.
 */
export const PERSONS_PER_FT_OF_DOOR_PER_SEC = 0.5;

/** Regulatory ceiling. NFPA-style limits are expressed in seconds, not minutes. */
export const FIRE_MARSHAL_TTE_LIMIT_SEC = 180;

/** Width of a venue-boundary fire exit, matching the door used by collision.ts. */
export const BOUNDARY_DOOR_WIDTH_FT = 4;

/** Grid resolution for the pathfinding pass, in feet. */
export const GRID_CELL_FT = 1;

/** A door particles can evacuate through. */
export interface EvacuationDoor {
  id: string;
  label: string;
  /** Door centre, in feet. */
  x_ft: number;
  y_ft: number;
  widthFt: number;
  /** Occupants per second this door can pass. */
  flowPerSec: number;
  source: "venue_fire_exit" | "layout_exit_asset";
}

/** Per-door outcome, i.e. where the queue actually forms. */
export interface DoorEvacuationLoad {
  doorId: string;
  label: string;
  widthFt: number;
  flowPerSec: number;
  /** Particles routed to this door because it was their nearest. */
  assignedOccupants: number;
  /** Seconds for the nearest assigned occupant to reach the door. */
  firstArrivalSec: number;
  /** Seconds for the furthest assigned occupant to reach the door. */
  lastArrivalSec: number;
  /** Seconds the queue takes to pass through once formed. */
  queueDrainSec: number;
  /** Seconds until this door's last occupant is out. */
  clearanceSec: number;
  /** True when the door's width, not walking distance, sets its clearance time. */
  flowLimited: boolean;
}

export interface EvacuationSimulation {
  /** Occupants simulated, i.e. the event capacity. */
  occupants: number;
  /** Seconds for the whole venue to clear: the slowest door's clearance. */
  tteSec: number;
  limitSec: number;
  compliant: boolean;
  doors: DoorEvacuationLoad[];
  /** The door setting the TTE, or null when nothing could be simulated. */
  bottleneck: DoorEvacuationLoad | null;
  /** Occupants standing where no exit is reachable through the furniture. */
  trappedOccupants: number;
  /** Walkable floor area actually reachable from a door, in square feet. */
  reachableAreaSqFt: number;
  /** Populated when the layout is non-compliant; matches the wording in #5290. */
  violationMessage: string | null;
}

interface Cell {
  index: number;
  distanceFt: number;
  doorIndex: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Doors on the venue boundary, from the venue definition. */
function boundaryDoors(venue: VenueBounds): EvacuationDoor[] {
  return (venue.fire_exits ?? []).map((exit: FireExit, index: number) => ({
    id: `fire_exit_${index}`,
    label: `${exit.side} fire exit`,
    x_ft: exit.x_ft,
    y_ft: exit.y_ft,
    widthFt: BOUNDARY_DOOR_WIDTH_FT,
    flowPerSec: BOUNDARY_DOOR_WIDTH_FT * PERSONS_PER_FT_OF_DOOR_PER_SEC,
    source: "venue_fire_exit" as const,
  }));
}

/** Exit assets the organizer dropped on the plan, sized by the asset itself. */
function layoutExitDoors(assets: FloorplanAsset[]): EvacuationDoor[] {
  return assets
    .filter((asset) => asset.kind === "exit")
    .map((asset) => {
      const widthFt = Math.max(1, asset.width);
      return {
        id: asset.id,
        label: asset.label || "Exit",
        x_ft: asset.x + asset.width / 2,
        y_ft: asset.y + asset.height / 2,
        widthFt,
        flowPerSec: widthFt * PERSONS_PER_FT_OF_DOOR_PER_SEC,
        source: "layout_exit_asset" as const,
      };
    });
}

/** Every door occupants may use, boundary exits plus placed exit assets. */
export function collectDoors(assets: FloorplanAsset[], venue: VenueBounds): EvacuationDoor[] {
  return [...boundaryDoors(venue), ...layoutExitDoors(assets)];
}

/**
 * Runs the mandatory simulation for a layout.
 *
 * @param occupants - Event capacity; one particle is spawned per occupant.
 * @param limitSec - Fire marshal ceiling, defaults to the 180 s limit in #5290.
 */
export function simulateEvacuation(
  assets: FloorplanAsset[],
  venue: VenueBounds,
  occupants: number,
  limitSec: number = FIRE_MARSHAL_TTE_LIMIT_SEC,
): EvacuationSimulation {
  const population = Math.max(0, Math.floor(Number(occupants) || 0));
  const cols = Math.max(1, Math.floor(venue.width_ft / GRID_CELL_FT));
  const rows = Math.max(1, Math.floor(venue.height_ft / GRID_CELL_FT));
  const doors = collectDoors(assets, venue);

  // Furniture blocks a cell; exit assets are doors, not obstacles.
  const blocked = new Uint8Array(cols * rows);
  for (const asset of assets) {
    if (asset.kind === "exit") continue;
    const x0 = Math.max(0, Math.floor(asset.x / GRID_CELL_FT));
    const x1 = Math.min(cols - 1, Math.ceil((asset.x + asset.width) / GRID_CELL_FT) - 1);
    const y0 = Math.max(0, Math.floor(asset.y / GRID_CELL_FT));
    const y1 = Math.min(rows - 1, Math.ceil((asset.y + asset.height) / GRID_CELL_FT) - 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) blocked[y * cols + x] = 1;
    }
  }

  const walkableCells = blocked.reduce((total, cell) => total + (cell ? 0 : 1), 0);

  // Multi-source BFS from every door: one pass yields both each cell's walking
  // distance and which door is nearest, so occupants route the way a crowd does
  // rather than being split evenly across doors that are not equally close.
  const distanceFt = new Float64Array(cols * rows).fill(Infinity);
  const doorOf = new Int32Array(cols * rows).fill(-1);
  const queue: Cell[] = [];

  doors.forEach((door, doorIndex) => {
    const x = Math.min(cols - 1, Math.max(0, Math.floor(door.x_ft / GRID_CELL_FT)));
    const y = Math.min(rows - 1, Math.max(0, Math.floor(door.y_ft / GRID_CELL_FT)));
    const index = y * cols + x;
    if (distanceFt[index] === 0) return;
    distanceFt[index] = 0;
    doorOf[index] = doorIndex;
    queue.push({ index, distanceFt: 0, doorIndex });
  });

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const cx = current.index % cols;
    const cy = Math.floor(current.index / cols);
    const nextDistance = current.distanceFt + GRID_CELL_FT;

    const neighbours = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const nIndex = ny * cols + nx;
      if (blocked[nIndex]) continue;
      if (nextDistance >= distanceFt[nIndex]) continue;

      distanceFt[nIndex] = nextDistance;
      doorOf[nIndex] = current.doorIndex;
      queue.push({ index: nIndex, distanceFt: nextDistance, doorIndex: current.doorIndex });
    }
  }

  let reachableCells = 0;
  for (let index = 0; index < distanceFt.length; index++) {
    if (!blocked[index] && Number.isFinite(distanceFt[index])) reachableCells++;
  }

  // Occupants stand on walkable floor, spread evenly over it. An even spread is
  // the neutral assumption: clustering them near a door would flatter the layout.
  const occupantsPerCell = reachableCells > 0 ? population / reachableCells : 0;
  const trappedCells = walkableCells - reachableCells;
  const trappedOccupants =
    walkableCells > 0 ? Math.round((population / walkableCells) * trappedCells) : population;

  const loads = doors.map((door) => ({
    door,
    assigned: 0,
    minDistanceFt: Infinity,
    maxDistanceFt: 0,
  }));

  for (let index = 0; index < distanceFt.length; index++) {
    if (blocked[index]) continue;
    const doorIndex = doorOf[index];
    if (doorIndex < 0 || !Number.isFinite(distanceFt[index])) continue;

    const load = loads[doorIndex];
    load.assigned += occupantsPerCell;
    load.minDistanceFt = Math.min(load.minDistanceFt, distanceFt[index]);
    load.maxDistanceFt = Math.max(load.maxDistanceFt, distanceFt[index]);
  }

  const doorLoads: DoorEvacuationLoad[] = loads.map(
    ({ door, assigned, minDistanceFt, maxDistanceFt }) => {
      const assignedOccupants = Math.ceil(assigned - 1e-9);
      const firstArrivalSec = Number.isFinite(minDistanceFt)
        ? minDistanceFt / WALKING_SPEED_FT_PER_SEC
        : 0;
      const lastArrivalSec = maxDistanceFt / WALKING_SPEED_FT_PER_SEC;
      const queueDrainSec = door.flowPerSec > 0 ? assignedOccupants / door.flowPerSec : Infinity;

      // Either everyone has walked out before the queue clears, or the queue is
      // still draining after the last person arrives. The clearance time is the
      // later of the two, which is where a single narrow door loses minutes.
      const flowClearanceSec = firstArrivalSec + queueDrainSec;
      const clearanceSec = Math.max(lastArrivalSec, flowClearanceSec);

      return {
        doorId: door.id,
        label: door.label,
        widthFt: door.widthFt,
        flowPerSec: door.flowPerSec,
        assignedOccupants,
        firstArrivalSec: round1(firstArrivalSec),
        lastArrivalSec: round1(lastArrivalSec),
        queueDrainSec: round1(queueDrainSec),
        clearanceSec: round1(clearanceSec),
        flowLimited: flowClearanceSec >= lastArrivalSec,
      };
    },
  );

  const usedDoors = doorLoads.filter((load) => load.assignedOccupants > 0);
  const bottleneck = usedDoors.reduce<DoorEvacuationLoad | null>(
    (worst, load) => (!worst || load.clearanceSec > worst.clearanceSec ? load : worst),
    null,
  );

  const tteSec = bottleneck ? bottleneck.clearanceSec : 0;
  const noExitAvailable = population > 0 && usedDoors.length === 0;
  const compliant =
    population === 0 || (!noExitAvailable && trappedOccupants === 0 && tteSec <= limitSec);

  const simulation: EvacuationSimulation = {
    occupants: population,
    tteSec,
    limitSec,
    compliant,
    doors: doorLoads,
    bottleneck,
    trappedOccupants: noExitAvailable ? population : trappedOccupants,
    reachableAreaSqFt: reachableCells * GRID_CELL_FT * GRID_CELL_FT,
    violationMessage: null,
  };

  simulation.violationMessage = compliant ? null : buildViolationMessage(simulation);
  return simulation;
}

/**
 * The blocking error text shown to the organizer, worded as specified in #5290.
 *
 * Trapped occupants get their own sentence: "requires Infinity seconds" is not an
 * actionable number, and the remedy is different — clear a path, not widen a door.
 */
export function buildViolationMessage(simulation: EvacuationSimulation): string {
  if (simulation.trappedOccupants > 0 || !simulation.bottleneck) {
    return (
      `CRITICAL SAFETY VIOLATION: ${simulation.trappedOccupants} of ${simulation.occupants} occupants ` +
      `have no path to an exit in this layout. You must clear a route to an exit door or add another ` +
      `exit aisle before saving.`
    );
  }

  return (
    `CRITICAL SAFETY VIOLATION: Current layout requires ${Math.ceil(simulation.tteSec)} seconds to ` +
    `evacuate. Maximum allowed is ${simulation.limitSec} seconds. You must add another exit aisle or ` +
    `reduce capacity before saving.`
  );
}

/** Error thrown to hard-block a save. Carries the simulation for the UI to render. */
export class EvacuationComplianceError extends Error {
  public readonly simulation: EvacuationSimulation;

  constructor(simulation: EvacuationSimulation) {
    super(simulation.violationMessage ?? buildViolationMessage(simulation));
    this.name = "EvacuationComplianceError";
    this.simulation = simulation;
  }
}

/**
 * Gate every save goes through.
 *
 * @throws {EvacuationComplianceError} when the layout exceeds the marshal's limit.
 */
export function assertEvacuationCompliance(
  assets: FloorplanAsset[],
  venue: VenueBounds,
  occupants: number,
  limitSec: number = FIRE_MARSHAL_TTE_LIMIT_SEC,
): EvacuationSimulation {
  const simulation = simulateEvacuation(assets, venue, occupants, limitSec);
  if (!simulation.compliant) throw new EvacuationComplianceError(simulation);
  return simulation;
}

/** Headline for the editor panel: what to widen or clear, and by how much. */
export function describeBottleneck(simulation: EvacuationSimulation): string {
  if (simulation.occupants === 0) return "No capacity set, so there is nothing to evacuate.";
  if (simulation.trappedOccupants > 0) {
    return `${simulation.trappedOccupants} occupants have no route to any exit.`;
  }
  if (!simulation.bottleneck) return "No exit doors on this layout.";

  const { label, assignedOccupants, flowPerSec, flowLimited } = simulation.bottleneck;
  if (flowLimited) {
    return (
      `${label} is the bottleneck: ${assignedOccupants} occupants queue through ` +
      `${flowPerSec} people/second.`
    );
  }
  return `${label} is the slowest route: walking distance, not door width, sets the ${simulation.tteSec}s clearance.`;
}
