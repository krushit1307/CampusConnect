import React, { useState, useCallback } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useTasks, useUpdateTaskStatus } from "@/hooks/useTasks";
import { Task, TaskStatus, KANBAN_COLUMNS } from "@/types/tasks";
import { KanbanColumn } from "./KanbanColumn";

interface KanbanBoardProps {
  clubId: string;
}

export function KanbanBoard({ clubId }: KanbanBoardProps) {
  const { data: tasks = [], isLoading, isError } = useTasks(clubId);
  const updateTask = useUpdateTaskStatus(clubId);
  const [announcement, setAnnouncement] = useState("");

  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;

      if (!destination) return;

      if (destination.droppableId === source.droppableId && destination.index === source.index) {
        return;
      }

      const destStatus = destination.droppableId as TaskStatus;

      // Get tasks in the destination column, sorted by order_index
      const destTasks = tasks
        .filter((t) => t.status === destStatus)
        .sort((a, b) => a.order_index - b.order_index);

      // If moving within the same column, remove the dragged task from the calculation list
      const relevantTasks =
        source.droppableId === destStatus
          ? destTasks.filter((t) => t.id !== draggableId)
          : destTasks;

      let newOrder = 0;
      if (relevantTasks.length === 0) {
        newOrder = 1000;
      } else if (destination.index === 0) {
        // First position
        newOrder = relevantTasks[0].order_index - 1000;
      } else if (destination.index >= relevantTasks.length) {
        // Last position
        newOrder = relevantTasks[relevantTasks.length - 1].order_index + 1000;
      } else {
        // Middle position
        const prevOrder = relevantTasks[destination.index - 1].order_index;
        const nextOrder = relevantTasks[destination.index].order_index;
        newOrder = prevOrder + (nextOrder - prevOrder) / 2;
      }

      // Update state optimistically via React Query mutation
      updateTask.mutate({
        taskId: draggableId,
        status: destStatus,
        order_index: newOrder,
      });

      // Announce for accessibility
      const colName = KANBAN_COLUMNS.find((c) => c.id === destStatus)?.title;
      setAnnouncement(`Task moved to ${colName}`);
    },
    [tasks, updateTask],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 bg-red-100 text-red-900 neu-border">
        Failed to load tasks. Please try again.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Screen reader announcement region */}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {KANBAN_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={tasks
                .filter((t) => t.status === column.id)
                .sort((a, b) => a.order_index - b.order_index)}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
