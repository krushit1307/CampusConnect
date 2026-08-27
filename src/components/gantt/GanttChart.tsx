import React, { useState, useRef, useMemo } from "react";
import { EventTask } from "@/types/eventTasks";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import Plus from "lucide-react/dist/esm/icons/plus";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Edit2 from "lucide-react/dist/esm/icons/edit-2";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Clock from "lucide-react/dist/esm/icons/clock";
import format from "date-fns/format";
import differenceInDays from "date-fns/differenceInDays";
import addDays from "date-fns/addDays";
import parseISO from "date-fns/parseISO";
import isAfter from "date-fns/isAfter";
import isBefore from "date-fns/isBefore";
import isSameDay from "date-fns/isSameDay";

interface GanttChartProps {
  tasks: EventTask[];
  onUpdateTask: (task: {
    id: string;
    start_date?: string;
    end_date?: string;
    progress?: number;
  }) => void;
  onDeleteTask: (id: string) => void;
  onAddTask?: () => void;
  canEdit?: boolean;
}

export function GanttChart({
  tasks,
  onUpdateTask,
  onDeleteTask,
  onAddTask,
  canEdit = true,
}: GanttChartProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragDaysOffset, setDragDaysOffset] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"day" | "week">("day");

  // Calculate timeline range
  const { minDate, maxDate, totalDays, datesHeader } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      const end = addDays(today, 14);
      return {
        minDate: today,
        maxDate: end,
        totalDays: 15,
        datesHeader: Array.from({ length: 15 }, (_, i) => addDays(today, i)),
      };
    }

    let min = parseISO(tasks[0].start_date);
    let max = parseISO(tasks[0].end_date);

    tasks.forEach((t) => {
      const s = parseISO(t.start_date);
      const e = parseISO(t.end_date);
      if (isBefore(s, min)) min = s;
      if (isAfter(e, max)) max = e;
    });

    // Padding by 2 days on each end
    min = addDays(min, -2);
    max = addDays(max, 4);

    const diff = Math.max(differenceInDays(max, min) + 1, 10);
    const dates = Array.from({ length: diff }, (_, i) => addDays(min, i));

    return {
      minDate: min,
      maxDate: max,
      totalDays: diff,
      datesHeader: dates,
    };
  }, [tasks]);

  const columnWidth = viewMode === "day" ? 44 : 24;

  // Handle Drag & Drop to shift start & end dates by N days
  const handleMouseDown = (e: React.MouseEvent, taskId: string) => {
    if (!canEdit) return;
    setDraggedTaskId(taskId);
    setDragStartX(e.clientX);
    setDragDaysOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedTaskId) return;
    const deltaX = e.clientX - dragStartX;
    const daysShift = Math.round(deltaX / columnWidth);
    setDragDaysOffset(daysShift);
  };

  const handleMouseUp = () => {
    if (!draggedTaskId) return;
    if (dragDaysOffset !== 0) {
      const task = tasks.find((t) => t.id === draggedTaskId);
      if (task) {
        const newStart = addDays(parseISO(task.start_date), dragDaysOffset).toISOString();
        const newEnd = addDays(parseISO(task.end_date), dragDaysOffset).toISOString();
        onUpdateTask({ id: task.id, start_date: newStart, end_date: newEnd });
      }
    }
    setDraggedTaskId(null);
    setDragStartX(0);
    setDragDaysOffset(0);
  };

  // Map task dependencies SVG coordinates
  const dependencyLines = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; id: string }> = [];
    const rowHeight = 48;
    const headerHeight = 44;

    tasks.forEach((targetTask, targetIndex) => {
      if (targetTask.dependencies && targetTask.dependencies.length > 0) {
        targetTask.dependencies.forEach((depId) => {
          const sourceIndex = tasks.findIndex((t) => t.id === depId);
          if (sourceIndex !== -1) {
            const sourceTask = tasks[sourceIndex];

            const sourceStartDays = differenceInDays(parseISO(sourceTask.start_date), minDate);
            const sourceDuration = Math.max(
              differenceInDays(parseISO(sourceTask.end_date), parseISO(sourceTask.start_date)),
              1,
            );
            const x1 = (sourceStartDays + sourceDuration) * columnWidth + 240;
            const y1 = headerHeight + sourceIndex * rowHeight + 24;

            const targetStartDays = differenceInDays(parseISO(targetTask.start_date), minDate);
            const x2 = targetStartDays * columnWidth + 240;
            const y2 = headerHeight + targetIndex * rowHeight + 24;

            lines.push({ x1, y1, x2, y2, id: `${depId}->${targetTask.id}` });
          }
        });
      }
    });

    return lines;
  }, [tasks, minDate, columnWidth]);

  return (
    <div className="w-full space-y-4 font-sans select-none">
      {/* Controls & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 neu-border">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-blue" />
          <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">
            Event Timeline & Gantt Chart
          </h3>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 neu-border">
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 text-xs font-mono font-bold uppercase transition ${
                viewMode === "day"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-gray-600 hover:text-black dark:text-slate-400"
              }`}
            >
              Day View
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 text-xs font-mono font-bold uppercase transition ${
                viewMode === "week"
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "text-gray-600 hover:text-black dark:text-slate-400"
              }`}
            >
              Compact View
            </button>
          </div>

          {canEdit && onAddTask && (
            <button
              onClick={onAddTask}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-blue text-white font-mono text-xs font-bold uppercase neu-border hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          )}
        </div>
      </div>

      {/* Desktop Gantt Chart View */}
      <div
        className="hidden md:block w-full overflow-x-auto bg-white dark:bg-slate-900 neu-border relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="relative min-w-max" style={{ width: `${240 + totalDays * columnWidth}px` }}>
          {/* SVG Overlay for Dependency Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="5"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
              </marker>
            </defs>
            {dependencyLines.map((line) => (
              <path
                key={line.id}
                d={`M ${line.x1} ${line.y1} C ${line.x1 + 30} ${line.y1}, ${line.x2 - 30} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="4 2"
                markerEnd="url(#arrow)"
              />
            ))}
          </svg>

          {/* Table Header */}
          <div className="flex border-b-2 border-black dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 h-11 items-center sticky top-0 z-20">
            <div className="w-[240px] px-4 font-mono text-xs font-bold uppercase text-slate-700 dark:text-slate-300 border-r-2 border-black dark:border-slate-800 sticky left-0 bg-gray-50 dark:bg-slate-800 z-30">
              Task Name
            </div>
            <div className="flex flex-1">
              {datesHeader.map((date, i) => {
                const isToday = isSameDay(date, new Date());
                return (
                  <div
                    key={i}
                    style={{ width: `${columnWidth}px` }}
                    className={`flex flex-col items-center justify-center border-r border-gray-200 dark:border-slate-800 text-[10px] font-mono ${
                      isToday
                        ? "bg-amber-100 text-amber-900 font-bold dark:bg-amber-950 dark:text-amber-200"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <span>{format(date, "dd")}</span>
                    <span className="text-[9px] opacity-75">{format(date, "EEE")}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Rows */}
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500 font-mono text-sm">
              No tasks added yet. Click "+ Add Task" to create your first milestone.
            </div>
          ) : (
            tasks.map((task, index) => {
              const startDate = parseISO(task.start_date);
              const endDate = parseISO(task.end_date);

              const startOffsetDays = differenceInDays(startDate, minDate);
              const durationDays = Math.max(differenceInDays(endDate, startDate) + 1, 1);

              const isDraggingThis = draggedTaskId === task.id;
              const currentOffsetDays = startOffsetDays + (isDraggingThis ? dragDaysOffset : 0);

              const leftPx = currentOffsetDays * columnWidth;
              const widthPx = durationDays * columnWidth;

              return (
                <div
                  key={task.id}
                  className="flex border-b border-gray-200 dark:border-slate-800 h-12 items-center hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition relative"
                >
                  {/* Task Column */}
                  <div className="w-[240px] px-4 flex items-center justify-between border-r-2 border-black dark:border-slate-800 sticky left-0 bg-white dark:bg-slate-900 z-20 h-full">
                    <div className="truncate pr-2">
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-white truncate">
                        {task.name}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {task.progress}% done • {format(startDate, "MMM d")}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete Task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Task Timeline Bar Container */}
                  <div className="flex-1 relative h-full flex items-center">
                    {/* Background Grid Lines */}
                    {datesHeader.map((_, i) => (
                      <div
                        key={i}
                        style={{ left: `${i * columnWidth}px`, width: `${columnWidth}px` }}
                        className="absolute top-0 bottom-0 border-r border-gray-100 dark:border-slate-800/40 pointer-events-none"
                      />
                    ))}

                    {/* Task Bar */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, task.id)}
                      style={{
                        left: `${leftPx}px`,
                        width: `${widthPx}px`,
                      }}
                      className={`absolute h-7 rounded-sm border border-black dark:border-slate-700 shadow-sm flex items-center px-2 cursor-grab active:cursor-grabbing transition-shadow ${
                        task.progress === 100
                          ? "bg-emerald-500 text-white"
                          : task.progress > 0
                            ? "bg-blue-600 text-white"
                            : "bg-amber-500 text-white"
                      } ${isDraggingThis ? "opacity-80 ring-2 ring-blue-400 z-30" : ""}`}
                    >
                      {/* Progress Overlay */}
                      <div
                        style={{ width: `${task.progress}%` }}
                        className="absolute left-0 top-0 bottom-0 bg-black/20 rounded-l-sm pointer-events-none"
                      />

                      <span className="text-[10px] font-mono font-bold truncate z-10 relative">
                        {task.name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile Agenda List Fallback */}
      <div className="block md:hidden space-y-3">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
          Task Agenda (Mobile List View)
        </p>

        {tasks.length === 0 ? (
          <div className="p-6 bg-white dark:bg-slate-900 neu-border text-center text-sm text-gray-500 font-mono">
            No event tasks found.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="p-4 bg-white dark:bg-slate-900 neu-border space-y-2">
              <div className="flex justify-between items-start">
                <h4 className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {task.name}
                </h4>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    task.progress === 100
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {task.progress}%
                </span>
              </div>

              {task.description && (
                <p className="text-xs text-gray-600 dark:text-slate-400">{task.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs font-mono text-gray-500 pt-2 border-t border-gray-100 dark:border-slate-800">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {format(parseISO(task.start_date), "MMM d")} -{" "}
                  {format(parseISO(task.end_date), "MMM d")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
