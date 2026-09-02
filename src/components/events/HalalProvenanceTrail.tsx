import React, { useMemo } from "react";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GENESIS_HASH, HalalProvenanceEngine } from "@/lib/halalProvenance";
import { CertificationBoard, ProcessingFacility, ProvenanceRecord } from "@/types/halalProvenance";

/**
 * Attendee-facing trail (#5284).
 *
 * Rendered after scanning the QR code on the food table. Each lot is shown as a
 * chain of hops from the plate back to the certification board, with the digest
 * behind every hop, and the whole chain is replayed in the browser: if a record
 * was edited after anchoring, the replay fails and the attendee is told so
 * rather than being shown a clean-looking trail.
 */

export interface HalalProvenanceTrailProps {
  eventName: string;
  records: ProvenanceRecord[];
  boards: CertificationBoard[];
  facilities: ProcessingFacility[];
  /** Chain head encoded in the scanned QR code, if present. */
  expectedHead?: string;
}

export const HalalProvenanceTrail: React.FC<HalalProvenanceTrailProps> = ({
  eventName,
  records,
  boards,
  facilities,
  expectedHead,
}) => {
  const anchored = useMemo(
    () => records.filter((record) => record.status === "ANCHORED"),
    [records],
  );
  const integrity = useMemo(() => HalalProvenanceEngine.verifyChain(anchored), [anchored]);
  const actualHead = anchored.length ? anchored[anchored.length - 1].entryHash : GENESIS_HASH;

  // A head mismatch means the ledger served here is not the one the printed code
  // committed to — surfaced separately from a broken chain, because the cause is
  // different: substitution rather than edited contents.
  const headMatches = !expectedHead || expectedHead === actualHead;
  const trustworthy = integrity.intact && headMatches;

  return (
    <div className="max-w-3xl mx-auto p-6 font-sans space-y-6" data-testid="halal-provenance-trail">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">What you are eating</h1>
        <p className="text-slate-400 mt-2 font-mono text-sm">{eventName}</p>
      </div>

      <div
        role="status"
        className={`rounded-xl border p-4 flex items-start gap-3 ${
          trustworthy
            ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
            : "border-red-800 bg-red-950/40 text-red-300"
        }`}
      >
        {trustworthy ? (
          <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />
        ) : (
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
        )}
        <div className="text-sm">
          {trustworthy && (
            <p>
              {anchored.length} lot{anchored.length === 1 ? "" : "s"} verified against the immutable
              ledger.
            </p>
          )}
          {!headMatches && (
            <p>
              This ledger does not match the code on the table. Expected head {expectedHead}, found{" "}
              {actualHead}.
            </p>
          )}
          {!integrity.intact && <p>{integrity.reason}</p>}
        </div>
      </div>

      {anchored.length === 0 && (
        <p className="text-sm text-slate-500">
          No lots have been anchored for this event yet. Ask the organizer before eating if you rely
          on a religious certification.
        </p>
      )}

      {anchored.map((record) => {
        const board = boards.find((candidate) => candidate.id === record.boardId);
        const facility = facilities.find((candidate) => candidate.id === record.facilityId);
        const trail = HalalProvenanceEngine.buildTrail(record, facility, board);

        return (
          <Card key={record.entryHash} className="bg-slate-900 border-slate-800">
            <CardHeader className="border-b border-slate-800 pb-5">
              <CardTitle className="text-white text-lg font-mono">{record.lotNumber}</CardTitle>
              <CardDescription className="text-slate-400">
                {record.standard} · certified by {board ? board.name : "an unaccredited board"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <ol className="space-y-1">
                {trail.map((step, index) => (
                  <li key={step.label}>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        {step.label}
                      </p>
                      <p className="mt-1 text-sm text-slate-100">{step.detail}</p>
                      <p className="mt-2 font-mono text-[11px] text-slate-500 break-all">
                        {step.proof}
                      </p>
                    </div>
                    {index < trail.length - 1 && (
                      <div className="flex justify-center py-1" aria-hidden="true">
                        <ChevronDown className="h-4 w-4 text-slate-700" />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default HalalProvenanceTrail;
