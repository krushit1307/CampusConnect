// =============================================================================
// Unit Tests: Evacuation Bottleneck Simulator
// Issue: #5290 - Interactive "Event Layout" Emergency Exit Evacuation Bottleneck Simulator
// Description: Asserts door flow arithmetic, nearest-exit routing around furniture,
// the TTE the fire marshal's limit is checked against, the exact blocking message,
// and that adding an exit aisle or reducing capacity is what clears the violation.
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  EvacuationComplianceError,
  FIRE_MARSHAL_TTE_LIMIT_SEC,
  PERSONS_PER_FT_OF_DOOR_PER_SEC,
  assertEvacuationCompliance,
  collectDoors,
  describeBottleneck,
  simulateEvacuation,
} from "./evacuation";
import { FloorplanAsset, VenueBounds } from "./types";

/** Hall with one 4 ft door on the top wall. */
const SINGLE_EXIT_VENUE: VenueBounds = {
  width_ft: 100,
  height_ft: 60,
  fire_exits: [{ x_ft: 50, y_ft: 0, side: "top" }],
};

/** Same hall with a second door on the opposite wall. */
const TWO_EXIT_VENUE: VenueBounds = {
  ...SINGLE_EXIT_VENUE,
  fire_exits: [
    { x_ft: 50, y_ft: 0, side: "top" },
    { x_ft: 50, y_ft: 60, side: "bottom" },
  ],
};

const asset = (over: Partial<FloorplanAsset> & { id: string }): FloorplanAsset => ({
  kind: "rect_table",
  label: "Table",
  x: 0,
  y: 0,
  width: 6,
  height: 3,
  assignment: null,
  ...over,
});

describe("evacuation simulator (#5290)", () => {
  describe("door inventory and flow", () => {
    it("passes 2 people per second through a standard 4 ft door", () => {
      const [door] = collectDoors([], SINGLE_EXIT_VENUE);

      expect(door.widthFt).toBe(4);
      expect(door.flowPerSec).toBe(4 * PERSONS_PER_FT_OF_DOOR_PER_SEC);
      expect(door.flowPerSec).toBe(2);
    });

    it("counts exit assets dropped on the layout as doors, sized by the asset", () => {
      const doors = collectDoors(
        [
          asset({
            id: "exit-1",
            kind: "exit",
            label: "Side Aisle",
            x: 0,
            y: 30,
            width: 8,
            height: 2,
          }),
        ],
        SINGLE_EXIT_VENUE,
      );

      expect(doors).toHaveLength(2);
      const aisle = doors.find((door) => door.id === "exit-1");
      expect(aisle?.widthFt).toBe(8);
      expect(aisle?.flowPerSec).toBe(4);
      expect(aisle?.source).toBe("layout_exit_asset");
    });
  });

  describe("time to evacuate", () => {
    it("blocks the 500-occupant single-door hall from #5290", () => {
      const simulation = simulateEvacuation([], SINGLE_EXIT_VENUE, 500);

      expect(simulation.compliant).toBe(false);
      // 500 occupants queueing through one 2 people/second door cannot clear in 180s.
      expect(simulation.tteSec).toBeGreaterThan(FIRE_MARSHAL_TTE_LIMIT_SEC);
      expect(simulation.bottleneck?.assignedOccupants).toBe(500);
      expect(simulation.bottleneck?.flowLimited).toBe(true);
    });

    it("derives clearance from door flow when the queue outlasts the walk", () => {
      const simulation = simulateEvacuation([], SINGLE_EXIT_VENUE, 500);
      const door = simulation.bottleneck!;

      expect(door.queueDrainSec).toBe(250); // 500 / 2 per second
      expect(door.clearanceSec).toBe(door.firstArrivalSec + door.queueDrainSec);
    });

    it("passes a small crowd through the same single door", () => {
      const simulation = simulateEvacuation([], SINGLE_EXIT_VENUE, 60);

      expect(simulation.compliant).toBe(true);
      expect(simulation.tteSec).toBeLessThanOrEqual(FIRE_MARSHAL_TTE_LIMIT_SEC);
      expect(simulation.violationMessage).toBeNull();
    });

    it("is walking-distance limited when the door is wide enough", () => {
      const simulation = simulateEvacuation(
        [
          asset({
            id: "exit-wide",
            kind: "exit",
            label: "Grand Aisle",
            x: 40,
            y: 0,
            width: 40,
            height: 2,
          }),
        ],
        SINGLE_EXIT_VENUE,
        40,
      );

      expect(simulation.compliant).toBe(true);
      expect(simulation.bottleneck?.flowLimited).toBe(false);
      expect(describeBottleneck(simulation)).toContain("walking distance");
    });

    it("treats an empty capacity as nothing to evacuate", () => {
      const simulation = simulateEvacuation([], SINGLE_EXIT_VENUE, 0);

      expect(simulation.compliant).toBe(true);
      expect(simulation.tteSec).toBe(0);
      expect(describeBottleneck(simulation)).toContain("nothing to evacuate");
    });
  });

  describe("remedies the error message offers", () => {
    it("halves the queue when a second exit is added", () => {
      const single = simulateEvacuation([], SINGLE_EXIT_VENUE, 500);
      const double = simulateEvacuation([], TWO_EXIT_VENUE, 500);

      expect(double.tteSec).toBeLessThan(single.tteSec);
      expect(double.doors.every((door) => door.assignedOccupants < 500)).toBe(true);
      expect(
        double.doors.reduce((total, door) => total + door.assignedOccupants, 0),
      ).toBeGreaterThanOrEqual(500);
    });

    it("clears the violation when capacity is reduced", () => {
      // One 2 people/second door drains N occupants in N/2 seconds, so the hall
      // stops violating the 180 s limit somewhere below 360 occupants.
      expect(simulateEvacuation([], SINGLE_EXIT_VENUE, 500).compliant).toBe(false);
      expect(simulateEvacuation([], SINGLE_EXIT_VENUE, 400).compliant).toBe(false);
      expect(simulateEvacuation([], SINGLE_EXIT_VENUE, 300).compliant).toBe(true);
      expect(simulateEvacuation([], SINGLE_EXIT_VENUE, 300).tteSec).toBe(150);
    });

    it("routes occupants to their nearest door rather than splitting them evenly", () => {
      const simulation = simulateEvacuation(
        [
          asset({
            id: "exit-corner",
            kind: "exit",
            label: "Corner Exit",
            x: 0,
            y: 0,
            width: 4,
            height: 2,
          }),
        ],
        SINGLE_EXIT_VENUE,
        400,
      );

      const centre = simulation.doors.find((door) => door.doorId === "fire_exit_0");
      const corner = simulation.doors.find((door) => door.doorId === "exit-corner");

      // The centre door serves the bulk of a rectangular hall; the corner serves less.
      expect(centre!.assignedOccupants).toBeGreaterThan(corner!.assignedOccupants);
    });
  });

  describe("furniture that traps occupants", () => {
    it("reports occupants walled off from every exit", () => {
      const wall: FloorplanAsset[] = [
        asset({ id: "wall", label: "Vendor Wall", x: 0, y: 20, width: 100, height: 4 }),
      ];
      const simulation = simulateEvacuation(wall, SINGLE_EXIT_VENUE, 500);

      expect(simulation.compliant).toBe(false);
      expect(simulation.trappedOccupants).toBeGreaterThan(0);
      expect(simulation.violationMessage).toContain("have no path to an exit");
      expect(describeBottleneck(simulation)).toContain("no route to any exit");
    });

    it("does not treat exit assets as obstacles", () => {
      const withExitAsset = simulateEvacuation(
        [asset({ id: "exit-1", kind: "exit", label: "Aisle", x: 40, y: 0, width: 4, height: 2 })],
        SINGLE_EXIT_VENUE,
        100,
      );

      expect(withExitAsset.trappedOccupants).toBe(0);
      expect(withExitAsset.reachableAreaSqFt).toBeGreaterThan(0);
    });

    it("flags a layout with no exit doors at all", () => {
      const simulation = simulateEvacuation([], { ...SINGLE_EXIT_VENUE, fire_exits: [] }, 120);

      expect(simulation.compliant).toBe(false);
      expect(simulation.trappedOccupants).toBe(120);
    });
  });

  describe("hard save gate", () => {
    it("returns the simulation for a compliant layout", () => {
      const simulation = assertEvacuationCompliance([], TWO_EXIT_VENUE, 100);
      expect(simulation.compliant).toBe(true);
    });

    it("throws the message specified in #5290, with the computed numbers", () => {
      let thrown: EvacuationComplianceError | null = null;
      try {
        assertEvacuationCompliance([], SINGLE_EXIT_VENUE, 500);
      } catch (err) {
        thrown = err as EvacuationComplianceError;
      }

      expect(thrown).toBeInstanceOf(EvacuationComplianceError);
      expect(thrown!.name).toBe("EvacuationComplianceError");
      expect(thrown!.message).toMatch(
        /^CRITICAL SAFETY VIOLATION: Current layout requires \d+ seconds to evacuate\. Maximum allowed is 180 seconds\. You must add another exit aisle or reduce capacity before saving\.$/,
      );
      expect(thrown!.simulation.tteSec).toBeGreaterThan(180);
    });

    it("respects a stricter local limit", () => {
      expect(() => assertEvacuationCompliance([], SINGLE_EXIT_VENUE, 200, 60)).toThrow(
        /Maximum allowed is 60 seconds/,
      );
    });

    it("does not throw for a layout with no occupants", () => {
      expect(() => assertEvacuationCompliance([], SINGLE_EXIT_VENUE, 0)).not.toThrow();
    });
  });
});
