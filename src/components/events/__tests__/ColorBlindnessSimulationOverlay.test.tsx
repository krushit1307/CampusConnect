import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorBlindnessSimulationOverlay } from "../ColorBlindnessSimulationOverlay";

describe("ColorBlindnessSimulationOverlay Component", () => {
  it("renders simulator title, control toolbar, and active badge", () => {
    render(
      <ColorBlindnessSimulationOverlay>
        <div>Test Event Page Editor Content</div>
      </ColorBlindnessSimulationOverlay>
    );

    expect(screen.getByTestId("color-blindness-simulator-overlay")).toBeDefined();
    expect(screen.getByText("Color Blindness Simulator")).toBeDefined();
    expect(screen.getByTestId("simulator-active-badge")).toBeDefined();
    expect(screen.getByText("Test Event Page Editor Content")).toBeDefined();
  });

  it("switches active CVD mode when mode selection button is clicked", () => {
    render(
      <ColorBlindnessSimulationOverlay initialMode="normal">
        <div>Editor Canvas</div>
      </ColorBlindnessSimulationOverlay>
    );

    const deutBtn = screen.getByTestId("cvd-mode-btn-deuteranopia");
    fireEvent.click(deutBtn);

    expect(screen.getByTestId("simulator-active-badge").textContent).toContain("Deuteranopia");
  });

  it("toggles split view preview container on button click", () => {
    render(
      <ColorBlindnessSimulationOverlay>
        <div>Editor Canvas Content</div>
      </ColorBlindnessSimulationOverlay>
    );

    const toggleBtn = screen.getByTestId("toggle-split-view-btn");
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("simulator-split-view-container")).toBeDefined();
    expect(screen.getByText("Normal Vision (100% Color RGB)")).toBeDefined();
  });

  it("renders diagnostic accessibility report panel with WCAG rating", () => {
    render(
      <ColorBlindnessSimulationOverlay
        primaryColor="#10B981"
        backgroundColor="#FFFFFF"
        textColor="#000000"
        showDiagnosticPanel={true}
      >
        <div>Audited Event Content</div>
      </ColorBlindnessSimulationOverlay>
    );

    expect(screen.getByTestId("diagnostic-accessibility-report")).toBeDefined();
    expect(screen.getByText(/Diagnostic Accessibility Audit Report/i)).toBeDefined();
  });
});
