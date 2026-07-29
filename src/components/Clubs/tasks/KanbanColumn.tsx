import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import { Task, KanbanColumnDef } from "@/types/tasks";
import { TaskCard } from "./TaskCard";

interface KanbanColumnProps {
  column: KanbanColumnDef;
  tasks: Task[];
}

export function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  return (
    <div className="flex flex-col neu-border bg-cream h-full min-h-[500px]">
      <div className="p-4 border-b-2 border-black bg-lime">
        <h3 className="font-display text-xl font-bold uppercase tracking-wider text-black">
          {column.title}
        </h3>
        <span className="text-xs font-mono font-bold text-gray-700">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-4 transition-colors duration-200 ${
              snapshot.isDraggingOver ? "bg-black/5" : ""
            } touch-none`}
            style={{ minHeight: "150px" }}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
