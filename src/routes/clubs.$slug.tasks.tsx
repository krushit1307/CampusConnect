import React from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { KanbanBoard } from "@/components/Clubs/tasks/KanbanBoard";

export default function ClubTasksRoute() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();

  const { data: club, isLoading } = useQuery({
    queryKey: ["club", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", slug || "")
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 w-full items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!club) {
    return <Navigate to="/404" replace />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-display font-bold text-brand-blue-dark">Tasks</h2>
          <p className="text-gray-600 mt-1">Manage club tasks and progress.</p>
        </div>
      </div>

      <KanbanBoard clubId={club.id} />
    </div>
  );
}
