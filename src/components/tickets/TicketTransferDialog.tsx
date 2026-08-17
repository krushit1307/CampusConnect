import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ShieldCheck, X } from "lucide-react";
import {
  describePriceCap,
  describeViolation,
  evaluateTransfer,
  maximumPriceCents,
  type TransferAssessment,
} from "@/lib/resaleGuard";
import { ticketResaleService, type TransferContext } from "@/services/ticketResaleService";

interface TicketTransferDialogProps {
  eventId: string;
  eventTitle: string;
  eventStartsAt: string;
  ticketId: string;
  sellerId: string;
  /** Face value in cents. Resolved from the event's ticket tiers when omitted. */
  faceValueCents?: number;
  onClose: () => void;
  onTransferred?: (assessment: TransferAssessment) => void;
}

/**
 * Transfer dialog for a ticket the current user holds.
 *
 * The same guard that enforces the rules on the server runs here as the seller
 * types, so they find out the ceiling before they agree a price with somebody
 * rather than after.
 */
export function TicketTransferDialog({
  eventId,
  eventTitle,
  eventStartsAt,
  ticketId,
  sellerId,
  faceValueCents,
  onClose,
  onTransferred,
}: TicketTransferDialogProps) {
  const [context, setContext] = useState<TransferContext | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [price, setPrice] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    ticketResaleService
      .getTransferContext(eventId, ticketId, sellerId, faceValueCents)
      .then((result) => {
        if (!cancelled) setContext(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Could not load the transfer rules");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventId, ticketId, sellerId, faceValueCents]);

  const askingPriceCents = Math.round(Number(price) * 100) || 0;

  const preview = useMemo(() => {
    if (!context || !buyerId) return null;
    return evaluateTransfer(context.policy, context.ticket, context.seller, {
      sellerId,
      buyerId,
      askingPriceCents,
      requestedAt: new Date().toISOString(),
      eventStartsAt,
    });
  }, [context, buyerId, askingPriceCents, sellerId, eventStartsAt]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!context) return;
    if (!buyerId.trim()) {
      toast.error("Enter the account the ticket is going to.");
      return;
    }

    setSubmitting(true);
    try {
      const assessment = await ticketResaleService.requestTransfer(context, {
        sellerId,
        buyerId: buyerId.trim(),
        askingPriceCents,
        requestedAt: new Date().toISOString(),
        eventStartsAt,
      });

      if (assessment.decision === "allow") {
        await ticketResaleService.recordHolderChange(ticketId, sellerId, buyerId.trim());
        toast.success("Ticket transferred.");
      } else if (assessment.decision === "review") {
        toast.info(assessment.summary);
      } else {
        toast.error(assessment.summary);
      }

      onTransferred?.(assessment);
      if (assessment.decision !== "block") onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const capSentence = context ? describePriceCap(context.policy, context.ticket) : null;
  const maxPrice = context ? maximumPriceCents(context.policy, context.ticket) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="neu-border w-full max-w-md bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <h2 className="text-lg font-bold">Transfer ticket</h2>
            <p className="font-mono text-xs text-gray-600">{eventTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close transfer dialog"
            className="neu-border bg-white p-1 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!context ? (
          <div className="h-32 animate-pulse bg-gray-100" />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
            <p className="neu-border flex items-start gap-2 bg-lime/40 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{capSentence}</span>
            </p>

            <label className="block">
              <span className="mb-1 block uppercase text-gray-600">Transfer to (account ID)</span>
              <input
                value={buyerId}
                onChange={(event) => setBuyerId(event.target.value)}
                className="neu-border w-full px-3 py-2"
                placeholder="Account the ticket is going to"
              />
            </label>

            <label className="block">
              <span className="mb-1 block uppercase text-gray-600">
                Price (USD, max {(maxPrice / 100).toFixed(2)})
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={context.policy.capMode === "free_only"}
                className="neu-border w-full px-3 py-2 disabled:bg-gray-100"
              />
            </label>

            {preview && <AssessmentPreview assessment={preview} />}

            <button
              type="submit"
              disabled={submitting || preview?.decision === "block"}
              className="neu-border w-full bg-lime px-4 py-2 font-bold uppercase hover:bg-peach disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Working…" : "Transfer ticket"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AssessmentPreview({ assessment }: { assessment: TransferAssessment }) {
  if (assessment.decision === "allow") {
    return (
      <p className="neu-border bg-white p-3">
        {assessment.summary} Risk score {assessment.riskScore}/100.
      </p>
    );
  }

  return (
    <div
      className={`neu-border p-3 ${assessment.decision === "block" ? "bg-peach" : "bg-yellow-100"}`}
    >
      <p className="flex items-center gap-2 font-bold uppercase">
        <AlertTriangle className="h-4 w-4" />
        {assessment.decision === "block" ? "Transfer blocked" : "Needs organiser review"}
      </p>
      <p className="mt-1">{assessment.summary}</p>

      {assessment.violations.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {assessment.violations.map((violation) => (
            <li key={violation.code}>
              <strong>{describeViolation(violation.code)}:</strong> {violation.message}
            </li>
          ))}
        </ul>
      )}

      {assessment.decision === "review" && assessment.riskFactors.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-gray-700">
          {assessment.riskFactors.map((factor) => (
            <li key={factor.label}>
              {factor.label} (+{factor.points})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TicketTransferDialog;
