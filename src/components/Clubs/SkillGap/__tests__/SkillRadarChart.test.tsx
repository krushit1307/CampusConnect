import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SkillRadarChart } from "../SkillRadarChart";
import { DEFAULT_HEURISTIC_MATRIX } from "@/services/clubSkillGapService";

// Mock recharts because ResponsiveContainer needs a DOM size
vi.mock("recharts", async () => {
  const OriginalRechartsModule = await vi.importActual<any>("recharts");

  return {
    ...OriginalRechartsModule,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: "500px", height: "500px" }}>{children}</div>
    ),
    RadarChart: ({ children, data }: any) => {
      // Create a mock representation of the chart for the test DOM
      return (
        <div data-testid="radar-chart">
          {data.map((d: any) => (
            <div key={d.subject} data-testid={`data-point-${d.subject}`}>
              <span data-testid={`subject-${d.subject}`}>{d.subject}</span>
              <span data-testid={`current-${d.subject}`}>{d.current}</span>
              <span data-testid={`target-${d.subject}`}>{d.target}</span>
            </div>
          ))}
          {children}
        </div>
      );
    },
    PolarGrid: () => <div data-testid="polar-grid" />,
    PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
    PolarRadiusAxis: () => <div data-testid="polar-radius-axis" />,
    Radar: ({ name, dataKey }: any) => <div data-testid={`radar-${name}-${dataKey}`} />,
    Tooltip: () => <div data-testid="tooltip" />,
  };
});

describe("SkillRadarChart", () => {
  const currentSkills = [
    { skill: "Marketing", count: 1 },
    { skill: "Finance", count: 2 },
  ];

  it("renders the chart with correct data mapping", () => {
    render(<SkillRadarChart currentSkills={currentSkills} />);

    // Verify radar chart container exists
    expect(screen.getByTestId("radar-chart")).toBeInTheDocument();

    // Verify it renders components from Recharts
    expect(screen.getByTestId("polar-grid")).toBeInTheDocument();
    expect(screen.getByTestId("polar-angle-axis")).toBeInTheDocument();
    expect(screen.getByTestId("polar-radius-axis")).toBeInTheDocument();
    expect(screen.getByTestId("radar-Current Team Skills-current")).toBeInTheDocument();
    expect(screen.getByTestId("radar-Healthy Target-target")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();

    // Check data points
    // Marketing
    expect(screen.getByTestId("subject-Marketing")).toBeInTheDocument();
    expect(screen.getByTestId("current-Marketing").textContent).toBe("1");
    expect(screen.getByTestId("target-Marketing").textContent).toBe("1"); // Default heuristic target for Marketing

    // Finance
    expect(screen.getByTestId("subject-Finance")).toBeInTheDocument();
    expect(screen.getByTestId("current-Finance").textContent).toBe("2");
    expect(screen.getByTestId("target-Finance").textContent).toBe("1");
  });

  it("includes zero-count skills from heuristic", () => {
    render(<SkillRadarChart currentSkills={currentSkills} />);

    // Design should be there with current=0 and target=1
    expect(screen.getByTestId("subject-Graphic Design")).toBeInTheDocument();
    expect(screen.getByTestId("current-Graphic Design").textContent).toBe("0");
    expect(screen.getByTestId("target-Graphic Design").textContent).toBe("1");

    // Logistics should be there with current=0 and target=1
    expect(screen.getByTestId("subject-Logistics")).toBeInTheDocument();
    expect(screen.getByTestId("current-Logistics").textContent).toBe("0");
    expect(screen.getByTestId("target-Logistics").textContent).toBe("1");
  });

  it("handles empty properties and no skills gracefully", () => {
    render(<SkillRadarChart currentSkills={[]} heuristic={{}} />);

    // Renders the empty state fallback UI
    expect(screen.getByText("No skills to display.")).toBeInTheDocument();
  });

  it("handles case insensitivity bridging current and requested skills", () => {
    const mixedCaseSkills = [{ skill: "mArKeTiNg", count: 3 }];

    render(<SkillRadarChart currentSkills={mixedCaseSkills} />);

    // Should map properly based on lowercased comparison inside component logic
    expect(screen.getByTestId("current-Marketing").textContent).toBe("3");
  });
});
