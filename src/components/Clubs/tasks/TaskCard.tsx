import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { Task } from "@/types/tasks";

interface TaskCardProps {
  task: Task;
  index: number;
}

export function TaskCard({ task, index }: TaskCardProps) {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`neu-border p-4 mb-3 bg-white transition-shadow duration-200 ${
            snapshot.isDragging ? "shadow-lg scale-105" : "hover:shadow-md"
          }`}
          style={{
            ...provided.draggableProps.style,
          }}
          aria-roledescription="Draggable item"
          role="button"
          tabIndex={0}
        >
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-bold text-brand-blue-dark leading-tight">{task.title}</h4>
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
          )}
        </div>
      )}
    </Draggable>
  );
}
