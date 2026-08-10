import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventWizard } from "../src/components/EventWizard/EventWizard";
import { clearWizardState } from "../src/utils/sessionPersistence";

describe("wizard flow integration", () => {
  beforeEach(() => {
    clearWizardState();
  });

  it("renders the basics step initially", () => {
    render(<EventWizard />);
    expect(screen.getByText(/Event Title/i)).toBeInTheDocument();
  });

  it("prevents next on empty form", () => {
    render(<EventWizard />);
    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
  });
});
