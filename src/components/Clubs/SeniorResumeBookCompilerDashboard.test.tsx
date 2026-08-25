import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  SeniorResumeBookCompilerDashboard,
  MOCK_SENIOR_PROFILES,
} from "./SeniorResumeBookCompilerDashboard";

describe("SeniorResumeBookCompilerDashboard Component (#4288)", () => {
  it("renders Senior Resume Book Compiler header, roster metrics, and cover page preview", () => {
    render(
      <SeniorResumeBookCompilerDashboard
        clubName="Computer Science Society"
        initialSeniors={MOCK_SENIOR_PROFILES}
      />
    );

    expect(screen.getByText(/Automated "Graduating Senior" Resume Book Compiler — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText("Graduating Seniors")).toBeInTheDocument();
    expect(screen.getByText("Sponsor Recipients")).toBeInTheDocument();
    expect(screen.getByText(/3 Verified Senior Graduates Included/i)).toBeInTheDocument();
  });

  it("navigates multi-page preview to view individual senior profile pages", () => {
    render(
      <SeniorResumeBookCompilerDashboard
        clubName="Computer Science Society"
        initialSeniors={MOCK_SENIOR_PROFILES}
      />
    );

    const buttons = screen.getAllByRole("button");
    // Find the next page button (which contains chevron right icon)
    const nextBtn = buttons[2]; // Compile btn is index 0, prev page is index 1, next page is index 2
    fireEvent.click(nextBtn);

    expect(screen.getByText("Alice Vance")).toBeInTheDocument();
    expect(screen.getByText("GPA: 3.92")).toBeInTheDocument();
  });

  it("dispatches compiled resume book packet to corporate sponsors", () => {
    const handleDispatch = vi.fn();
    render(
      <SeniorResumeBookCompilerDashboard
        clubName="Computer Science Society"
        initialSeniors={MOCK_SENIOR_PROFILES}
        onDispatchToSponsors={handleDispatch}
      />
    );

    const dispatchBtn = screen.getByRole("button", { name: /Compile & Dispatch to Sponsors/i });
    fireEvent.click(dispatchBtn);

    expect(handleDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining("Computer Science Society"),
      })
    );
  });
});
