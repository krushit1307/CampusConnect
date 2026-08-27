import { Link } from "react-router-dom";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getRsvpIdempotencyKey, clearRsvpIdempotencyKey } from "@/lib/rsvpIdempotency";
import { toast } from "sonner";
import { Calendar, AlertTriangle, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScheduleConflict {
  event_id: string;
  event_title: string;
  event_start_date: string;
  event_end_date: string;
  conflict_event_id: string;
  conflict_event_title: string;
  conflict_start_date: string;
  conflict_end_date: string;
}

export default function DashboardConflicts() {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [includeTravelBuffer, setIncludeTravelBuffer] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user);
      }
    });
  }, [supabase]);

  // Fetch schedule conflicts
  const { data: conflicts = [], isLoading, refetch } = useQuery<ScheduleConflict[]>({
    queryKey: ["schedule_conflicts", user?.id, includeTravelBuffer],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase.rpc("get_user_schedule_conflicts", {
        p_user_id: user.id,
        p_include_buffer: includeTravelBuffer,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Toggle/Cancel RSVP Mutation
  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      if (!user) throw new Error("Must be logged in");
      const idempotencyKey = getRsvpIdempotencyKey(eventId);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd: true }, // hasRsvpd: true cancels/removes RSVP
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          "Idempotency-Key": idempotencyKey,
        },
      });
      if (error) throw error;
      clearRsvpIdempotencyKey(eventId);
      return data;
    },
    onSuccess: () => {
      toast.success("Successfully cancelled RSVP to resolve conflict!");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel RSVP. Please try again.");
    },
  });

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Dashboard Header */}
      <div className="border-4 border-black bg-[#ffde00] p-6 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="font-display text-2xl font-black uppercase tracking-wider">
          Schedule Conflicts Dashboard
        </h2>
        <p className="mt-1 font-mono text-xs font-semibold uppercase">
          Resolve overlapping commitments in your campus schedule
        </p>

        {/* Travel Buffer Toggle */}
        <div className="mt-4 flex items-center">
          <label className="flex items-center gap-2 cursor-pointer font-mono text-xs font-bold uppercase select-none">
            <input
              type="checkbox"
              checked={includeTravelBuffer}
              onChange={(e) => setIncludeTravelBuffer(e.target.checked)}
              className="h-5 w-5 accent-black border-2 border-black cursor-pointer"
            />
            <Clock size={16} className="text-black inline" />
            <span>Include 15-minute travel buffer between events</span>
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="font-mono text-sm py-12 text-center">
          Checking schedule overlaps...
        </div>
      ) : conflicts.length === 0 ? (
        /* Empty State */
        <div className="border-4 border-black bg-white p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:bg-black dark:border-cream">
          <Calendar className="mx-auto h-12 w-12 text-black dark:text-cream" />
          <h3 className="mt-4 font-display text-xl font-bold uppercase">No schedule conflicts</h3>
          <p className="mt-2 font-mono text-sm text-gray-600 dark:text-gray-400">
            All your RSVPs are clean and non-overlapping.
          </p>
          <Link
            to="/events"
            className="neu-border neu-press mt-6 inline-flex bg-black px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cream dark:bg-white dark:text-black"
          >
            Browse More Events
          </Link>
        </div>
      ) : (
        /* Overlaps Commitments List */
        <div className="space-y-6">
          {conflicts.map((conflict, index) => (
            <div
              key={index}
              className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:bg-zinc-900 dark:border-cream flex flex-col p-6 gap-6"
            >
              <div className="flex items-center gap-2 text-red-600 font-mono text-sm font-bold uppercase">
                <AlertTriangle size={18} />
                <span>Overlapping commitment detected</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                {/* Event 1 */}
                <div className="border-2 border-black p-4 bg-slate-50 dark:bg-zinc-800 dark:border-cream flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-black text-lg uppercase truncate">
                      {conflict.event_title}
                    </h4>
                    <p className="font-mono text-xs mt-2 text-gray-600 dark:text-gray-400">
                      📅 {formatTime(conflict.event_start_date)} - {formatTime(conflict.event_end_date)}
                    </p>
                  </div>
                  <Button
                    onClick={() => toggleRsvp.mutate({ eventId: conflict.event_id })}
                    disabled={toggleRsvp.isPending}
                    variant="destructive"
                    className="mt-6 font-mono font-bold uppercase flex items-center justify-center gap-2 border-2 border-black w-full"
                  >
                    <Trash2 size={14} />
                    Cancel RSVP
                  </Button>
                </div>

                {/* Event 2 */}
                <div className="border-2 border-black p-4 bg-slate-50 dark:bg-zinc-800 dark:border-cream flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-black text-lg uppercase truncate">
                      {conflict.conflict_event_title}
                    </h4>
                    <p className="font-mono text-xs mt-2 text-gray-600 dark:text-gray-400">
                      📅 {formatTime(conflict.conflict_start_date)} - {formatTime(conflict.conflict_end_date)}
                    </p>
                  </div>
                  <Button
                    onClick={() => toggleRsvp.mutate({ eventId: conflict.conflict_event_id })}
                    disabled={toggleRsvp.isPending}
                    variant="destructive"
                    className="mt-6 font-mono font-bold uppercase flex items-center justify-center gap-2 border-2 border-black w-full"
                  >
                    <Trash2 size={14} />
                    Cancel RSVP
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
