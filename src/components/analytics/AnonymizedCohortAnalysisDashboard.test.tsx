import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AnonymizedCohortAnalysisDashboard } from "./AnonymizedCohortAnalysisDashboard";

describe("AnonymizedCohortAnalysisDashboard Component (#4670)", () => {
  it("renders Anonymized Cohort Analysis header, research query inputs, and purge simulator", () => {
    render(
      <AnonymizedCohortAnalysisDashboard
        initialMajor="Computer Science"
        initialGradYear={2024}
      />
    );

    expect(screen.getByText(/Automated "Data Privacy" Anonymized Cohort Analysis/i)).toBeInTheDocument();
    expect(screen.getByText("Academic Major *")).toBeInTheDocument();
    expect(screen.getByText("Graduation Year *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Query Anonymized Cohort Analytics/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anonymize & Purge User PII/i })).toBeInTheDocument();
  });

  it("updates cohort research query when form is submitted", () => {
    render(
      <AnonymizedCohortAnalysisDashboard
        initialMajor="Data Science"
        initialGradYear={2025}
      />
    );

    const queryBtn = screen.getByRole("button", { name: /Query Anonymized Cohort Analytics/i });
    fireEvent.click(queryBtn);

    expect(screen.getByText("Cohort_Data_Science_2025")).toBeInTheDocument();
  });

  it("simulates user PII purge and triggers onAnonymizationCompleted callback", () => {
    const handleCompleted = vi.fn();
    render(
      <AnonymizedCohortAnalysisDashboard
        initialMajor="Computer Science"
        initialGradYear={2024}
        onAnonymizationCompleted={handleCompleted}
      />
    );

    const purgeBtn = screen.getByRole("button", { name: /Anonymize & Purge User PII/i });
    fireEvent.click(purgeBtn);

    expect(handleCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        cohortHash: "Cohort_Computer_Science_2024",
        piiPurged: true,
      })
    );

    expect(screen.getByText(/COHORT RE-PARENTING AUDIT/i)).toBeInTheDocument();
  });
});
