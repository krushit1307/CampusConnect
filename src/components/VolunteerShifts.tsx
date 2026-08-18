import React, { useState } from "react";
import { useQuery, useMutation, queryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import CalendarClock from "lucide-react/dist/esm/icons/calendar-clock";
import Users from "lucide-react/dist/esm/icons/users";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Plus from "lucide-react/dist/esm/icons/plus";
import { toast } from "sonner";
import CreateShiftModal from "@/components/CreateShiftModal";

interface Shift {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  capacity: number;
  shift_assignments: [{ count: number }];
  has_claimed?: boolean;
}

export default function VolunteerShifts({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = createClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Fetch the shifts for this event and count the assignments
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["event-shifts", eventId],
    queryFn: async (): Promise<Shift[]> => {
      // We fetch shifts, the count of total assignments, AND check if the current user is assigned
      const { data: shiftData, error: shiftError } = await supabase
        .from("event_shifts")
        .select(
          `
          id, title, start_time, end_time, capacity,
          shift_assignments(count)
        `,
        )
        .eq("event_id", eventId)
        .order("start_time", { ascending: true });

      if (shiftError) throw shiftError;

      // Also figure out which ones the current user has already claimed
      const { data: userAssignments } = await supabase
        .from("shift_assignments")
        .select("shift_id")
        .eq("user_id", userId);

      const claimedShiftIds = new Set(userAssignments?.map((a) => a.shift_id) || []);

      return (shiftData as unknown as Shift[]).map((shift) => ({
        ...shift,
        has_claimed: claimedShiftIds.has(shift.id),
      }));
    },
    enabled: !!eventId && !!userId,
  });

  // 2. Setup the mutation to claim a shift using our Postgres RPC
  const claimShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase.rpc("claim_volunteer_shift", {
        p_shift_id: shiftId,
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift claimed successfully!");
      // Refresh the data to show the updated slot counts
      queryClient.invalidateQueries({ queryKey: ["event-shifts", eventId] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to claim shift. It might be full!");
    },
  });

  if (isLoading) {
    return <div className="neu-border bg-white p-6 animate-pulse h-32" />;
  }

  // 3. If there are no shifts, show an empty state where organizers can still add one
  if (shifts.length === 0) {
    return (
      <div className="neu-border bg-white p-4 sm:p-6 mb-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm text-gray-500">No volunteer shifts listed yet.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="neu-border bg-lime px-3 py-1 font-mono text-xs font-bold uppercase flex items-center gap-1 hover:bg-peach transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Shift
          </button>
        </div>

        <CreateShiftModal
          eventId={eventId}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    );
  }

  // 4. Main render logic
  return (
    <div className="neu-border bg-white p-4 sm:p-6 mb-6">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-brand-peach-light" />
          Volunteer Shifts
        </h2>

        {/* Organizer Add Shift Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="neu-border bg-lime px-3 py-1 font-mono text-xs font-bold uppercase flex items-center gap-1 hover:bg-peach transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Shift
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shifts.map((shift) => {
          // Supabase returns the count inside an array due to the join
          const currentCount = shift.shift_assignments[0]?.count || 0;
          const isFull = currentCount >= shift.capacity;

          // Format time nicely
          const startTime = new Date(shift.start_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          const endTime = new Date(shift.end_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={shift.id}
              className={`neu-border flex flex-col justify-between p-4 transition-all ${
                shift.has_claimed
                  ? "bg-lime/20 border-brand-blue-dark shadow-none translate-y-1"
                  : "bg-cream hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#000]"
              }`}
            >
              <div>
                <h3 className="font-display font-bold text-lg text-black">{shift.title}</h3>
                <p className="font-mono text-sm text-gray-700 mt-1">
                  {startTime} - {endTime}
                </p>

                <div className="mt-3 flex items-center gap-2 font-mono text-xs font-bold uppercase">
                  <Users className="w-4 h-4" />
                  <span className={isFull ? "text-red-600" : "text-brand-blue-dark"}>
                    {currentCount} / {shift.capacity} Filled
                  </span>
                </div>
              </div>

              <div className="mt-4">
                {shift.has_claimed ? (
                  <div className="w-full bg-lime text-black border-2 border-black font-mono font-bold py-2 flex justify-center items-center gap-2 opacity-80 cursor-not-allowed">
                    <CheckCircle2 className="w-4 h-4" />
                    Claimed
                  </div>
                ) : (
                  <button
                    onClick={() => claimShiftMutation.mutate(shift.id)}
                    disabled={isFull || claimShiftMutation.isPending}
                    className={`w-full font-mono font-bold py-2 border-2 border-black transition-all shadow-[2px_2px_0_0_#000] active:translate-y-0.5 active:shadow-none ${
                      isFull
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                        : "bg-sky-300 hover:bg-sky-400 text-black"
                    }`}
                  >
                    {isFull ? "Shift Full" : "Claim Shift"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CreateShiftModal
        eventId={eventId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
