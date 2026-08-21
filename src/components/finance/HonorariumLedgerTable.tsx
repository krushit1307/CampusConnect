import { AlertCircle, CheckCircle2, Ban } from "lucide-react";
import { describeBlockReason, formatCents } from "@/lib/honorariumCompliance";
import type { LedgerRow } from "@/services/honorariumService";

interface HonorariumLedgerTableProps {
  rows: LedgerRow[];
  busyPaymentId: string | null;
  onRelease: (row: LedgerRow) => void;
  onCancel: (row: LedgerRow) => void;
}

const RESIDENCY_LABELS: Record<string, string> = {
  domestic: "Domestic",
  foreign_treaty: "Foreign (treaty)",
  foreign_non_treaty: "Foreign",
};

/**
 * The ledger a treasurer works from: one row per honorarium, showing what the
 * speaker was promised, what has to be withheld, what they will actually
 * receive, and the specific reason a payment cannot be released yet.
 */
export function HonorariumLedgerTable({
  rows,
  busyPaymentId,
  onRelease,
  onCancel,
}: HonorariumLedgerTableProps) {
  if (rows.length === 0) {
    return (
      <p className="font-mono text-sm text-gray-500">
        No honorariums have been recorded for this tax year.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left font-mono text-xs">
        <thead>
          <tr className="border-b-2 border-black uppercase text-gray-600">
            <th className="py-2">Speaker</th>
            <th className="py-2">Engagement</th>
            <th className="py-2 text-right">Gross</th>
            <th className="py-2 text-right">Withheld</th>
            <th className="py-2 text-right">Net</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ payment, payee, evaluation, eventTitle }) => {
            const busy = busyPaymentId === payment.id;
            return (
              <tr key={payment.id} className="border-b border-gray-200 align-top">
                <td className="py-3">
                  <span className="block text-sm font-bold">{payee.fullName}</span>
                  <span className="text-[11px] uppercase text-gray-500">
                    {RESIDENCY_LABELS[payee.residency] ?? payee.residency}
                  </span>
                </td>
                <td className="py-3">
                  <span className="block">{payment.engagementDate}</span>
                  {eventTitle && <span className="text-gray-500">{eventTitle}</span>}
                </td>
                <td className="py-3 text-right">{formatCents(evaluation.grossCents)}</td>
                <td className="py-3 text-right">
                  {evaluation.withholdingCents > 0 ? (
                    <>
                      <span className="block">{formatCents(evaluation.withholdingCents)}</span>
                      <span className="text-[11px] text-gray-500">
                        {evaluation.withholdingRatePercent}%
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 text-right font-bold">{formatCents(evaluation.netCents)}</td>
                <td className="py-3">
                  <StatusBadge row={{ payment, payee, evaluation, eventTitle }} />
                  <span className="mt-1 block max-w-[220px] text-[11px] text-gray-500">
                    {evaluation.explanation}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={busy || !evaluation.releasable || payment.status === "paid"}
                      onClick={() => onRelease({ payment, payee, evaluation, eventTitle })}
                      className="neu-border bg-lime px-2 py-1 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      disabled={busy || payment.status !== "draft"}
                      onClick={() => onCancel({ payment, payee, evaluation, eventTitle })}
                      className="neu-border bg-white px-2 py-1 text-[11px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ row }: { row: LedgerRow }) {
  if (row.payment.status === "paid") {
    return (
      <span className="neu-border inline-flex items-center gap-1 bg-lime px-2 py-1 text-[11px] font-bold uppercase">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    );
  }

  if (row.payment.status === "cancelled") {
    return (
      <span className="neu-border inline-flex items-center gap-1 bg-gray-200 px-2 py-1 text-[11px] font-bold uppercase">
        <Ban className="h-3 w-3" /> Cancelled
      </span>
    );
  }

  if (!row.evaluation.releasable) {
    return (
      <span className="neu-border inline-flex items-center gap-1 bg-peach px-2 py-1 text-[11px] font-bold uppercase">
        <AlertCircle className="h-3 w-3" /> {describeBlockReason(row.evaluation.blockReason)}
      </span>
    );
  }

  return (
    <span className="neu-border inline-flex items-center gap-1 bg-white px-2 py-1 text-[11px] font-bold uppercase">
      <CheckCircle2 className="h-3 w-3" /> Ready
    </span>
  );
}

export default HonorariumLedgerTable;
