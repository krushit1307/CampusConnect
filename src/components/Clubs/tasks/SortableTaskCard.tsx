import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types/tasks";

interface SortableTaskCardProps {
  task: Task;
}

export function SortableTaskCard({ task }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`task-card-${task.id}`}
      className={`neu-border p-4 mb-3 bg-white cursor-grab active:cursor-grabbing transition-shadow duration-200 ${
        isDragging
          ? "opacity-50 shadow-2xl scale-105 z-50 border-brand-blue-dark"
          : "hover:shadow-md"
      }`}
      role="button"
      tabIndex={0}
      aria-label={`Task ${task.title}`}
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-brand-blue-dark leading-tight">{task.title}</h4>
      </div>
      {task.description && <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>}
    </div>
  );
}
