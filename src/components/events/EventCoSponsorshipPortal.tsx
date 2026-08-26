import { useEffect, useMemo, useState } from "react";
import { Handshake, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { calculateEscrowBalance, normalizeContributionAmount } from "@/lib/coSponsorship";

type CoSponsorStatus = "pending" | "approved" | "rejected" | "refunded";

type CoSponsor = {
  id: string;
  event_id: string;
  club_id: string;
  requested_by: string;
  contribution_amount: number;
  status: CoSponsorStatus;
  approved_at: string | null;
  refunded_at: string | null;
  created_at: string;
  clubs?: { name: string } | { name: string }[] | null;
};

type ClubOption = { id: string; name: string };
type EscrowEntry = { amount: number; entry_type: "deposit" | "refund" };

function getClubName(value: CoSponsor["clubs"]) {
  return Array.isArray(value) ? value[0]?.name : value?.name;
}

function money(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);
}

export function EventCoSponsorshipPortal({
  eventId,
  isOrganizer,
}: {
  eventId: string;
  isOrganizer: boolean;
}) {
  const [supabase] = useState(() => createClient());
  const [requests, setRequests] = useState<CoSponsor[]>([]);
  const [clubs, setClubs] = useState<ClubOption[]>([]);
  const [escrowEntries, setEscrowEntries] = useState<EscrowEntry[]>([]);
  const [selectedClubId, setSelectedClubId] = useState("");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadPortal = async () => {
    setIsLoading(true);
    const [{ data: requestData, error: requestError }, { data: clubData }, { data: escrowData }] =
      await Promise.all([
        supabase
          .from("co_sponsors")
          .select(
            "id, event_id, club_id, requested_by, contribution_amount, status, approved_at, refunded_at, created_at, clubs(name)",
          )
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),
        supabase.from("clubs").select("id, name").order("name").limit(500),
        supabase.from("event_escrow_ledger").select("amount, entry_type").eq("event_id", eventId),
      ]);

    if (requestError) {
      toast.error("Could not load co-sponsorship requests.");
    } else {
      setRequests((requestData ?? []) as CoSponsor[]);
    }
    setClubs((clubData ?? []) as ClubOption[]);
    setEscrowEntries((escrowData ?? []) as EscrowEntry[]);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadPortal();
    const channel = supabase
      .channel(`event-co-sponsors:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "co_sponsors", filter: `event_id=eq.${eventId}` },
        () => void loadPortal(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_escrow_ledger",
          filter: `event_id=eq.${eventId}`,
        },
        () => void loadPortal(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  const escrowBalance = useMemo(() => calculateEscrowBalance(escrowEntries), [escrowEntries]);

  const createRequest = async () => {
    const parsedAmount = normalizeContributionAmount(amount);
    if (!selectedClubId || parsedAmount === null) {
      toast.error("Select a club and enter a contribution greater than zero.");
      return;
    }
    setIsCreating(true);
    const { error } = await supabase.rpc("create_co_sponsor_request", {
      p_event_id: eventId,
      p_club_id: selectedClubId,
      p_contribution_amount: parsedAmount,
    });
    setIsCreating(false);
    if (error) {
      toast.error(error.message || "Could not create the co-sponsor request.");
      return;
    }
    setSelectedClubId("");
    setAmount("");
    toast.success("Co-sponsorship request sent.");
    await loadPortal();
  };

  const respond = async (requestId: string, approved: boolean) => {
    setBusyRequestId(requestId);
    const { error } = await supabase.rpc("respond_to_co_sponsor_request", {
      p_request_id: requestId,
      p_approved: approved,
    });
    setBusyRequestId(null);
    if (error) {
      toast.error(error.message || "Could not update the co-sponsorship request.");
      return;
    }
    toast.success(approved ? "Contribution approved and placed in escrow." : "Request declined.");
    await loadPortal();
  };

  return (
    <section
      className="neu-border neu-shadow mt-8 bg-amber-50 p-5"
      aria-labelledby="co-sponsorship-title"
    >
      <div className="flex flex-col gap-3 border-b-2 border-black pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider">
            <Handshake className="h-4 w-4" /> Financial pooling
          </p>
          <h2 id="co-sponsorship-title" className="mt-1 font-display text-2xl font-black uppercase">
            Event co-sponsorship
          </h2>
          <p className="mt-1 max-w-2xl font-mono text-xs text-black/65">
            Approved contributions are debited from the sponsoring club and held in event escrow
            until the event is completed or canceled.
          </p>
        </div>
        <div className="border-2 border-black bg-white px-3 py-2 text-right">
          <p className="font-mono text-[10px] font-bold uppercase text-black/60">Escrow balance</p>
          <p className="font-display text-xl font-black">{money(escrowBalance)}</p>
        </div>
      </div>

      {isOrganizer && (
        <div className="mt-4 grid gap-3 border-b-2 border-black pb-5 md:grid-cols-[1fr_10rem_auto]">
          <label className="font-mono text-xs font-bold uppercase">
            Invite sponsoring club
            <select
              value={selectedClubId}
              onChange={(event) => setSelectedClubId(event.target.value)}
              className="mt-1 w-full border-2 border-black bg-white p-2 font-mono text-sm font-normal"
            >
              <option value="">Select a club</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
          <label className="font-mono text-xs font-bold uppercase">
            Contribution
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="$0.00"
              className="mt-1 w-full border-2 border-black bg-white p-2 font-mono text-sm font-normal"
            />
          </label>
          <Button
            type="button"
            onClick={() => void createRequest()}
            disabled={isCreating}
            className="self-end neu-border font-mono text-xs font-bold uppercase"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
          </Button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold uppercase">Requests and approvals</h3>
        <button
          type="button"
          onClick={() => void loadPortal()}
          className="flex items-center gap-1 font-mono text-xs font-bold uppercase underline"
          disabled={isLoading}
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 font-mono text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading co-sponsors…
        </div>
      ) : requests.length === 0 ? (
        <p className="mt-4 border-2 border-dashed border-black/30 p-4 font-mono text-sm text-black/60">
          No co-sponsorship requests yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-3 border-2 border-black bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold">{getClubName(request.clubs) || "Sponsoring club"}</p>
                <p className="font-mono text-xs text-black/65">
                  {money(Number(request.contribution_amount))} · requested{" "}
                  {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase ${request.status === "approved" ? "bg-lime" : request.status === "refunded" ? "bg-sky" : request.status === "rejected" ? "bg-red-300" : "bg-yellow-200"}`}
                >
                  {request.status}
                </span>
                {request.status === "pending" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void respond(request.id, false)}
                      disabled={busyRequestId === request.id}
                      className="neu-border font-mono text-[10px] font-bold uppercase"
                    >
                      Decline
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void respond(request.id, true)}
                      disabled={busyRequestId === request.id}
                      className="neu-border font-mono text-[10px] font-bold uppercase"
                    >
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
