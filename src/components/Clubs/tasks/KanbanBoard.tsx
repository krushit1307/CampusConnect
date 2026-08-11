import React, { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCorners,
  CollisionDetection,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useTasks, useUpdateTaskStatus } from "@/hooks/useTasks";
import { Task, TaskStatus, KANBAN_COLUMNS } from "@/types/tasks";
import { DroppableColumn } from "./DroppableColumn";
import { SortableTaskCard } from "./SortableTaskCard";

interface KanbanBoardProps {
  clubId: string;
}

/**
 * Custom collision detection algorithm combining pointerWithin for empty column targets
 * and closestCorners for populated containers (#2433).
 */
const customCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

export function KanbanBoard({ clubId }: KanbanBoardProps) {
  const { data: initialTasks = [], isLoading, isError } = useTasks(clubId);
  const updateTask = useUpdateTaskStatus(clubId);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainer = (id: string): TaskStatus | null => {
    if (KANBAN_COLUMNS.some((col) => col.id === id)) {
      return id as TaskStatus;
    }
    const task = tasks.find((t) => t.id === id);
    return task ? task.status : null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    // Dynamically move task card across columns in local React state
    setTasks((prevTasks) => {
      const activeIndex = prevTasks.findIndex((t) => t.id === activeId);
      if (activeIndex === -1) return prevTasks;

      const updated = [...prevTasks];
      const taskToMove = { ...updated[activeIndex], status: overContainer };
      updated[activeIndex] = taskToMove;

      return updated;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const overContainer = findContainer(overId);
    if (!overContainer) return;

    const currentTasksInCol = tasks
      .filter((t) => t.status === overContainer)
      .sort((a, b) => a.order_index - b.order_index);

    const overIndex = currentTasksInCol.findIndex((t) => t.id === overId);
    let newOrder = 1000;

    if (currentTasksInCol.length === 0) {
      newOrder = 1000;
    } else if (overIndex === 0) {
      newOrder = currentTasksInCol[0].order_index - 1000;
    } else if (overIndex === -1 || overIndex >= currentTasksInCol.length - 1) {
      newOrder = currentTasksInCol[currentTasksInCol.length - 1].order_index + 1000;
    } else {
      const prevOrder = currentTasksInCol[overIndex - 1].order_index;
      const nextOrder = currentTasksInCol[overIndex].order_index;
      newOrder = prevOrder + (nextOrder - prevOrder) / 2;
    }

    // Optimistically update React state
    setTasks((prev) =>
      prev.map((t) =>
        t.id === activeId ? { ...t, status: overContainer, order_index: newOrder } : t,
      ),
    );

    // Dispatch PATCH request to backend endpoint /api/tasks/:id
    try {
      await fetch(`/api/tasks/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column_status: overContainer,
          sort_order: newOrder,
        }),
      });
    } catch {
      // Fall back to React Query mutation if backend fetch fails
    }

    updateTask.mutate({
      taskId: activeId,
      status: overContainer,
      order_index: newOrder,
    });

    const colName = KANBAN_COLUMNS.find((c) => c.id === overContainer)?.title;
    setAnnouncement(`Task moved to ${colName}`);
  };

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
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {KANBAN_COLUMNS.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              tasks={tasks
                .filter((t) => t.status === column.id)
                .sort((a, b) => a.order_index - b.order_index)}
            />
          ))}
        </div>

        <DragOverlay>{activeTask ? <SortableTaskCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
