import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, KanbanColumnDef } from "@/types/tasks";
import { SortableTaskCard } from "./SortableTaskCard";

interface DroppableColumnProps {
  column: KanbanColumnDef;
  tasks: Task[];
}

export function DroppableColumn({ column, tasks }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column },
  });

  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${column.id}`}
      className={`flex flex-col neu-border bg-cream h-full min-h-[500px] transition-colors duration-200 ${
        isOver ? "bg-lime/20 border-black" : ""
      }`}
    >
      <div className="p-4 border-b-2 border-black bg-lime">
        <h3 className="font-display text-xl font-bold uppercase tracking-wider text-black">
          {column.title}
        </h3>
        <span className="text-xs font-mono font-bold text-gray-700">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      <div className="flex-1 p-4 touch-none min-h-[200px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
