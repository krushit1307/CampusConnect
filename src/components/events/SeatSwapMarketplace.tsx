import { useState } from "react";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ArrowRightLeft, Check, X, ShieldAlert } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface SeatSwapMarketplaceProps {
  eventId: string;
  user: User | null;
}

export function SeatSwapMarketplace({ eventId, user }: SeatSwapMarketplaceProps) {
  const supabase = createClient();
  const [selectedTargetSeatId, setSelectedTargetSeatId] = useState<string>("");

  // 1. Fetch event seating layout and seats
  const { data: seatingData, isLoading: isSeatingLoading, refetch: refetchSeats } = useQuery({
    queryKey: ["seating-marketplace-seats", eventId],
    queryFn: async () => {
      const { data: layout } = await supabase
        .from("seating_layouts")
        .select("id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (!layout) return { seats: [] };

      const { data: seats, error } = await supabase
        .from("seats")
        .select("*")
        .eq("layout_id", layout.id)
        .order("table_name")
        .order("seat_number");

      if (error) throw error;
      return { seats: seats || [] };
    }
  });

  const seats = seatingData?.seats || [];

  // Find current user's seat
  const mySeat = seats.find((s: any) => s.locked_by === user?.id && s.status === "sold");

  // Find all other sold seats that can be swapped with
  const otherSoldSeats = seats.filter(
    (s: any) => s.status === "sold" && s.locked_by !== user?.id
  );

  // 2. Fetch current user's RSVP ticket ID
  const { data: myRsvp } = useQuery({
    queryKey: ["my-rsvp-for-swap", eventId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_rsvps")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // 3. Fetch trade proposals involving this RSVP ticket
  const { data: requests = [], isLoading: isRequestsLoading, refetch: refetchRequests } = useQuery({
    queryKey: ["seat-swap-requests", myRsvp?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seat_swap_requests")
        .select(`
          id,
          status,
          initiator_ticket_id,
          target_ticket_id,
          created_at,
          initiator:event_rsvps!seat_swap_requests_initiator_ticket_id_fkey (
            id,
            user_id,
            profiles (first_name, last_name, email)
          ),
          target:event_rsvps!seat_swap_requests_target_ticket_id_fkey (
            id,
            user_id,
            profiles (first_name, last_name, email)
          )
        `)
        .or(`initiator_ticket_id.eq.${myRsvp.id},target_ticket_id.eq.${myRsvp.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!myRsvp?.id
  });

  // Mutations
  const proposeMutation = useMutation({
    mutationFn: async () => {
      if (!mySeat) throw new Error("You must reserve a seat before proposing a swap.");
      if (!selectedTargetSeatId) throw new Error("Please select a target seat to swap with.");

      const targetSeatObj = seats.find((s: any) => s.id === selectedTargetSeatId);
      if (!targetSeatObj) throw new Error("Selected target seat not found.");

      // Fetch target user RSVP
      const { data: targetRsvp, error: rsvpErr } = await supabase
        .from("event_rsvps")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", targetSeatObj.locked_by)
        .eq("status", "attending")
        .single();

      if (rsvpErr || !targetRsvp) {
        throw new Error("Could not retrieve target ticket details. They may have cancelled their RSVP.");
      }

      const { data, error } = await supabase.rpc("propose_seat_swap", {
        p_initiator_ticket_id: myRsvp.id,
        p_target_ticket_id: targetRsvp.id
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Seat swap request proposed!");
      setSelectedTargetSeatId("");
      refetchRequests();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to propose seat swap.");
    }
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("accept_seat_swap", { p_request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seat swap trade completed successfully!");
      refetchSeats();
      refetchRequests();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to accept seat swap.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("reject_seat_swap", { p_request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seat swap rejected.");
      refetchRequests();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to reject seat swap.");
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cancel_seat_swap", { p_request_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Seat swap request cancelled.");
      refetchRequests();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to cancel seat swap.");
    }
  });

  if (!user) return null;

  return (
    <div className="neu-border bg-white p-6 mt-8 text-black shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center gap-2 mb-4">
        <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-indigo-900">
          Seat Swap Marketplace
        </h2>
      </div>

      {isSeatingLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : mySeat ? (
        <div className="space-y-6">
          <div className="bg-indigo-50 border-2 border-indigo-500 p-4 font-mono text-sm shadow-[2px_2px_0_0_#000]">
            <span className="font-bold text-indigo-900 uppercase">Your Seated Spot:</span>{" "}
            <span className="bg-white px-2 py-0.5 border border-indigo-200 rounded font-black">
              Table {mySeat.table_name} - Seat {mySeat.seat_number}
            </span>
          </div>

          {/* Proposal form */}
          <div className="border-2 border-black p-4 bg-cream/10 space-y-4">
            <h3 className="font-mono text-sm font-bold uppercase">Propose a seat trade</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedTargetSeatId}
                onChange={(e) => setSelectedTargetSeatId(e.target.value)}
                className="neu-border bg-white p-2 font-mono text-sm w-full sm:max-w-xs"
              >
                <option value="">-- Choose Seat to Swap With --</option>
                {otherSoldSeats.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    Table {s.table_name} - Seat {s.seat_number}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => proposeMutation.mutate()}
                disabled={!selectedTargetSeatId || proposeMutation.isPending}
                className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 rounded-none shadow-[2px_2px_0_0_#000]"
              >
                {proposeMutation.isPending ? "Proposing..." : "Propose Swap"}
              </Button>
            </div>
          </div>

          {/* Pending requests log */}
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-bold uppercase">Active Trades</h3>
            {isRequestsLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            ) : requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map((r: any) => {
                  const isInitiator = r.initiator_ticket_id === myRsvp.id;
                  
                  // Map seats
                  const initSeat = seats.find((s: any) => s.locked_by === r.initiator.user_id && s.status === "sold");
                  const targSeat = seats.find((s: any) => s.locked_by === r.target.user_id && s.status === "sold");

                  const initLabel = initSeat ? `Table ${initSeat.table_name} Seat ${initSeat.seat_number}` : "Unknown Seat";
                  const targLabel = targSeat ? `Table ${targSeat.table_name} Seat ${targSeat.seat_number}` : "Unknown Seat";

                  const otherName = isInitiator 
                    ? `${r.target.profiles?.first_name || ""} ${r.target.profiles?.last_name || ""}`.trim() || "Target"
                    : `${r.initiator.profiles?.first_name || ""} ${r.initiator.profiles?.last_name || ""}`.trim() || "Initiator";

                  return (
                    <div
                      key={r.id}
                      className="neu-border bg-white p-4 shadow-[2px_2px_0_0_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            r.status === "pending" ? "bg-yellow-100 border-yellow-200 text-yellow-800" :
                            r.status === "accepted" ? "bg-green-100 border-green-200 text-green-800" : "bg-gray-100 border-gray-200 text-gray-800"
                          }`}>
                            {r.status}
                          </span>
                          <span className="text-gray-500 font-bold uppercase">
                            {isInitiator ? "Sent Request" : "Received Request"}
                          </span>
                        </div>
                        <p className="text-sm">
                          {isInitiator ? (
                            <>You offered to trade <strong>{initLabel}</strong> for <strong>{targLabel}</strong> ({otherName})</>
                          ) : (
                            <><strong>{otherName}</strong> wants to trade <strong>{initLabel}</strong> for your <strong>{targLabel}</strong></>
                          )}
                        </p>
                      </div>

                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          {isInitiator ? (
                            <Button
                              onClick={() => cancelMutation.mutate(r.id)}
                              disabled={cancelMutation.isPending}
                              variant="destructive"
                              className="neu-border bg-red-500 text-cream hover:bg-red-600 rounded-none shadow-[1px_1px_0_0_#000]"
                            >
                              <X className="w-3.5 h-3.5 mr-1" /> Cancel
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => acceptMutation.mutate(r.id)}
                                disabled={acceptMutation.isPending || rejectMutation.isPending}
                                className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 rounded-none shadow-[1px_1px_0_0_#000]"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Accept
                              </Button>
                              <Button
                                onClick={() => rejectMutation.mutate(r.id)}
                                disabled={acceptMutation.isPending || rejectMutation.isPending}
                                variant="destructive"
                                className="neu-border bg-red-500 text-cream hover:bg-red-600 rounded-none shadow-[1px_1px_0_0_#000]"
                              >
                                <X className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="font-mono text-xs text-gray-500 italic bg-gray-50 p-4 border border-dashed border-gray-300">
                No active seat swap proposals found.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border-2 border-yellow-300 p-4 font-mono text-sm shadow-[2px_2px_0_0_#000] flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-yellow-900 uppercase">Seat Required:</span>
            <p className="text-xs text-gray-700 mt-1">
              You must purchase/reserve a seat layout ticket for this event to access the Seat Swap Marketplace.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
