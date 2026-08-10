import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { RadialFAB } from "./RadialFAB";
import { getRadialOffset } from "./radialFabUtils";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function renderRadialFab() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <RadialFAB />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("RadialFAB", () => {
  it("calculates the three action positions across a 90-degree arc", () => {
    expect(getRadialOffset(90)).toEqual({ x: 0, y: -80 });
    expect(getRadialOffset(135)).toEqual({ x: -57, y: -57 });
    expect(getRadialOffset(180)).toEqual({ x: -80, y: 0 });
  });

  it("opens actions and closes them when the backdrop is tapped", async () => {
    renderRadialFab();

    const trigger = screen.getByRole("button", { name: /open creation menu/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Create Event" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Message" })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("radial-fab-backdrop"));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Create Event" })).not.toBeInTheDocument();
    });
  });

  it("navigates to the selected creation route", () => {
    renderRadialFab();

    fireEvent.click(screen.getByRole("button", { name: /open creation menu/i }));
    fireEvent.click(screen.getByRole("button", { name: "New Message" }));

    expect(screen.getByTestId("location")).toHaveTextContent("/messages");
  });
});
