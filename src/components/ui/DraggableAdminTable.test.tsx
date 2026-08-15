import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraggableAdminTable } from "./DraggableAdminTable";
import type { ColumnDef } from "@tanstack/react-table";

interface TestRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

const columns: ColumnDef<TestRow, unknown>[] = [
  { id: "name", accessorKey: "name", header: "Name" },
  { id: "email", accessorKey: "email", header: "Email" },
  { id: "role", accessorKey: "role", header: "Role" },
];

const mockData: TestRow[] = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", role: "Admin" },
  { id: "2", name: "Bob Smith", email: "bob@example.com", role: "Member" },
];

describe("DraggableAdminTable component (#1730)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders headers and data rows correctly", () => {
    render(<DraggableAdminTable tableId="test_table" data={mockData} columns={columns} />);

    expect(screen.getAllByText("Name")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Email")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Role")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Alice Johnson")[0]).toBeInTheDocument();
    expect(screen.getAllByText("bob@example.com")[0]).toBeInTheDocument();
  });

  it("persists column order to localStorage when initialized", () => {
    render(<DraggableAdminTable tableId="test_table_persist" data={mockData} columns={columns} />);

    const saved = localStorage.getItem("table_layout_test_table_persist");
    expect(saved).toBeDefined();
    expect(JSON.parse(saved!)).toEqual(["name", "email", "role"]);
  });

  it("loads initial column order from localStorage if present", () => {
    localStorage.setItem(
      "table_layout_test_table_custom",
      JSON.stringify(["email", "role", "name"]),
    );

    render(<DraggableAdminTable tableId="test_table_custom" data={mockData} columns={columns} />);

    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveTextContent("Email");
    expect(headers[1]).toHaveTextContent("Role");
    expect(headers[2]).toHaveTextContent("Name");
  });

  it("opens Manage Columns modal and allows column reordering", () => {
    render(<DraggableAdminTable tableId="test_table_modal" data={mockData} columns={columns} />);

    const manageBtn = screen.getByLabelText("Manage columns layout");
    fireEvent.click(manageBtn);

    expect(screen.getByText("Manage Column Order")).toBeInTheDocument();

    const moveDownBtn = screen.getByLabelText("Move Name down");
    fireEvent.click(moveDownBtn);

    const saved = localStorage.getItem("table_layout_test_table_modal");
    expect(JSON.parse(saved!)).toEqual(["email", "name", "role"]);
  });
});
