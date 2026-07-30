import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventWizard } from "../src/components/EventWizard/EventWizard";

describe("accessibility", () => {
  it("renders with a main heading", () => {
    render(<EventWizard />);
    expect(screen.getByRole("heading", { name: /Create New Event/i })).toBeInTheDocument();
  });
});
