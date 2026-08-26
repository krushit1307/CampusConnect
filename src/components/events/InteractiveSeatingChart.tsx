import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import Clock from "lucide-react/dist/esm/icons/clock";
import { Label } from "@/components/ui/label";

import { User } from "@supabase/supabase-js";

type SeatData = {
  id: string;
  status: string;
  lock_expires_at: string;
  seat_number: string;
  locked_by: string | null;
  table_name: string;
};

export function InteractiveSeatingChart({ eventId, user }: { eventId: string; user: User | null }) {
  const supabase = createClient();
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["seating", eventId],
    queryFn: async () => {
      const { data: layout, error } = await supabase
        .from("seating_layouts")
        .select("id, layout_config")
        .eq("event_id", eventId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      if (!layout) return null;

      const { data: seats, error: seatsError } = await supabase
        .from("seats")
        .select("*")
        .eq("layout_id", layout.id)
        .order("table_name")
        .order("seat_number");

      if (seatsError) throw seatsError;

      // Check if user has active locks
      const userPendingSeats = seats.filter(
        (s) => s.status === "pending" && s.locked_by === user?.id,
      );
      let expireTime = null;
      if (userPendingSeats.length > 0) {
        const expiresAt = new Date(userPendingSeats[0].lock_expires_at).getTime();
        if (expiresAt > Date.now()) {
          expireTime = expiresAt;
        }
      }

      return { layout, seats, expireTime, userPendingSeats };
    },
  });

  useEffect(() => {
    if (!data?.expireTime) {
      setTimeLeft(null);
      return;
    }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((data.expireTime! - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        refetch(); // Refresh when expired
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.expireTime, refetch]);

  const lockSeats = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to purchase tickets.");
      if (selectedSeatIds.length !== ticketQuantity) {
        throw new Error(`Please select exactly ${ticketQuantity} seats.`);
      }

      const { error } = await supabase.rpc("lock_seats", {
        p_layout_id: data!.layout.id,
        p_seat_ids: selectedSeatIds,
        p_user_id: user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seats locked! Proceed to checkout.");
      setSelectedSeatIds([]);
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to lock seats. They may have been taken.");
      refetch();
    },
  });

  const releaseSeats = useMutation({
    mutationFn: async (seatIds: string[]) => {
      const { error } = await supabase.rpc("release_seats", {
        p_layout_id: data!.layout.id,
        p_seat_ids: seatIds,
        p_user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seats released.");
      refetch();
    },
  });

  const proceedToCheckout = async () => {
    try {
      const seatIds = data!.userPendingSeats.map((s: SeatData) => s.id);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "http://localhost:54321"}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seatIds, eventId }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      // Redirect to mock checkout url
      window.location.href = json.url;
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || "Checkout failed");
    }
  };

  if (isLoading) return <div className="p-4">Loading seating chart...</div>;
  if (!data?.layout) return null; // No seating for this event

  const { seats, userPendingSeats } = data;
  const hasLocks = userPendingSeats.length > 0;

  const handleSeatClick = (seat: SeatData) => {
    if (!user) {
      toast.error("Please log in to select seats.");
      return;
    }
    const isAvailable =
      seat.status === "available" ||
      (seat.status === "pending" && new Date(seat.lock_expires_at).getTime() < Date.now());
    if (!isAvailable) return;

    if (selectedSeatIds.includes(seat.id)) {
      setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.id));
    } else {
      if (selectedSeatIds.length >= ticketQuantity) {
        toast.error(`You can only select ${ticketQuantity} seats.`);
        return;
      }
      setSelectedSeatIds((prev) => [...prev, seat.id]);
    }
  };

  const tablesMap = new Map<string, SeatData[]>();
  seats.forEach((s: SeatData) => {
    if (!tablesMap.has(s.table_name)) tablesMap.set(s.table_name, []);
    tablesMap.get(s.table_name)!.push(s);
  });

  const svgWidth = Math.max(600, Array.from(tablesMap.keys()).length * 150);

  return (
    <div className="neu-border bg-white p-6 mt-8">
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900 mb-4">
        Interactive Seating Chart
      </h2>

      {hasLocks ? (
        <div className="bg-lime/20 p-4 border-2 border-lime mb-6 flex flex-col sm:flex-row items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <h3 className="font-bold text-lg uppercase font-mono">Your Seats are Held</h3>
            <p className="text-sm font-mono mt-1">
              {userPendingSeats
                .map((s: SeatData) => `${s.table_name} Seat ${s.seat_number}`)
                .join(", ")}
            </p>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            {timeLeft !== null && (
              <div className="flex items-center gap-1 font-mono text-xl text-red-600 font-bold bg-white px-2 py-1 border-2 border-red-600">
                <Clock className="w-5 h-5" />
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
              </div>
            )}
            <Button
              onClick={proceedToCheckout}
              className="neu-border neu-press bg-black text-white uppercase font-bold tracking-wider"
            >
              Checkout
            </Button>
            <Button
              variant="outline"
              className="neu-border neu-press bg-white text-black font-bold uppercase"
              onClick={() => releaseSeats.mutate(userPendingSeats.map((s: SeatData) => s.id))}
            >
              Release
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <Label className="font-mono uppercase font-bold">Quantity</Label>
            <Select
              value={ticketQuantity.toString()}
              onValueChange={(val) => {
                setTicketQuantity(parseInt(val));
                setSelectedSeatIds([]);
              }}
            >
              <SelectTrigger className="w-40 neu-border mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={n.toString()} className="font-mono">
                    {n} Ticket(s)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => lockSeats.mutate()}
            disabled={selectedSeatIds.length !== ticketQuantity || lockSeats.isPending}
            className="neu-border neu-press bg-lime text-black uppercase font-bold tracking-wider"
          >
            {lockSeats.isPending
              ? "Locking..."
              : `Lock ${selectedSeatIds.length} / ${ticketQuantity} Seats`}
          </Button>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm font-mono uppercase font-bold border-2 border-black p-3 bg-gray-50">
        <div className="flex items-center gap-2" aria-label="Legend: Available">
          <div className="w-4 h-4 bg-green-400 border-2 border-black" /> Available
        </div>
        <div className="flex items-center gap-2" aria-label="Legend: Selected">
          <div className="w-4 h-4 bg-blue-500 border-2 border-black" /> Selected
        </div>
        <div className="flex items-center gap-2" aria-label="Legend: Temporarily Held">
          <div className="w-4 h-4 bg-orange-400 border-2 border-black" /> Held
        </div>
        <div className="flex items-center gap-2" aria-label="Legend: Sold">
          <div className="w-4 h-4 bg-gray-400 border-2 border-black" /> Sold
        </div>
      </div>

      <div
        className="overflow-x-auto neu-border bg-peach/10"
        role="region"
        aria-label="Seating Chart"
        tabIndex={0}
      >
        <svg viewBox={`0 0 ${svgWidth} 250`} className="w-full min-w-[600px]">
          {Array.from(tablesMap.entries()).map(([tableName, tableSeats], idx) => {
            const cx = 75 + idx * 150;
            const cy = 125;
            const radius = 40;
            return (
              <g key={tableName}>
                {/* Table */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  className="fill-white stroke-black stroke-[3px]"
                />
                <text
                  x={cx}
                  y={cy + 5}
                  textAnchor="middle"
                  className="font-mono text-sm font-black pointer-events-none fill-black"
                >
                  {tableName}
                </text>

                {/* Seats */}
                {tableSeats.map((seat: SeatData, sIdx: number) => {
                  const angle = (sIdx / tableSeats.length) * Math.PI * 2 - Math.PI / 2;
                  const seatX = cx + Math.cos(angle) * (radius + 20);
                  const seatY = cy + Math.sin(angle) * (radius + 20);

                  let fillColor = "#4ade80"; // green-400
                  let statusText = "available";

                  if (seat.status === "sold") {
                    fillColor = "#9ca3af"; // gray-400
                    statusText = "sold";
                  } else if (seat.status === "pending") {
                    const expiresAt = new Date(seat.lock_expires_at).getTime();
                    if (expiresAt > Date.now()) {
                      fillColor = seat.locked_by === user?.id ? "#fb923c" : "#9ca3af"; // orange-400 or gray-400
                      statusText = "temporarily held";
                    }
                  }

                  if (selectedSeatIds.includes(seat.id)) {
                    fillColor = "#3b82f6"; // blue-500
                    statusText = "selected";
                  }

                  const isAvailable =
                    seat.status === "available" ||
                    (seat.status === "pending" &&
                      new Date(seat.lock_expires_at).getTime() < Date.now());
                  const isClickable = isAvailable && !hasLocks;

                  return (
                    <g
                      key={seat.id}
                      onClick={() => handleSeatClick(seat)}
                      className={
                        isClickable
                          ? "cursor-pointer hover:opacity-80 transition-opacity"
                          : "cursor-not-allowed"
                      }
                      role="button"
                      aria-label={`${tableName}, Seat ${seat.seat_number}, ${statusText}`}
                      tabIndex={isClickable ? 0 : -1}
                      onKeyDown={(e) => e.key === "Enter" && handleSeatClick(seat)}
                    >
                      <circle
                        cx={seatX}
                        cy={seatY}
                        r={14}
                        fill={fillColor}
                        className={`stroke-black ${selectedSeatIds.includes(seat.id) ? "stroke-[4px]" : "stroke-2"}`}
                      />
                      <text
                        x={seatX}
                        y={seatY + 4}
                        textAnchor="middle"
                        className="font-mono text-xs font-black pointer-events-none fill-black"
                      >
                        {seat.seat_number}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
