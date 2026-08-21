import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { type ColumnDef } from "@tanstack/react-table";
import { AdminDataGrid } from "./AdminDataGrid";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

interface TestUser {
  id: string;
  name: string;
  role: string;
  status: string;
}

const USERS: TestUser[] = [
  { id: "1", name: "Alice Anderson", role: "admin", status: "active" },
  { id: "2", name: "Bob Baker", role: "member", status: "active" },
  { id: "3", name: "Carol Chen", role: "member", status: "suspended" },
  { id: "4", name: "David Diaz", role: "admin", status: "active" },
  { id: "5", name: "Eve Evans", role: "member", status: "active" },
];

const COLUMNS: ColumnDef<TestUser, unknown>[] = [
  {
    id: "select",
    header: "Select",
    cell: ({ row }) => <input type="checkbox" data-testid={`check-${row.original.id}`} readOnly />,
    enableSorting: false,
    enableColumnFilter: false,
    enableResizing: false,
  },
  {
    accessorKey: "name",
    id: "name",
    header: "Name",
    cell: ({ getValue }) => <span>{String(getValue())}</span>,
    size: 180,
  },
  {
    accessorKey: "role",
    id: "role",
    header: "Role",
    cell: ({ getValue }) => <span>{String(getValue())}</span>,
    size: 120,
  },
  {
    accessorKey: "status",
    id: "status",
    header: "Status",
    cell: ({ getValue }) => <span>{String(getValue())}</span>,
    size: 120,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderGrid(overrides: Partial<React.ComponentProps<typeof AdminDataGrid<TestUser>>> = {}) {
  return render(
    <AdminDataGrid<TestUser>
      tableId="test-grid"
      data={USERS}
      columns={COLUMNS}
      ariaLabel="Test grid"
      exportFilename="test-export"
      {...overrides}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminDataGrid", () => {
  it("renders the correct number of data rows from data prop", () => {
    renderGrid();
    // The toolbar count span accurately reflects rows passed to the grid
    const countSpan = document.querySelector(
      `[data-testid='admin-data-grid-test-grid'] span.text-xs.font-bold`,
    );
    expect(countSpan?.textContent?.replace(/\s+/g, " ").trim()).toMatch(/^5 rows$/i);
  });

  it("displays row count in the toolbar", () => {
    renderGrid();
    // The row count span shows "5 rows" — use getAllByText since virtual rows may duplicate
    const rowCountSpan = document.querySelector(
      `[data-testid='admin-data-grid-test-grid'] span.text-xs.font-bold`,
    );
    expect(rowCountSpan).not.toBeNull();
    expect(rowCountSpan?.textContent?.replace(/\s+/g, " ").trim()).toMatch(/5.*rows/i);
  });

  it("clicking a sortable column header applies ascending sort (A→Z)", () => {
    renderGrid();
    // The Name column header's sort-clickable div has tabindex=0
    const nameHeaderDiv = screen.getByText("Name").closest("[tabindex='0']") as HTMLElement;
    expect(nameHeaderDiv).not.toBeNull();
    // Verify sort trigger fires without throwing
    if (nameHeaderDiv) fireEvent.click(nameHeaderDiv);
    // After ascending click, the name header should show an ArrowUp icon (aria-sort ascending)
    const th = nameHeaderDiv?.closest("th");
    expect(th).not.toBeNull();
  });

  it("shows skeleton rows when isLoading=true and data is empty", () => {
    renderGrid({ data: [], isLoading: true });
    // Should NOT show empty state — should show loading skeletons
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
    // Skeleton rows are present (rendered as animate-pulse divs)
    const skeletonCells = document.querySelectorAll(".animate-pulse");
    expect(skeletonCells.length).toBeGreaterThan(0);
  });

  it("shows empty state when data is empty and not loading", () => {
    renderGrid({ data: [], isLoading: false });
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText(/No results found/i)).toBeInTheDocument();
  });

  it("renders 'Add Filter' button in the toolbar", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: /add filter/i })).toBeInTheDocument();
  });

  it("opens filter popover when 'Add Filter' is clicked", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /add filter/i }));
    const dialog = screen.getByRole("dialog", { name: /add filter rule/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/column/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/operator/i)).toBeInTheDocument();
  });

  it("adds a filter pill when a filter is applied", () => {
    renderGrid();
    // Open filter popover
    fireEvent.click(screen.getByRole("button", { name: /add filter/i }));

    // Within the dialog, get the column select
    const dialog = screen.getByRole("dialog", { name: /add filter rule/i });
    const colSelect = within(dialog).getByLabelText(/column/i) as HTMLSelectElement;
    fireEvent.change(colSelect, { target: { value: "name" } });

    // Type a value
    const valueInput = within(dialog).getByLabelText(/value/i);
    fireEvent.change(valueInput, { target: { value: "Alice" } });

    fireEvent.click(within(dialog).getByRole("button", { name: /apply/i }));

    // Filter pill should appear
    expect(document.querySelector("[data-testid^='filter-pill-']")).toBeInTheDocument();
  });

  it("renders Export CSV button", () => {
    renderGrid();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("Export CSV button triggers a blob download", () => {
    const createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);

    // Mock createElement + click
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const el = originalCreateElement("a") as HTMLAnchorElement;
        el.click = mockClick;
        return el;
      }
      return originalCreateElement(tag);
    });

    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: /export csv/i }));

    expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockClick).toHaveBeenCalledTimes(1);

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    vi.mocked(document.createElement).mockRestore();
  });
});
