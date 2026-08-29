import React, { useState } from "react";
import {
  LeadershipBackgroundCheckRecord,
  ScreeningStatus,
} from "@/types/clubLeadershipBackgroundCheck";
import { clubLeadershipBackgroundCheckService } from "@/services/clubLeadershipBackgroundCheckService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Scale,
  DollarSign,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileCheck,
} from "lucide-react";

interface LeadershipBackgroundCheckWidgetProps {
  transitionId: string;
  onStatusChange?: (isCleared: boolean) => void;
}

const STATUS_BADGES: Record<
  ScreeningStatus,
  { label: string; bgClass: string }
> = {
  cleared: {
    label: "Cleared for Leadership ✓",
    bgClass: "bg-emerald-100 text-emerald-800 border-emerald-300 font-bold",
  },
  flagged_for_review: {
    label: "Flagged for Advisor Review ⚠️",
    bgClass: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
  },
  rejected: {
    label: "Background Screening Rejected ✕",
    bgClass: "bg-red-100 text-red-800 border-red-300 font-bold",
  },
  in_screening: {
    label: "Screening In Progress...",
    bgClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
  pending: {
    label: "Pending Verification",
    bgClass: "bg-gray-100 text-gray-800 border-gray-300",
  },
};

export const LeadershipBackgroundCheckWidget: React.FC<
  LeadershipBackgroundCheckWidgetProps
> = ({ transitionId, onStatusChange }) => {
  const [record, setRecord] = useState<LeadershipBackgroundCheckRecord | undefined>(
    clubLeadershipBackgroundCheckService.getCheckByTransitionId(transitionId),
  );
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideNotes, setOverrideNotes] = useState("");
  const [overrideDecision, setOverrideDecision] = useState<"cleared" | "rejected">(
    "cleared",
  );

  if (!record) return null;

  const statusBadge = STATUS_BADGES[record.status];
  const isCleared = record.status === "cleared";

  const handleExecuteOverride = () => {
    const updated = clubLeadershipBackgroundCheckService.manualAdvisorOverride(
      record.id,
      "SU Staff Advisor",
      overrideDecision,
      overrideNotes || "Advisor manual clearance override after background review.",
    );

    if (updated) {
      setRecord({ ...updated });
      setShowOverrideModal(false);
      setOverrideNotes("");
      if (onStatusChange) {
        onStatusChange(updated.status === "cleared");
      }
    }
  };

  const handleReRunScreening = () => {
    const updated = clubLeadershipBackgroundCheckService.runAutomatedScreening(
      record.id,
    );
    if (updated) {
      setRecord({ ...updated });
      if (onStatusChange) {
        onStatusChange(updated.status === "cleared");
      }
    }
  };

  return (
    <div className="neu-border bg-white p-4 font-mono text-xs text-black space-y-3 mt-3">
      {/* Widget Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-2">
        <div className="flex items-center gap-2">
          {isCleared ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          )}
          <span className="font-bold uppercase tracking-wider text-sm">
            Automated Leadership Background Screening
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={`neu-border text-xs px-2.5 py-1 ${statusBadge.bgClass}`}>
            {statusBadge.label}
          </Badge>
        </div>
      </div>

      {/* 4 Compliance Vectors Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Vector 1: Academic GPA */}
        <div
          className={`p-2 border border-black rounded ${
            record.vectors.academic.passed ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3.5 w-3.5 text-black" /> Academic
            </span>
            {record.vectors.academic.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-600" />
            )}
          </div>
          <div className="mt-1 text-[11px]">
            GPA: <span className="font-bold">{record.vectors.academic.gpa}</span> (Min {record.vectors.academic.minGpaRequired})
          </div>
        </div>

        {/* Vector 2: Judicial Conduct */}
        <div
          className={`p-2 border border-black rounded ${
            record.vectors.judicial.passed ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1">
              <Scale className="h-3.5 w-3.5 text-black" /> Judicial
            </span>
            {record.vectors.judicial.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-600" />
            )}
          </div>
          <div className="mt-1 text-[11px]">
            {record.vectors.judicial.passed ? "Zero Conduct Holds" : "Flagged Violation"}
          </div>
        </div>

        {/* Vector 3: Financial Clearance */}
        <div
          className={`p-2 border border-black rounded ${
            record.vectors.financial.passed ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-black" /> Financial
            </span>
            {record.vectors.financial.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-600" />
            )}
          </div>
          <div className="mt-1 text-[11px]">
            {record.vectors.financial.passed
              ? "No Outstanding Debt"
              : `$${record.vectors.financial.outstandingDebtCents / 100} Unpaid Dues`}
          </div>
        </div>

        {/* Vector 4: Safety & Title IX Training */}
        <div
          className={`p-2 border border-black rounded ${
            record.vectors.safetyTraining.passed ? "bg-emerald-50" : "bg-red-50"
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1">
              <Award className="h-3.5 w-3.5 text-black" /> Safety
            </span>
            {record.vectors.safetyTraining.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-red-600" />
            )}
          </div>
          <div className="mt-1 text-[11px]">
            {record.vectors.safetyTraining.passed
              ? "Title IX & Hazing Complete"
              : "Training Incomplete"}
          </div>
        </div>
      </div>

      {/* Risk Flags Banner if any */}
      {record.riskFlags.length > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-900 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Compliance Flags: {record.riskFlags.join(", ").replace(/_/g, " ")}</span>
          </div>

          <button
            onClick={() => setShowOverrideModal(true)}
            className="neu-border bg-amber-200 px-2 py-0.5 font-bold uppercase text-[10px] hover:bg-amber-300"
          >
            Advisor Override
          </button>
        </div>
      )}

      {/* Manual Advisor Override Info */}
      {record.advisorOverride && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-blue-900 text-[11px] space-y-0.5">
          <div className="font-bold flex items-center gap-1">
            <FileCheck className="h-3.5 w-3.5 text-blue-600" /> Manual Advisor Override by{" "}
            {record.advisorOverride.advisorName}
          </div>
          <p className="italic">"{record.advisorOverride.notes}"</p>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black p-5 max-w-md w-full shadow-[4px_4px_0_0_#000] text-black space-y-4 font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h4 className="font-bold text-sm uppercase">Advisor Screening Override</h4>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="font-bold text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-700">
              As a Student Union Staff Advisor, you may issue a manual compliance override for{" "}
              <strong>{record.candidateName}</strong> for the position of{" "}
              <strong>{record.roleTitle}</strong>.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase">Decision</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideDecision("cleared")}
                  className={`flex-1 py-2 border border-black font-bold text-xs ${
                    overrideDecision === "cleared"
                      ? "bg-emerald-300 text-black shadow-[2px_2px_0_0_#000]"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Clear Candidate ✓
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideDecision("rejected")}
                  className={`flex-1 py-2 border border-black font-bold text-xs ${
                    overrideDecision === "rejected"
                      ? "bg-red-400 text-black shadow-[2px_2px_0_0_#000]"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Reject Candidate ✕
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold uppercase">Advisor Notes / Rationale</label>
              <Textarea
                rows={3}
                placeholder="Reason for manual waiver or rejection..."
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                className="neu-border text-xs w-full bg-white text-black p-2 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowOverrideModal(false)}
                className="neu-border text-xs rounded-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecuteOverride}
                className="neu-border bg-black text-white text-xs font-bold rounded-none shadow-[2px_2px_0_0_#000]"
              >
                Confirm Override
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
