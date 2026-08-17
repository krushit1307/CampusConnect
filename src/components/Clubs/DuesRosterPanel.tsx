import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, HandCoins, Receipt, TrendingUp } from "lucide-react";
import { duesService, type ClubDuesView, type DuesRosterEntry } from "@/services/duesService";
import { describeStanding, type MemberStanding } from "@/lib/duesDunning";

interface DuesRosterPanelProps {
  clubId: string;
  /** Overrides today's date. Only used by tests and by the ledger preview. */
  asOf?: string;
}

const STANDING_STYLES: Record<MemberStanding, string> = {
  paid: "bg-lime",
  waived: "bg-white",
  pending: "bg-white",
  grace: "bg-yellow-100",
  delinquent: "bg-peach",
  suspended: "bg-red-200",
};

function formatCents(cents: number): string {
  const dollars = Math.floor(Math.abs(cents) / 100).toLocaleString("en-US");
  const remainder = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}$${dollars}.${remainder}`;
}

/**
 * Treasurer view of membership dues: who has paid, who is behind, and which
 * reminder is due next. Standing is computed by the dues rules rather than
 * being stored, so the roster cannot drift out of date.
 */
export function DuesRosterPanel({ clubId, asOf }: DuesRosterPanelProps) {
  const [view, setView] = useState<ClubDuesView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await duesService.getClubDuesView(clubId, asOf));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the dues roster");
    } finally {
      setLoading(false);
    }
  }, [clubId, asOf]);

  useEffect(() => {
    load();
  }, [load]);

  const handleIssue = async () => {
    try {
      const result = await duesService.issueInvoicesForPeriod(clubId, asOf);
      toast.success(
        result.issued === 0
          ? "Every member already has an invoice for this period."
          : `Issued ${result.issued} invoice${result.issued === 1 ? "" : "s"}.`,
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not issue invoices");
    }
  };

  const handleMarkPaid = async (entry: DuesRosterEntry) => {
    if (entry.outstandingCents <= 0) return;
    setBusyInvoiceId(entry.invoice.id);
    try {
      await duesService.recordPayment(entry.invoice.id, entry.outstandingCents, "manual");
      toast.success(`Recorded ${formatCents(entry.outstandingCents)} from ${entry.memberName}.`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the payment");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const handleSendReminder = async (entry: DuesRosterEntry) => {
    if (!entry.dueStep) return;
    setBusyInvoiceId(entry.invoice.id);
    try {
      const sent = await duesService.markDunningStepSent(entry.invoice.id, entry.dueStep.key);
      toast[sent ? "success" : "info"](
        sent
          ? `Sent the "${entry.dueStep.template}" reminder to ${entry.memberName}.`
          : "That reminder had already been sent.",
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reminder");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  if (loading) {
    return <div className="neu-border h-40 animate-pulse bg-white" />;
  }

  if (!view?.plan) {
    return (
      <div className="neu-border bg-white p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <HandCoins className="h-5 w-5" /> Membership dues
        </h2>
        <p className="mt-3 font-mono text-sm text-gray-500">
          This club has no active dues plan. Once a plan is set up, invoices, standing and reminders
          are tracked here.
        </p>
      </div>
    );
  }

  const { plan, roster, summary } = view;

  return (
    <div className="neu-border bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <HandCoins className="h-5 w-5" /> Membership dues
        </h2>
        <button
          type="button"
          onClick={handleIssue}
          className="neu-border bg-lime px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-peach"
        >
          Issue invoices for this period
        </button>
      </div>

      {summary && (
        <dl className="mb-5 grid grid-cols-2 gap-3 font-mono text-xs lg:grid-cols-4">
          <Stat
            label="Collected"
            value={formatCents(summary.collectedCents)}
            icon={<Receipt className="h-3.5 w-3.5" />}
          />
          <Stat label="Outstanding" value={formatCents(summary.outstandingCents)} />
          <Stat
            label="Collection rate"
            value={`${Math.round(summary.collectionRate * 100)}%`}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <Stat
            label="Behind"
            value={`${summary.delinquentCount + summary.suspendedCount}`}
            tone={summary.delinquentCount + summary.suspendedCount > 0 ? "warn" : "plain"}
          />
        </dl>
      )}

      {roster.length === 0 ? (
        <p className="font-mono text-sm text-gray-500">
          No invoices have been issued for the current billing period yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-mono text-xs">
            <thead>
              <tr className="border-b-2 border-black uppercase text-gray-600">
                <th className="py-2">Member</th>
                <th className="py-2">Standing</th>
                <th className="py-2 text-right">Due</th>
                <th className="py-2 text-right">Outstanding</th>
                <th className="py-2 text-right">Next reminder</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((entry) => {
                const described = describeStanding(plan, entry.invoice, asOf ?? todayIso());
                const busy = busyInvoiceId === entry.invoice.id;

                return (
                  <tr key={entry.invoice.id} className="border-b border-gray-200">
                    <td className="py-2 text-sm font-bold">{entry.memberName}</td>
                    <td className="py-2">
                      <span
                        className={`neu-border inline-block px-2 py-1 text-[11px] font-bold uppercase ${
                          STANDING_STYLES[entry.standing]
                        }`}
                      >
                        {described.label}
                      </span>
                    </td>
                    <td className="py-2 text-right">{formatCents(entry.invoice.amountDueCents)}</td>
                    <td className="py-2 text-right font-bold">
                      {entry.outstandingCents > 0 ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleMarkPaid(entry)}
                          title="Record full payment"
                          className="neu-border bg-white px-2 py-1 hover:bg-lime disabled:opacity-40"
                        >
                          {formatCents(entry.outstandingCents)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {entry.dueStep ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleSendReminder(entry)}
                          className="neu-border inline-flex items-center gap-1 bg-peach px-2 py-1 text-[11px] font-bold uppercase disabled:opacity-40"
                        >
                          <BellRing className="h-3 w-3" /> {entry.dueStep.key}
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "plain",
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "plain" | "warn";
}) {
  return (
    <div className={`neu-border p-3 ${tone === "warn" ? "bg-peach/40" : "bg-white"}`}>
      <dt className="flex items-center gap-1 uppercase text-gray-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-base font-bold">{value}</dd>
    </div>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default DuesRosterPanel;
