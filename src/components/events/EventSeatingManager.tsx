import { useState } from "react";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export function EventSeatingManager({
  eventId,
  isOrganizer,
}: {
  eventId: string;
  isOrganizer: boolean;
}) {
  const supabase = createClient();
  const [tables, setTables] = useState(10);
  const [seatsPerTable, setSeatsPerTable] = useState(8);

  const {
    data: layout,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["seating_layout", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seating_layouts")
        .select("*, seats(*)")
        .eq("event_id", eventId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error; // PGRST116 is no rows
      return data;
    },
  });

  const generateLayout = useMutation({
    mutationFn: async () => {
      if (!tables || !seatsPerTable || tables <= 0 || seatsPerTable <= 0) {
        throw new Error("Invalid table or seat counts");
      }

      // 1. Create layout
      const { data: newLayout, error: layoutError } = await supabase
        .from("seating_layouts")
        .insert({
          event_id: eventId,
          layout_config: { tables, seatsPerTable },
        })
        .select()
        .single();

      if (layoutError) throw layoutError;

      // 2. Generate seats
      const newSeats = [];
      for (let t = 1; t <= tables; t++) {
        for (let s = 1; s <= seatsPerTable; s++) {
          newSeats.push({
            layout_id: newLayout.id,
            table_name: `Table ${String.fromCharCode(64 + t)}`, // Table A, B, C...
            seat_number: `${s}`,
            status: "available",
          });
        }
      }

      const { error: seatsError } = await supabase.from("seats").insert(newSeats);
      if (seatsError) throw seatsError;
    },
    onSuccess: () => {
      toast.success("Seating layout generated!");
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate layout");
    },
  });

  if (!isOrganizer) return null;
  if (isLoading) return <div className="p-4">Loading seating manager...</div>;

  if (layout) {
    const totalSeats = layout.seats?.length || 0;
    return (
      <div className="neu-border bg-white p-6 mt-8">
        <h3 className="font-display text-xl font-bold uppercase text-blue-900">
          Manage Seating Layout
        </h3>
        <p className="mt-2 text-sm text-gray-800">Layout configured with {totalSeats} seats.</p>
        <p className="mt-2 text-xs text-gray-500 font-mono">
          Note: Modifying a layout after sales have started is not supported in this version.
        </p>
      </div>
    );
  }

  return (
    <div className="neu-border bg-white p-6 mt-8">
      <h3 className="font-display text-xl font-bold uppercase text-blue-900">
        Configure Seating Layout
      </h3>
      <div className="mt-4 flex flex-col gap-4 max-w-sm">
        <div>
          <Label className="font-mono uppercase font-bold">Number of Tables</Label>
          <Input
            type="number"
            min="1"
            max="26"
            value={tables}
            onChange={(e) => setTables(parseInt(e.target.value))}
            className="neu-border mt-1"
          />
        </div>
        <div>
          <Label className="font-mono uppercase font-bold">Seats per Table</Label>
          <Input
            type="number"
            min="1"
            max="20"
            value={seatsPerTable}
            onChange={(e) => setSeatsPerTable(parseInt(e.target.value))}
            className="neu-border mt-1"
          />
        </div>
        <Button
          onClick={() => generateLayout.mutate()}
          disabled={generateLayout.isPending}
          className="neu-border neu-press bg-lime text-black uppercase font-bold tracking-wider"
        >
          {generateLayout.isPending ? "Generating..." : "Generate Layout"}
        </Button>
      </div>
    </div>
  );
}
