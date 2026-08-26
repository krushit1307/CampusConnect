import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoleBadge } from "./RoleBadge";

describe("RoleBadge Component", () => {
  it("renders Admin role badge correctly", () => {
    render(<RoleBadge role="admin" />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders Organizer role badge correctly", () => {
    render(<RoleBadge role="organizer" />);
    expect(screen.getByText("Organizer")).toBeInTheDocument();
  });

  it("renders Member role badge correctly", () => {
    render(<RoleBadge role="member" />);
    expect(screen.getByText("Member")).toBeInTheDocument();
  });

  it("renders Alumni role badge correctly", () => {
    render(<RoleBadge role="alumni" />);
    expect(screen.getByText("Alumni")).toBeInTheDocument();
  });
});
