import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CampusSafetyDroneSwarmSimulator } from "../CampusSafetyDroneSwarmSimulator";
import { DroneSwarmSimulationEngine } from "@/lib/campusSafety/droneSwarmSimulationEngine";

describe("CampusSafetyDroneSwarmSimulator (#5352)", () => {
  it("1. Three simulated drones are created with status available", () => {
    const engine = new DroneSwarmSimulationEngine(640, 460);
    const state = engine.getState();

    expect(state.drones).toHaveLength(3);
    expect(state.drones[0].name).toBe("Drone 01");
    expect(state.drones[1].name).toBe("Drone 02");
    expect(state.drones[2].name).toBe("Drone 03");

    state.drones.forEach((drone) => {
      expect(drone.status).toBe("available");
    });
  });

  it("2. Deployment changes drone states correctly", () => {
    const engine = new DroneSwarmSimulationEngine(640, 460);
    engine.deploy();

    const state = engine.getState();
    expect(state.simulationStatus).toBe("DEPLOYED");
    expect(state.responseZoneActive).toBe(true);

    state.drones.forEach((drone) => {
      expect(drone.status).toBe("deploying");
    });
  });

  it("3. Simulation reset restores initial state", () => {
    const engine = new DroneSwarmSimulationEngine(640, 460);
    engine.deploy();
    engine.step(0.5);

    engine.reset();

    const state = engine.getState();
    expect(state.simulationStatus).toBe("IDLE");
    expect(state.responseZoneActive).toBe(false);
    state.drones.forEach((drone) => {
      expect(drone.status).toBe("available");
    });
  });

  it("4 & 5. High-density intersection produces critical safety warning in UI", () => {
    render(<CampusSafetyDroneSwarmSimulator />);

    expect(screen.getByTestId("deploy-safety-sim-btn")).toBeInTheDocument();
    expect(screen.getByTestId("reset-safety-sim-btn")).toBeInTheDocument();
    expect(screen.getByTestId("drone-swarm-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("simulation-status-panel")).toBeInTheDocument();

    // Critical safety alert banner should render
    const alertBanner = screen.getByTestId("critical-safety-alert-banner");
    expect(alertBanner).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL SAFETY ALERT/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Simulated threat trajectory intersects a high-density area/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Maintain lockdown and await emergency response/i)).toBeInTheDocument();
  });

  it("triggers deploy simulation action when button is clicked", () => {
    render(<CampusSafetyDroneSwarmSimulator />);

    const deployBtn = screen.getByTestId("deploy-safety-sim-btn");
    fireEvent.click(deployBtn);

    expect(screen.getByTestId("drone-status-drone-01")).toBeInTheDocument();
    expect(screen.getByTestId("drone-status-drone-02")).toBeInTheDocument();
    expect(screen.getByTestId("drone-status-drone-03")).toBeInTheDocument();
  });
});
