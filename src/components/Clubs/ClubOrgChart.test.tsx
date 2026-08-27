import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ClubOrgChart, MOCK_INITIAL_ORG_NODES } from "./ClubOrgChart";

describe("ClubOrgChart Component (#3609)", () => {
  it("renders Leadership Hierarchy header and root executive nodes", () => {
    render(
      <ClubOrgChart
        clubName="Computer Science Society"
        initialNodes={MOCK_INITIAL_ORG_NODES}
        isAdmin={true}
      />
    );

    expect(screen.getByText(/Interactive Leadership Hierarchy & Org Chart — Computer Science Society/i)).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.getByText("Sam Chen")).toBeInTheDocument();
    expect(screen.getByText("VP of Engineering")).toBeInTheDocument();
  });

  it("opens executive bio inspection drawer on node click", () => {
    render(
      <ClubOrgChart
        clubName="Computer Science Society"
        initialNodes={MOCK_INITIAL_ORG_NODES}
      />
    );

    const presCard = screen.getByText("Alex Rivera");
    fireEvent.click(presCard);

    expect(screen.getByText(/Leadership Bio/i)).toBeInTheDocument();
    expect(screen.getByText(/Senior CS major passionate about developer advocacy/i)).toBeInTheDocument();
    expect(screen.getByText("alex.pres@campus.edu")).toBeInTheDocument();
  });

  it("opens add leadership role modal in admin mode", () => {
    render(
      <ClubOrgChart
        clubName="Computer Science Society"
        initialNodes={MOCK_INITIAL_ORG_NODES}
        isAdmin={true}
      />
    );

    const addBtn = screen.getByRole("button", { name: /Add Leadership Role/i });
    fireEvent.click(addBtn);

    expect(screen.getByRole("heading", { name: /Add New Leadership Role/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Executive \/ Member Name \*/i)).toBeInTheDocument();
  });

  it("allows deleting a leadership node", () => {
    const handleDelete = vi.fn();
    render(
      <ClubOrgChart
        clubName="Computer Science Society"
        initialNodes={MOCK_INITIAL_ORG_NODES}
        isAdmin={true}
        onDeleteNode={handleDelete}
      />
    );

    const deleteButtons = screen.getAllByTitle("Delete role");
    fireEvent.click(deleteButtons[0]);

    expect(handleDelete).toHaveBeenCalled();
  });
});
