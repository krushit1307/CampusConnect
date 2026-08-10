import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { KanbanBoard } from "./KanbanBoard";

vi.mock("@/hooks/useTasks", () => ({
  useTasks: () => ({
    data: [
      { id: "task-1", title: "Book DJ", status: "TODO", order_index: 1000 },
      { id: "task-2", title: "Order Pizza", status: "IN_PROGRESS", order_index: 1000 },
    ],
    isLoading: false,
    isError: false,
  }),
  useUpdateTaskStatus: () => ({
    mutate: vi.fn(),
  }),
}));

describe("KanbanBoard Component (#2433)", () => {
  it("renders 3 droppable columns and task cards properly", () => {
    render(<KanbanBoard clubId="club-1" />);

    expect(screen.getByTestId("kanban-column-TODO")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-IN_PROGRESS")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-DONE")).toBeInTheDocument();

    expect(screen.getByText("Book DJ")).toBeInTheDocument();
    expect(screen.getByText("Order Pizza")).toBeInTheDocument();
  });
});
