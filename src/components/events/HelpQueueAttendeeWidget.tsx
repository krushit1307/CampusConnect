// src/components/events/HelpQueueAttendeeWidget.tsx
// -----------------------------------------------------------------------------
// Issue: #3938 — Build a 'Real-Time "Help Desk" Queue' for Hackathons
//
// The attendee-facing widget. Renders a "Request Mentor Help" form
// and, once submitted, shows the attendee's position in the live queue
// + their ticket status. When a mentor claims the ticket, a toast
// fires: "Alex is on their way to Table 42!"
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import {
  LifeBuoy, Hand, Clock, CheckCircle2, XCircle,
  Loader2, MapPin, Users, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useHelpQueue } from "@/hooks/useHelpQueue";
import {
  getQueuePosition, ticketsAhead, estimateWaitMinutes, formatWaitTime,
  statusLabel, statusColor, isTicketOwner,
  buildMentorClaimedMessage, type HelpTicket,
} from "@/lib/helpQueue";

export interface HelpQueueAttendeeWidgetProps {
  eventId: string;
  userId: string | null | undefined;
}

export function HelpQueueAttendeeWidget({ eventId, userId }: HelpQueueAttendeeWidgetProps) {
  const { tickets, error, submitTicket, cancelTicket } = useHelpQueue(eventId);

  const [teamName, setTeamName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const myActiveTicket = useMemo(() => {
    if (!userId) return null;
    return tickets.find(
      (t) => isTicketOwner(t, userId) && (t.status === "open" || t.status === "claimed"),
    ) ?? null;
  }, [tickets, userId]);

  const myPosition = useMemo(() => {
    if (!myActiveTicket || myActiveTicket.status !== "open") return 0;
    return getQueuePosition(tickets, myActiveTicket.id);
  }, [tickets, myActiveTicket]);

  const aheadCount = myPosition > 0 ? myPosition - 1 : 0;
  const waitMin = estimateWaitMinutes(aheadCount);
  const waitLabel = formatWaitTime(waitMin);

  // Toast when a mentor claims the ticket.
  const prevClaimedRef = useState<{ id: string; claimed: boolean } | null>(null);
  useEffect(() => {
    if (!myActiveTicket) return;
    const wasClaimed = prevClaimedRef.current?.claimed ?? false;
    const isClaimedNow = myActiveTicket.status === "claimed";

    if (isClaimedNow && !wasClaimed) {
      const msg = buildMentorClaimedMessage(
        myActiveTicket.mentor_name,
        myActiveTicket.table_number,
      );
      toast.success(msg, { duration: 8000 });
    }
    prevClaimedRef.current = { id: myActiveTicket.id, claimed: isClaimedNow };
  }, [myActiveTicket]);

  const handleSubmit = async () => {
    if (!teamName.trim() || !tableNumber.trim() || !issueDescription.trim()) {
      toast.error("All fields are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      await submitTicket({
        team_name: teamName.trim(),
        table_number: tableNumber.trim(),
        issue_description: issueDescription.trim(),
      });
      toast.success("Help request submitted! You're in the queue.");
      setTeamName("");
      setTableNumber("");
      setIssueDescription("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!myActiveTicket) return;
    setIsCancelling(true);
    try {
      const result = await cancelTicket(myActiveTicket.id);
      if (result.ok) {
        toast.info("Help request cancelled.");
      } else {
        toast.error(result.reason || "Could not cancel request.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel request";
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="neu-border bg-white p-6 space-y-4" data-testid="help-queue-attendee-widget">
      <div className="flex items-center gap-3 border-b-4 border-black pb-3">
        <LifeBuoy className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="font-display text-xl font-black uppercase tracking-tight">Help Desk</h2>
          <p className="font-mono text-xs text-gray-500">Request mentor help for your team</p>
        </div>
      </div>

      {error && (
        <div className="border-2 border-red-400 bg-red-50 p-3 font-mono text-sm text-red-800"
             data-testid="help-queue-attendee-error">
          {error}
        </div>
      )}

      {myActiveTicket ? (
        <ActiveTicketCard
          ticket={myActiveTicket}
          position={myPosition}
          waitLabel={waitLabel}
          onCancel={handleCancel}
          isCancelling={isCancelling}
        />
      ) : (
        <div className="space-y-3" data-testid="help-request-form">
          <div>
            <label htmlFor="hq-team-name" className="font-mono text-xs font-bold uppercase text-gray-700">Team Name</label>
            <input id="hq-team-name" type="text" value={teamName}
              onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Code Ninjas"
              maxLength={100} data-testid="hq-team-name"
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="hq-table-number" className="font-mono text-xs font-bold uppercase text-gray-700">Table Number</label>
            <input id="hq-table-number" type="text" value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)} placeholder="e.g. 42"
              maxLength={20} data-testid="hq-table-number"
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label htmlFor="hq-issue" className="font-mono text-xs font-bold uppercase text-gray-700">Issue Description</label>
            <textarea id="hq-issue" value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="e.g. Our React app won't compile — we're getting a 'Module not found' error."
              maxLength={500} rows={3} data-testid="hq-issue"
              className="mt-1 w-full border-2 border-black bg-white px-3 py-2 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="text-right font-mono text-[10px] text-gray-400">
              {issueDescription.length}/500
            </div>
          </div>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting || !userId}
            data-testid="hq-submit-btn"
            className="flex w-full items-center justify-center gap-2 border-4 border-black bg-blue-500 px-4 py-3 font-display text-lg font-black uppercase text-white shadow-[6px_6px_0_0_#000] transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0_0_#000] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Hand className="h-5 w-5" />}
            Request Mentor Help
          </button>
          {!userId && (
            <p className="text-center font-mono text-xs text-gray-500">
              Sign in to submit a help request.
            </p>
          )}
        </div>
      )}

      {!myActiveTicket && tickets.length > 0 && (
        <div className="border-t border-gray-200 pt-3" data-testid="queue-overview">
          <p className="font-mono text-xs uppercase text-gray-500 mb-2">
            Live Queue ({tickets.filter((t) => t.status === "open").length} waiting)
          </p>
          <div className="flex items-center gap-2 font-mono text-xs text-gray-600">
            <Users className="h-3 w-3" />
            <span>
              {tickets.filter((t) => t.status === "claimed").length} being helped now
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiveTicketCard({
  ticket, position, waitLabel, onCancel, isCancelling,
}: {
  ticket: HelpTicket; position: number; waitLabel: string;
  onCancel: () => void; isCancelling: boolean;
}) {
  return (
    <div className={`border-2 p-4 space-y-3 ${
      ticket.status === "claimed" ? "border-amber-400 bg-amber-50" : "border-blue-400 bg-blue-50"
    }`} data-testid="active-ticket-card">
      <div className="flex items-center justify-between">
        <span className={`border px-3 py-1 rounded-full text-xs font-bold uppercase ${statusColor(ticket.status)}`}>
          {statusLabel(ticket.status)}
        </span>
        {ticket.status === "open" && position > 0 && (
          <span className="font-display text-2xl font-black text-blue-700">#{position}</span>
        )}
      </div>
      <div className="space-y-1">
        <h4 className="font-display text-sm font-bold text-gray-900">{ticket.team_name}</h4>
        <p className="font-mono text-xs text-gray-600 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Table {ticket.table_number}
        </p>
        <p className="text-xs text-gray-600 break-words">{ticket.issue_description}</p>
      </div>
      {ticket.status === "open" && position > 0 && (
        <div className="bg-white border border-blue-200 rounded-lg p-3 text-center">
          <p className="font-display text-lg font-bold text-blue-900">
            You are #{position} in line
          </p>
          <p className="font-mono text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
            <Clock className="h-3 w-3" /> Est. wait: {waitLabel}
          </p>
        </div>
      )}
      {ticket.status === "claimed" && (
        <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-lg p-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="font-mono text-sm font-bold text-amber-800">
            {buildMentorClaimedMessage(ticket.mentor_name, ticket.table_number)}
          </p>
        </div>
      )}
      {ticket.status === "open" && (
        <button type="button" onClick={onCancel} disabled={isCancelling}
          data-testid="hq-cancel-btn"
          className="flex w-full items-center justify-center gap-1 border-2 border-black bg-gray-100 px-3 py-2 font-mono text-xs font-bold uppercase text-gray-700 hover:bg-gray-200 disabled:opacity-50">
          {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
          Cancel Request
        </button>
      )}
      {ticket.status === "resolved" && (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-mono text-sm font-bold">Issue resolved. Happy hacking!</span>
        </div>
      )}
    </div>
  );
}
