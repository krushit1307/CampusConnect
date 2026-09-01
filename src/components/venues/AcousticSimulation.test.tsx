import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AcousticSimulationPanel } from "./AcousticSimulationPanel";
import { AcousticVisualizerCanvas } from "./AcousticVisualizerCanvas";
import {
  AcousticSimulationResults,
  AcousticSpeakerConfig,
  AcousticWallConfig,
} from "../../types/acoustic";

describe("AcousticSimulationPanel Component", () => {
  const mockSpeakers: AcousticSpeakerConfig[] = [
    {
      id: "spk-1",
      label: "Left Main Horn",
      x: -5,
      y: 2,
      z: -3,
      yaw: 15,
      pitch: -5,
      coneAngle: 90,
      dbOutput: 102,
    },
  ];

  const mockWalls: AcousticWallConfig[] = [
    { type: "left", name: "Left Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "right", name: "Right Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "floor", name: "Floor", absorptionCoefficient: 0.2, materialPreset: "carpet_thin" },
    { type: "ceiling", name: "Ceiling", absorptionCoefficient: 0.05, materialPreset: "concrete" },
    { type: "front", name: "Front Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "back", name: "Back Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
  ];

  const mockResults: AcousticSimulationResults = {
    rt60SabineSeconds: 1.45,
    rt60RayTracedSeconds: 1.55,
    directEnergy: 1000,
    reflectedEnergy: 800,
    directToReverberantRatioDb: 0.96,
    warningSeverity: "moderate",
    warningMessage: "Moderate Reverb Warning: Simulated decay time is high.",
    actionableGuidance: [
      "Apply Wall Damping: Side walls are highly reflective.",
      "Rotate & Angle Speakers: Angle speakers inward.",
    ],
    flutterEchoDetected: true,
    rays: [],
  };

  it("renders RT60 simulation results, warnings, and recommendations", () => {
    render(
      <AcousticSimulationPanel
        speakers={mockSpeakers}
        walls={mockWalls}
        results={mockResults}
        selectedSpeakerId={null}
        rayCount={200}
        onSelectSpeaker={vi.fn()}
        onUpdateSpeaker={vi.fn()}
        onAddSpeaker={vi.fn()}
        onRemoveSpeaker={vi.fn()}
        onUpdateWall={vi.fn()}
        onUpdateRayCount={vi.fn()}
      />,
    );

    expect(screen.getByText("1.45s")).toBeInTheDocument();
    expect(screen.getByText("1.55s")).toBeInTheDocument();
    expect(screen.getByText(/Moderate Reverb Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Apply Wall Damping/i)).toBeInTheDocument();
    expect(screen.getByText(/Rotate & Angle Speakers/i)).toBeInTheDocument();
  });

  it("allows selecting a speaker and editing its db output volume", () => {
    const handleUpdateSpeaker = vi.fn();
    render(
      <AcousticSimulationPanel
        speakers={mockSpeakers}
        walls={mockWalls}
        results={mockResults}
        selectedSpeakerId="spk-1"
        rayCount={200}
        onSelectSpeaker={vi.fn()}
        onUpdateSpeaker={handleUpdateSpeaker}
        onAddSpeaker={vi.fn()}
        onRemoveSpeaker={vi.fn()}
        onUpdateWall={vi.fn()}
        onUpdateRayCount={vi.fn()}
      />,
    );

    expect(screen.getByText(/Editing: Left Main Horn/i)).toBeInTheDocument();
    const sliders = screen.getAllByRole("slider");
    const volumeSlider = sliders[0]; // first range input is the volume
    expect(volumeSlider).toBeInTheDocument();

    // Trigger value changes
    fireEvent.change(volumeSlider, { target: { value: "110" } });
    expect(handleUpdateSpeaker).toHaveBeenCalled();
  });

  it("toggles to wall configurations tab and lists all configurable surfaces", () => {
    const handleUpdateWall = vi.fn();
    render(
      <AcousticSimulationPanel
        speakers={mockSpeakers}
        walls={mockWalls}
        results={mockResults}
        selectedSpeakerId={null}
        rayCount={200}
        onSelectSpeaker={vi.fn()}
        onUpdateSpeaker={vi.fn()}
        onAddSpeaker={vi.fn()}
        onRemoveSpeaker={vi.fn()}
        onUpdateWall={handleUpdateWall}
        onUpdateRayCount={vi.fn()}
      />,
    );

    const wallsTab = screen.getByRole("button", { name: /Wall Dampings/i });
    fireEvent.click(wallsTab);

    expect(screen.getByText(/Select surface damping materials/i)).toBeInTheDocument();
    expect(screen.getByText("Left Wall:")).toBeInTheDocument();
    expect(screen.getByText("Ceiling:")).toBeInTheDocument();

    // select ceiling concrete preset
    const ceilingSelect = screen.getAllByRole("combobox")[3];
    fireEvent.change(ceilingSelect, { target: { value: "acoustic_foam" } });

    expect(handleUpdateWall).toHaveBeenCalledWith("ceiling", 0.85, "acoustic_foam");
  });
});

describe("AcousticVisualizerCanvas Component", () => {
  const mockSpeakers: AcousticSpeakerConfig[] = [
    {
      id: "spk-1",
      label: "Left Main Horn",
      x: -5,
      y: 2,
      z: -3,
      yaw: 15,
      pitch: -5,
      coneAngle: 90,
      dbOutput: 102,
    },
  ];

  const mockWalls: AcousticWallConfig[] = [
    { type: "left", name: "Left Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "right", name: "Right Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "floor", name: "Floor", absorptionCoefficient: 0.2, materialPreset: "carpet_thin" },
    { type: "ceiling", name: "Ceiling", absorptionCoefficient: 0.05, materialPreset: "concrete" },
    { type: "front", name: "Front Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
    { type: "back", name: "Back Wall", absorptionCoefficient: 0.1, materialPreset: "plaster" },
  ];

  it("renders html5 canvas element with spatial configuration bounds", () => {
    const handleSelectSpeaker = vi.fn();
    const { container } = render(
      <AcousticVisualizerCanvas
        widthMeters={30}
        depthMeters={20}
        speakers={mockSpeakers}
        rays={[]}
        walls={mockWalls}
        selectedSpeakerId={null}
        onSelectSpeaker={handleSelectSpeaker}
        onUpdateSpeaker={vi.fn()}
      />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas?.width).toBe(500);
    expect(canvas?.height).toBe(400);
  });
});
