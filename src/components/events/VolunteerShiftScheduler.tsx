import React, { useState, useEffect } from "react";
import { getEventVolunteerShifts, claimVolunteerShift } from "@/services/volunteerShiftService";
import type { VolunteerShift } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, Award, CheckCircle2, AlertTriangle, UserCheck } from "lucide-react";
import { toast } from "sonner";

interface VolunteerShiftSchedulerProps {
  eventId: string;
  currentUserId?: string;
  isOrganizer?: boolean;
}

export const VolunteerShiftScheduler: React.FC<VolunteerShiftSchedulerProps> = ({
  eventId,
  currentUserId,
}) => {
  const [shifts, setShifts] = useState<VolunteerShift[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimingShiftId, setClaimingShiftId] = useState<string | null>(null);

  useEffect(() => {
    async function loadShifts() {
      setLoading(true);
      try {
        const data = await getEventVolunteerShifts(eventId, currentUserId);
        setShifts(data);
      } catch (err) {
        console.error("Failed to load volunteer shifts:", err);
      } finally {
        setLoading(false);
      }
    }
    loadShifts();
  }, [eventId, currentUserId]);

  const handleClaimShift = async (shift: VolunteerShift) => {
    if (!currentUserId) {
      toast.error("Please log in to claim a volunteer shift.");
      return;
    }

    setClaimingShiftId(shift.id);
    try {
      const res = await claimVolunteerShift(shift.id, currentUserId);

      if (!res.success) {
        toast.error(res.error || "Failed to claim shift.");
        return;
      }

      toast.success(`Shift claimed! You earned ${res.points_awarded} Gamification points! 🎉`);

      // Update local state
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shift.id
            ? {
                ...s,
                claimed_count: (s.claimed_count || 0) + 1,
                user_has_claimed: true,
              }
            : s,
        ),
      );
    } catch (err) {
      toast.error("An unexpected error occurred while claiming shift.");
      console.error(err);
    } finally {
      setClaimingShiftId(null);
    }
  };

  const formatTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="neu-border bg-white p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <Badge className="bg-amber-600 text-white font-mono text-xs font-bold uppercase mb-2">
            Volunteer Shifts
          </Badge>
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            Volunteer Shift Scheduler
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Claim distinct time blocks, earn Gamification points, and avoid schedule collisions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-sm font-medium text-slate-500 animate-pulse">
          Loading volunteer shifts...
        </div>
      ) : shifts.length === 0 ? (
        <div className="neu-border bg-slate-50 p-6 text-center space-y-2">
          <p className="text-sm font-bold text-slate-600">No volunteer shifts created yet.</p>
          <p className="text-xs text-slate-400">
            Event organizers can add volunteer roles and time slots for this event.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shifts.map((shift) => {
            const filledCount = shift.claimed_count || 0;
            const isFull = filledCount >= shift.capacity;
            const userClaimed = shift.user_has_claimed;

            const durationHours = Math.max(
              0.5,
              (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) /
                (1000 * 3600),
            );
            const pointsEst = Math.round(durationHours * shift.points_per_hour);

            return (
              <div
                key={shift.id}
                className={`neu-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  userClaimed
                    ? "bg-emerald-50 border-emerald-500"
                    : isFull
                      ? "bg-slate-50 border-slate-300 opacity-75"
                      : "bg-white hover:shadow-[4px_4px_0_0_var(--color-ink,#000)]"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="neu-border bg-amber-50 text-amber-900 font-bold text-xs"
                    >
                      {shift.role_name}
                    </Badge>
                    <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {formatTime(shift.start_time)} - {formatTime(shift.end_time)} ({durationHours}{" "}
                      hrs)
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      Slot Capacity:{" "}
                      <strong>
                        {filledCount}/{shift.capacity} filled
                      </strong>
                    </span>
                    <span className="flex items-center gap-1 text-amber-700 font-bold">
                      <Award className="w-3.5 h-3.5 text-amber-600" />+{pointsEst} Points
                    </span>
                  </div>
                </div>

                <div>
                  {userClaimed ? (
                    <Badge className="bg-emerald-600 text-white font-bold px-3 py-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Shift Claimed
                    </Badge>
                  ) : isFull ? (
                    <Badge
                      variant="secondary"
                      className="text-xs font-bold text-slate-500 bg-slate-200"
                    >
                      Fully Booked
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => handleClaimShift(shift)}
                      disabled={claimingShiftId === shift.id}
                      className="neu-border neu-press bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider"
                    >
                      {claimingShiftId === shift.id ? "Claiming..." : "Claim Shift"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
