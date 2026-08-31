// src/components/events/HelpQueueMentorDashboard.tsx
// -----------------------------------------------------------------------------
// Issue: #3938 — Build a 'Real-Time "Help Desk" Queue' for Hackathons
//
// The mentor-facing dashboard. Shows all open tickets in real time.
// Mentors click "Claim" to pick up a ticket, then "Resolve" when done.
// -----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import {
  LifeBuoy, Users, Clock, CheckCircle2,
  Loader2, Radio, Hand, MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { useHelpQueue } from "@/hooks/useHelpQueue";
import {
  isOpen, isClaimed, type HelpTicket,
} from "@/lib/helpQueue";

export interface HelpQueueMentorDashboardProps {
  eventId: string;
}

export function HelpQueueMentorDashboard({ eventId }: HelpQueueMentorDashboardProps) {
  const {
    tickets, isLoading, error, isRealtimeConnected,
    claimTicket, resolveTicket,
  } = useHelpQueue(eventId);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const openTickets = useMemo(
    () => tickets.filter(isOpen).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
    [tickets],
  );
  const claimedTickets = useMemo(
    () => tickets.filter(isClaimed),
    [tickets],
  );

  const handleClaim = async (ticket: HelpTicket) => {
    setClaimingId(ticket.id);
    try {
      const result = await claimTicket(ticket.id);
      if (result.claimed) {
        toast.success(
          `Claimed! You're helping Team "${ticket.team_name}" at Table ${ticket.table_number}.`,
        );
      } else {
        toast.error(result.reason || "Ticket already claimed.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to claim ticket";
      toast.error(msg);
    } finally {
      setClaimingId(null);
    }
  };

  const handleResolve = async (ticket: HelpTicket) => {
    setResolvingId(ticket.id);
    try {
      const result = await resolveTicket(ticket.id);
      if (result.ok) {
        toast.success(`Ticket for "${ticket.team_name}" resolved. ✅`);
      } else {
        toast.error(result.reason || "Could not resolve ticket.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resolve ticket";
      toast.error(msg);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="neu-border bg-white p-6 space-y-6" data-testid="help-queue-mentor-dashboard">
      <div className="flex items-center justify-between border-b-4 border-black pb-4">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="font-display text-2xl font-black uppercase tracking-tight">
              Help Desk Queue
            </h2>
            <p className="font-mono text-xs text-gray-500">
              Mentor Dashboard — claim tickets to help teams
            </p>
          </div>
        </div>
        <RealtimeBadge isConnected={isRealtimeConnected} />
      </div>

      {error && (
        <div className="border-2 border-red-400 bg-red-50 p-3 font-mono text-sm text-red-800"
             data-testid="help-queue-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatBox label="Open Tickets" value={openTickets.length} icon={<Hand className="h-4 w-4" />} />
        <StatBox label="Claimed" value={claimedTickets.length} icon={<Users className="h-4 w-4" />} />
        <StatBox label="Resolved" value={tickets.filter(t => t.status === "resolved").length} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div>
        <h3 className="font-display text-lg font-bold uppercase text-gray-900 mb-3">
          Waiting for Help ({openTickets.length})
        </h3>
        {isLoading && openTickets.length === 0 ? (
          <div className="flex items-center gap-2 font-mono text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : openTickets.length === 0 ? (
          <p className="font-mono text-sm text-gray-400" data-testid="no-open-tickets">
            No teams waiting. You're all caught up! 🎉
          </p>
        ) : (
          <ul className="space-y-3" data-testid="open-tickets-list">
            {openTickets.map((ticket, idx) => (
              <OpenTicketRow
                key={ticket.id}
                ticket={ticket}
                position={idx + 1}
                onClaim={() => handleClaim(ticket)}
                isClaiming={claimingId === ticket.id}
              />
            ))}
          </ul>
        )}
      </div>

      {claimedTickets.length > 0 && (
        <div>
          <h3 className="font-display text-sm font-bold uppercase text-gray-500 mb-2">
            Claimed Tickets
          </h3>
          <ul className="space-y-2">
            {claimedTickets.map((ticket) => (
              <ClaimedTicketRow
                key={ticket.id}
                ticket={ticket}
                onResolve={() => handleResolve(ticket)}
                isResolving={resolvingId === ticket.id}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RealtimeBadge({ isConnected }: { isConnected: boolean }) {
  return (
    <span className={`flex items-center gap-1 border-2 border-black px-2 py-1 font-mono text-[10px] font-bold uppercase ${
      isConnected ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"
    }`} data-testid="help-queue-realtime-badge">
      <Radio className={`h-3 w-3 ${isConnected ? "animate-pulse" : ""}`} />
      {isConnected ? "Live" : "Connecting…"}
    </span>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="neu-border bg-gray-50 p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-gray-500">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function OpenTicketRow({
  ticket, position, onClaim, isClaiming,
}: {
  ticket: HelpTicket; position: number; onClaim: () => void; isClaiming: boolean;
}) {
  return (
    <li className="neu-border bg-white p-4 space-y-2" data-testid={`open-ticket-${ticket.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-bold text-blue-900">#{position}</span>
            <h4 className="font-display text-sm font-bold text-gray-900">{ticket.team_name}</h4>
          </div>
          <p className="mt-1 font-mono text-xs text-gray-500 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Table {ticket.table_number}
          </p>
          <p className="mt-2 text-sm text-gray-700 break-words">{ticket.issue_description}</p>
        </div>
        <div className="flex-shrink-0">
          <button type="button" onClick={onClaim} disabled={isClaiming}
            data-testid={`claim-ticket-${ticket.id}`}
            className="flex items-center gap-1 border-2 border-black bg-blue-500 px-3 py-1.5 font-mono text-xs font-bold uppercase text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
            {isClaiming ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hand className="h-3 w-3" />}
            Claim
          </button>
        </div>
      </div>
      <div className="font-mono text-[10px] text-gray-400 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {new Date(ticket.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
    </li>
  );
}

function ClaimedTicketRow({
  ticket, onResolve, isResolving,
}: {
  ticket: HelpTicket; onResolve: () => void; isResolving: boolean;
}) {
  return (
    <li className="neu-border bg-amber-50 p-3 border-amber-400" data-testid={`claimed-ticket-${ticket.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-bold text-gray-900">{ticket.team_name}</h4>
          <p className="font-mono text-xs text-gray-500">Table {ticket.table_number}</p>
          <p className="mt-1 text-xs text-gray-600 break-words">{ticket.issue_description}</p>
        </div>
        <button type="button" onClick={onResolve} disabled={isResolving}
          data-testid={`resolve-ticket-${ticket.id}`}
          className="flex items-center gap-1 border-2 border-black bg-green-400 px-3 py-1.5 font-mono text-xs font-bold uppercase hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50">
          {isResolving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          Resolve
        </button>
      </div>
    </li>
  );
}
