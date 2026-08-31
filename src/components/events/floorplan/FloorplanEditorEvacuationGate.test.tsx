// =============================================================================
// Component Tests: FloorplanEditor evacuation save gate
// Issue: #5290 - Interactive "Event Layout" Emergency Exit Evacuation Bottleneck Simulator
// Description: The regression these tests exist for is the one in the issue: an
// organizer clicking past a visible bottleneck. Asserts the Save control is
// disabled, the violation is stated in seconds, and onSave is never reached while
// the layout exceeds the fire marshal's limit.
// =============================================================================

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FloorplanEditor } from "./FloorplanEditor";
import { simulateEvacuation } from "../../../lib/floorplan/evacuation";
import { VenueBounds } from "../../../lib/floorplan/types";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// The canvas is an SVG scene graph with its own drag behaviour; the gate under
// test lives in the toolbar, so it is stubbed to keep the assertions readable.
vi.mock("./FloorplanCanvas", () => ({
  FloorplanCanvas: () => <div data-testid="canvas" />,
}));

/** 100x60 ft hall with a single 4 ft door, i.e. 2 occupants per second. */
const SINGLE_EXIT_VENUE: VenueBounds = {
  width_ft: 100,
  height_ft: 60,
  fire_exits: [{ x_ft: 50, y_ft: 0, side: "top" }],
};

const editorProps = (over: Record<string, unknown> = {}) => ({
  eventId: "event-1",
  venue: SINGLE_EXIT_VENUE,
  assets: [],
  collidingIds: new Set<string>(),
  isSaving: false,
  onAdd: vi.fn(),
  onMove: vi.fn(),
  onUpdate: vi.fn(),
  onRemove: vi.fn(),
  onVenueSize: vi.fn(),
  onSave: vi.fn().mockResolvedValue(true),
  onAddPoi: vi.fn(),
  onMovePoi: vi.fn(),
  onUpdatePoi: vi.fn(),
  onRemovePoi: vi.fn(),
  ...over,
});

describe("FloorplanEditor evacuation gate (#5290)", () => {
  it("hard-blocks saving the 500-occupant single-door layout", () => {
    const evacuation = simulateEvacuation([], SINGLE_EXIT_VENUE, 500);
    expect(evacuation.compliant).toBe(false);

    const props = editorProps({ evacuation });
    render(<FloorplanEditor {...(props as never)} />);

    const save = screen.getByTestId("floorplan-save");
    expect(save).toBeDisabled();
    expect(save).toHaveTextContent("Save blocked");
    expect(screen.getByTestId("evacuation-violation")).toHaveTextContent(
      /CRITICAL SAFETY VIOLATION: Current layout requires \d+ seconds to evacuate\. Maximum allowed is 180 seconds\./,
    );
    expect(screen.getByTestId("evacuation-tte")).toHaveTextContent("250s");
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it("allows the save once the layout clears inside the limit", async () => {
    const evacuation = simulateEvacuation([], SINGLE_EXIT_VENUE, 100);
    expect(evacuation.compliant).toBe(true);

    const props = editorProps({ evacuation });
    render(<FloorplanEditor {...(props as never)} />);

    const save = screen.getByTestId("floorplan-save");
    expect(save).toBeEnabled();
    expect(screen.queryByTestId("evacuation-violation")).not.toBeInTheDocument();
    expect(screen.getByTestId("evacuation-simulation")).toHaveTextContent("100 occupants");

    fireEvent.click(save);
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
  });

  it("surfaces a violation raised by the service-side gate", () => {
    render(
      <FloorplanEditor
        {...(editorProps({
          evacuation: simulateEvacuation([], SINGLE_EXIT_VENUE, 100),
          saveError:
            "CRITICAL SAFETY VIOLATION: Current layout requires 250 seconds to evacuate. Maximum allowed is 180 seconds. You must add another exit aisle or reduce capacity before saving.",
        }) as never)}
      />,
    );

    expect(screen.getByTestId("evacuation-violation")).toHaveTextContent("250 seconds");
  });
});
