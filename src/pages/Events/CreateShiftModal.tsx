import React, { useState } from "react";
import { useMutation, queryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Plus from "lucide-react/dist/esm/icons/plus";
import X from "lucide-react/dist/esm/icons/x";

export default function CreateShiftModal({
  eventId,
  isOpen,
  onClose,
}: {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState(1);

  const createShiftMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_shifts").insert({
        event_id: eventId,
        title,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        capacity: Number(capacity),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Volunteer shift created!");
      queryClient.invalidateQueries({ queryKey: ["event-shifts", eventId] });
      setTitle("");
      setStartTime("");
      setEndTime("");
      setCapacity(1);
      onClose();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create shift");
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="neu-border w-full max-w-md bg-white p-6 shadow-[6px_6px_0_0_#000]">
        <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-2">
          <h3 className="font-display text-xl font-bold">Add Volunteer Shift</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createShiftMutation.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block font-mono text-xs font-bold uppercase">
              Shift Role / Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Registration Desk"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="neu-border w-full p-2 font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block font-mono text-xs font-bold uppercase">Start Time</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="neu-border w-full p-2 font-mono text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-xs font-bold uppercase">End Time</label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="neu-border w-full p-2 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-xs font-bold uppercase">
              Capacity (Volunteers Needed)
            </label>
            <input
              type="number"
              min="1"
              required
              value={capacity}
              onChange={(e) => setCapacity(Math.max(1, parseInt(e.target.value) || 1))}
              className="neu-border w-full p-2 font-mono text-sm"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createShiftMutation.isPending}
              className="neu-border bg-lime px-4 py-2 font-mono text-xs font-bold uppercase shadow-[2px_2px_0_0_#000] hover:bg-peach"
            >
              {createShiftMutation.isPending ? "Creating..." : "Save Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
