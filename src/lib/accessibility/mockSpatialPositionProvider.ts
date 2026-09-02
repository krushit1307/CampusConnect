/**
 * Mock spatial/UWB position provider (Issue #5458).
 *
 * Simulates Ultra-Wideband positioning for development and testing. It returns
 * deterministic positions and orientations that scripts/QAs can control via the
 * `set*` helpers. This is a SIMULATION ONLY — it does not access any UWB hardware.
 * A future native provider can implement the same `SpatialPositionProvider`
 * interface to source real ranging data without changes to the wayfinding logic.
 */

import {
  HeadOrientation,
  SpatialPosition,
  SpatialPositionProvider,
  SpatialTarget,
} from "@/types/spatialWayfinding";

export const DEFAULT_USER_POSITION: SpatialPosition = { x: 0, y: 0, z: 0 };
export const DEFAULT_HEAD_ORIENTATION: HeadOrientation = { yaw: 0, pitch: 0, roll: 0 };

/** A few deterministic venue "doors" used by the demo UI and tests. */
export const DEFAULT_WAYPOINTS: SpatialTarget[] = [
  { id: "main_stage", label: "Main Keynote Stage (Auditorium A)", position: { x: 5, y: 5, z: 0 } },
  {
    id: "accessible_restrooms",
    label: "Accessible Restrooms (West Wing)",
    position: { x: -4, y: 6, z: 0 },
  },
  {
    id: "sponsor_hall",
    label: "Sponsor Exhibition Hall (Booth 14)",
    position: { x: -8, y: 2, z: 0 },
  },
  {
    id: "food_court",
    label: "Food & Catering Court (South Exit)",
    position: { x: 2, y: -9, z: 0 },
  },
];

export interface MockSpatialPositionProviderOptions {
  userPosition?: SpatialPosition;
  targetPosition?: SpatialPosition;
  headOrientation?: HeadOrientation;
}

export class MockSpatialPositionProvider implements SpatialPositionProvider {
  private userPosition: SpatialPosition;
  private targetPosition: SpatialPosition;
  private headOrientation: HeadOrientation;

  constructor(options: MockSpatialPositionProviderOptions = {}) {
    this.userPosition = options.userPosition ?? { ...DEFAULT_USER_POSITION };
    this.targetPosition = options.targetPosition ?? { ...DEFAULT_WAYPOINTS[0].position };
    this.headOrientation = { ...(options.headOrientation ?? DEFAULT_HEAD_ORIENTATION) };
  }

  public setUserPosition(position: SpatialPosition): void {
    this.userPosition = { ...position };
  }

  public setTargetPosition(position: SpatialPosition): void {
    this.targetPosition = { ...position };
  }

  public setHeadOrientation(orientation: HeadOrientation): void {
    this.headOrientation = { ...orientation };
  }

  public getTargetPosition(): Promise<SpatialPosition> {
    return Promise.resolve({ ...this.targetPosition });
  }

  public getUserPosition(): Promise<SpatialPosition> {
    return Promise.resolve({ ...this.userPosition });
  }

  public getHeadOrientation(): Promise<HeadOrientation> {
    return Promise.resolve({ ...this.headOrientation });
  }
}

export const mockSpatialPositionProvider = new MockSpatialPositionProvider();
