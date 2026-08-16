import { useState, useEffect } from "react";
import { Compass, PlusCircle, Trophy, ArrowRight } from "lucide-react";
import { createClient } from "../lib/supabase/client";
import { OrganizerHuntBuilder } from "../components/scavenger-hunt/OrganizerHuntBuilder";
import { AttendeeHuntView } from "../components/scavenger-hunt/AttendeeHuntView";

export interface HuntSummary {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

export default function ScavengerHuntsRoute() {
  const [hunts, setHunts] = useState<HuntSummary[]>([]);
  const [selectedHuntId, setSelectedHuntId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "attendee" | "create">("list");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });

    supabase
      .from("hunts")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setHunts(data as HuntSummary[]);
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Navigation Bar */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Campus Scavenger Hunts
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Explore campus checkpoints, decode clues, and climb the leaderboard!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {viewMode !== "list" && (
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                All Hunts
              </button>
            )}
            {viewMode !== "create" && (
              <button
                type="button"
                onClick={() => setViewMode("create")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <PlusCircle className="h-4 w-4" />
                Create Hunt
              </button>
            )}
          </div>
        </div>

        {/* View Mode Switching */}
        {viewMode === "create" ? (
          <OrganizerHuntBuilder />
        ) : viewMode === "attendee" && selectedHuntId && currentUserId ? (
          <AttendeeHuntView huntId={selectedHuntId} userId={currentUserId} />
        ) : (
          /* Hunts Directory */
          <div className="space-y-4">
            {hunts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                <Compass className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                  No active scavenger hunts yet
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Be the first organizer to create an exciting campus discovery trail!
                </p>
                <button
                  type="button"
                  onClick={() => setViewMode("create")}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                >
                  <PlusCircle className="h-4 w-4" />
                  Create First Hunt
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {hunts.map((hunt) => (
                  <div
                    key={hunt.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-500/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                          Active Mission
                        </span>
                        <Trophy className="h-4 w-4 text-amber-500" />
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                        {hunt.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2 dark:text-slate-400">
                        {hunt.description || "Discover campus landmarks and collect points."}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                      <span className="text-xs text-slate-500">Free to join</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedHuntId(hunt.id);
                          setViewMode("attendee");
                        }}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                      >
                        Start Hunt
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
