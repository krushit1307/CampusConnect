import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEventTasks } from "@/hooks/useEventTasks";
import { GanttChart } from "@/components/gantt/GanttChart";
import { AddTaskModal } from "@/components/gantt/AddTaskModal";
import { ArrowLeft } from "lucide-react";

export default function EventGanttPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { tasks, isLoading, createTask, updateTask, deleteTask } = useEventTasks(eventId);

  const { data: eventData } = useQuery({
    queryKey: ["event_details_gantt", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, club_id")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 font-mono text-sm font-bold uppercase hover:underline"
            >
              <ArrowLeft size={16} /> Back to Event
            </button>
          </div>

          <div>
            <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
              {eventData?.title
                ? `${eventData.title} — Gantt Chart`
                : "Event Management Gantt Chart"}
            </h1>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Visualize event timeline, dependencies, and manage task schedules.
            </p>
          </div>

          {isLoading ? (
            <div className="flex h-64 w-full items-center justify-center neu-border bg-white p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : (
            <GanttChart
              tasks={tasks}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onAddTask={() => setIsAddModalOpen(true)}
            />
          )}

          <AddTaskModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAdd={createTask}
            existingTasks={tasks}
          />
        </div>
      </div>
    </SiteShell>
  );
}
