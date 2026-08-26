import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { SeatData } from "@/components/events/SeatingChart";

interface EventSeat {
  id: string;
  event_id: string;
  label: string;
  row_label: string;
  section: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "circle";
  status: "available" | "reserved" | "maintenance";
  reserved_by: string | null;
  version: number;
}

function toSeatData(seat: EventSeat): SeatData {
  return {
    id: seat.id,
    label: seat.label,
    row_label: seat.row_label,
    section: seat.section,
    x: seat.x,
    y: seat.y,
    width: seat.width,
    height: seat.height,
    shape: seat.shape,
    status: seat.status,
  };
}

export function useEventSeats(eventId: string | undefined) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  useEffect(() => {
    setSelectedSeats([]);
  }, [eventId]);

  const { data: seats = [], isLoading } = useQuery<EventSeat[]>({
    queryKey: ["event-seats", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_seats")
        .select("*")
        .eq("event_id", eventId!)
        .order("y", { ascending: true })
        .order("x", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!eventId,
  });

  const seatDataArray: SeatData[] = seats.map(toSeatData);
  const reservedSeatIds = seats.filter((s) => s.status === "reserved").map((s) => s.id);

  const toggleSeat = useCallback((seatId: string) => {
    setSelectedSeats((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId],
    );
  }, []);

  const reserveSeat = useMutation({
    mutationFn: async (seatId: string) => {
      const { data, error } = await supabase.rpc("reserve_seat", {
        p_seat_id: seatId,
      });
      if (error) throw error;
      const result = data as {
        success: boolean;
        code: string;
        message: string;
      };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-seats", eventId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const releaseSeat = useMutation({
    mutationFn: async (seatId: string) => {
      const { data, error } = await supabase.rpc("release_seat", {
        p_seat_id: seatId,
      });
      if (error) throw error;
      const result = data as { success: boolean; message: string };
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-seats", eventId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const generateLayout = useMutation({
    mutationFn: async ({ rows, seatsPerRow }: { rows: number; seatsPerRow: number }) => {
      const { data, error } = await supabase.rpc("generate_event_seating_layout", {
        p_event_id: eventId,
        p_rows: rows,
        p_seats_per_row: seatsPerRow,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-seats", eventId] });
      toast.success("Seating layout generated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    seats: seatDataArray,
    rawSeats: seats,
    reservedSeatIds,
    selectedSeats,
    toggleSeat,
    setSelectedSeats,
    isLoading,
    reserveSeat,
    releaseSeat,
    generateLayout,
    hasSeats: seats.length > 0,
  };
}
