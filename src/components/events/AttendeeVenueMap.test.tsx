import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttendeeVenueMap, type AttendeeMapNode } from "./AttendeeVenueMap";

const nodes: AttendeeMapNode[] = [
  {
    id: "entrance-1",
    entity_name: "Main Entrance",
    type: "entrance",
    x_coord: 0,
    y_coord: 0,
    width: 5,
    height: 5,
    rotation: 0,
  },
  {
    id: "elevator-1",
    entity_name: "North Elevator",
    type: "elevator",
    x_coord: 40,
    y_coord: 0,
    width: 5,
    height: 5,
    rotation: 0,
  },
  {
    id: "sponsor-1",
    entity_name: "Sponsor Booth",
    type: "sponsor",
    x_coord: 70,
    y_coord: 70,
    width: 10,
    height: 10,
    rotation: 0,
  },
];

describe("AttendeeVenueMap accessibility mode", () => {
  it("reveals the route guide and narrated node labels when toggled", () => {
    render(<AttendeeVenueMap nodes={nodes} />);

    expect(
      screen.queryByRole("heading", { name: /accessible route guide/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /accessibility mode/i }));

    expect(screen.getByRole("heading", { name: /accessible route guide/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /accessibility mode/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("img", { name: /north elevator is approximately 10 feet east/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/blue lines connect/i)).toBeInTheDocument();
  });
});
