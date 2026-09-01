import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CrowdSimulationOverlay } from "../CrowdSimulationOverlay";

describe("CrowdSimulationOverlay Component (#5133)", () => {
  const mockLayoutElements = [
    { id: "ent-1", type: "entrance", x: 40, y: 40, width: 50, height: 50, label: "Main Entrance" },
    { id: "food-1", type: "table", x: 600, y: 450, width: 80, height: 60, label: "Food Table" },
    { id: "ex-1", type: "exit", x: 650, y: 500, width: 60, height: 50, label: "Emergency Exit" },
  ];

  it("renders controls, canvas, and capacity slider", () => {
    render(<CrowdSimulationOverlay layoutElements={mockLayoutElements} />);

    expect(screen.getByTestId("sim-toggle-play")).toBeInTheDocument();
    expect(screen.getByTestId("sim-reset")).toBeInTheDocument();
    expect(screen.getByTestId("sim-capacity-slider")).toBeInTheDocument();
    expect(screen.getByTestId("crowd-simulation-canvas")).toBeInTheDocument();
    expect(screen.getByText("Start Simulation")).toBeInTheDocument();
  });

  it("toggles simulation playback state on click", () => {
    render(<CrowdSimulationOverlay layoutElements={mockLayoutElements} />);

    const playButton = screen.getByTestId("sim-toggle-play");
    expect(screen.getByText("Start Simulation")).toBeInTheDocument();

    fireEvent.click(playButton);
    expect(screen.getByText("Pause")).toBeInTheDocument();

    fireEvent.click(playButton);
    expect(screen.getByText("Start Simulation")).toBeInTheDocument();
  });

  it("updates capacity when slider value changes", () => {
    render(<CrowdSimulationOverlay layoutElements={mockLayoutElements} />);

    const slider = screen.getByTestId("sim-capacity-slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "300" } });

    expect(slider.value).toBe("300");
    expect(screen.getByText("300 max")).toBeInTheDocument();
  });

  it("handles reset action clean reset", () => {
    render(<CrowdSimulationOverlay layoutElements={mockLayoutElements} />);

    const playButton = screen.getByTestId("sim-toggle-play");
    fireEvent.click(playButton);

    const resetButton = screen.getByTestId("sim-reset");
    fireEvent.click(resetButton);

    expect(screen.getByText("Start Simulation")).toBeInTheDocument();
    expect(screen.getByText("Active: 0 / 150")).toBeInTheDocument();
  });
});
