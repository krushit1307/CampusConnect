import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttendeeVenueMap, type AttendeeMapNode } from "./AttendeeVenueMap";

vi.mock("@/components/Auth/AuthSecurityContext", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));

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

describe("AttendeeVenueMap VIP Seating", () => {
  const vipNodes: AttendeeMapNode[] = [
    {
      id: "vip-table-1",
      entity_name: "VIP Table 1",
      type: "table",
      x_coord: 10,
      y_coord: 10,
      width: 5,
      height: 5,
      rotation: 0,
      required_ticket_tier_id: "vip-tier-123",
    },
    {
      id: "ga-table-1",
      entity_name: "GA Table 1",
      type: "table",
      x_coord: 20,
      y_coord: 20,
      width: 5,
      height: 5,
      rotation: 0,
    },
  ];

  it("blocks selection when GA user clicks a VIP table", async () => {
    // We expect a toast to fire, but just testing UI change is sufficient
    // for this unit test if sonner is not easily mockable in the inline way.
    render(<AttendeeVenueMap nodes={vipNodes} userTicketTierId="ga-tier" />);

    // The VIP table should have the VIP label
    const vipTable = screen.getByRole("img", { name: /VIP Table 1 map element/i });
    expect(vipTable).toBeInTheDocument();

    // It should have the VIP styling (amber-200)
    expect(vipTable.className).toContain("bg-amber-200");
    expect(vipTable.textContent).toContain("VIP table");

    // Click the VIP table
    fireEvent.click(vipTable);

    // We expect it not to be selected (no lime-300)
    expect(vipTable.className).not.toContain("bg-lime-300");
  });

  it("allows selection when VIP user clicks a VIP table and calls onSeatSelected", async () => {
    const onSeatSelected = vi.fn();
    render(
      <AttendeeVenueMap
        nodes={vipNodes}
        userTicketTierId="vip-tier-123"
        onSeatSelected={onSeatSelected}
      />,
    );

    const vipTable = screen.getByRole("img", { name: /VIP Table 1 map element/i });

    fireEvent.click(vipTable);

    // Should get selected styling
    expect(vipTable.className).toContain("bg-lime-300");
    expect(onSeatSelected).toHaveBeenCalledWith("vip-table-1");
  });

  it("selects seat based on assignedSeatNodeId", () => {
    render(<AttendeeVenueMap nodes={vipNodes} assignedSeatNodeId="ga-table-1" />);

    const gaTable = screen.getByRole("img", { name: /GA Table 1 map element/i });
    expect(gaTable.className).toContain("bg-lime-300");
  });
});
