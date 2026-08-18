import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Venue3DModelViewer } from "./Venue3DModelViewer";
import { VenueSpatialPlanner } from "./VenueSpatialPlanner";

describe("Venue3DModelViewer Component (#3447)", () => {
  it("renders 3D spatial viewer header and WebGL canvas viewport", () => {
    render(
      <Venue3DModelViewer
        venueName="Grand Ballroom"
        widthMeters={30}
        depthMeters={20}
      />,
    );

    expect(screen.getByText(/3D Spatial Venue Planner — Grand Ballroom/i)).toBeInTheDocument();
    expect(screen.getByTestId("webgl-canvas-viewport")).toBeInTheDocument();
    expect(screen.getByText(/Test Circular Table Layout/i)).toBeInTheDocument();
  });

  it("toggles between WebGL 3D View and 2D Spatial Floorplan", () => {
    render(<Venue3DModelViewer venueName="Grand Ballroom" />);

    const floorplanBtn = screen.getByRole("button", { name: /2D Spatial Floorplan/i });
    fireEvent.click(floorplanBtn);

    expect(screen.getByTestId("2d-floorplan-viewport")).toBeInTheDocument();
  });

  it("allows adding 3D table and stage primitives to the spatial layout", () => {
    const handleLayoutChange = vi.fn();
    render(
      <Venue3DModelViewer
        venueName="Grand Ballroom"
        onLayoutChange={handleLayoutChange}
      />,
    );

    const addStageBtn = screen.getByRole("button", { name: /\+ Stage/i });
    fireEvent.click(addStageBtn);

    expect(handleLayoutChange).toHaveBeenCalled();
  });

  it("renders VenueSpatialPlanner wrapper with 3D model settings toggle", () => {
    render(<VenueSpatialPlanner venueName="Gala Ballroom" />);

    expect(screen.getByText(/Venue 3D Model & Layout Planner/i)).toBeInTheDocument();

    const settingsBtn = screen.getByRole("button", { name: /3D Model Settings/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/Configure 3D WebGL Model File/i)).toBeInTheDocument();
  });
});
