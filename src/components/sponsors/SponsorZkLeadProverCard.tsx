// =============================================================================
// Component: SponsorZkLeadProverCard
// Issue: #5130 - Real-Time "Sponsor Lead" CRM Webhook Zero-Knowledge Proof
// Description: Student-facing ZK proof generator & proxy interview offer manager.
// Proves student satisfies sponsor criteria (GPA > 3.5, CS Major, 2026 Grad) without leaking PII.
// Handles explicit PII release consent upon interview offer acceptance.
// =============================================================================

import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Building2,
  Send,
  Award,
  FileText,
} from "lucide-react";
import { globalSponsorZkLeadService } from "@/services/sponsorZkLeadService";
import { SponsorZkProofEngine } from "@/lib/sponsorZkProof";
import {
  SponsorLeadCriteria,
  PrivateAcademicData,
  ZkVerifiedLeadProxy,
  ProxyInterviewOffer,
} from "@/types/sponsorZkLead";

export interface SponsorZkLeadProverCardProps {
  className?: string;
}

export const SponsorZkLeadProverCard: React.FC<SponsorZkLeadProverCardProps> = ({
  className = "",
}) => {
  // Mock Verified Academic Data Vault (Stays 100% on student client device)
  const [academicData] = useState<PrivateAcademicData>({
    studentId: "student-alex-2026",
    firstName: "Alex",
    lastName: "Johnson",
    email: "alex.johnson@university.edu",
    major: "Computer Science",
    gpa: 3.92, // Exact GPA
    graduationYear: 2026,
    verifiedAt: "2026-08-15T10:00:00Z",
    registrarSignature: "sig_registrar_verified_99812",
  });

  // Mock Sponsor Criteria
  const [criteria] = useState<SponsorLeadCriteria>(() => {
    return globalSponsorZkLeadService.createCriteria(
      "sponsor-techcorp",
      "Starlight Quantum TechCorp",
      "Computer Science",
      3.5, // GPA > 3.5
      2026, // Grad Year = 2026
    );
  });

  const [verifiedProxy, setVerifiedProxy] = useState<ZkVerifiedLeadProxy | null>(null);
  const [currentOffer, setCurrentOffer] = useState<ProxyInterviewOffer | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generate ZK Groth16 Proof & Submit to Sponsor CRM Webhook
  const handleGenerateProof = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      // 1. Client-side ZK proof generation
      const proofPayload = await SponsorZkProofEngine.generateLeadEligibilityProof(
        academicData,
        criteria,
      );

      // 2. Submit ZK proof payload to service
      const result = await globalSponsorZkLeadService.submitZkLeadProof(
        criteria.criteriaId,
        proofPayload,
        academicData,
      );

      if (!result.success || !result.leadProxy) {
        setErrorMsg(result.error || "Failed to submit ZK proof.");
      } else {
        setVerifiedProxy(result.leadProxy);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Proof generation error.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Sponsor sends proxy interview offer demo helper
  const handleSimulateSponsorOffer = () => {
    if (!verifiedProxy) return;

    const res = globalSponsorZkLeadService.sendProxyInterviewOffer(
      verifiedProxy.leadProxyId,
      "Quantum Software Systems Engineer Intern (Summer 2026)",
      "We verified your ZK proof! We'd love to invite you to an interview.",
    );

    if (res.success && res.offer) {
      setCurrentOffer(res.offer);
      setVerifiedProxy(
        globalSponsorZkLeadService.getVerifiedProxy(verifiedProxy.leadProxyId) || null,
      );
    }
  };

  // Student accepts interview offer & explicitly grants PII release consent
  const handleAcceptOffer = () => {
    if (!currentOffer) return;

    const res = globalSponsorZkLeadService.acceptProxyInterviewOffer(currentOffer.offerId);

    if (res.success && res.offer) {
      setCurrentOffer({ ...res.offer });
      if (verifiedProxy) {
        setVerifiedProxy(
          globalSponsorZkLeadService.getVerifiedProxy(verifiedProxy.leadProxyId) || null,
        );
      }
    }
  };

  // Student declines interview offer -> PII stays 100% locked
  const handleDeclineOffer = () => {
    if (!currentOffer) return;

    const res = globalSponsorZkLeadService.declineProxyInterviewOffer(currentOffer.offerId);

    if (res.success && res.offer) {
      setCurrentOffer({ ...res.offer });
      if (verifiedProxy) {
        setVerifiedProxy(
          globalSponsorZkLeadService.getVerifiedProxy(verifiedProxy.leadProxyId) || null,
        );
      }
    }
  };

  return (
    <div
      data-testid="zk-lead-prover-card"
      className={`rounded-3xl bg-slate-900 border border-indigo-500/30 p-6 shadow-2xl space-y-6 text-slate-100 relative overflow-hidden ${className}`}
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ZERO-KNOWLEDGE PROOF 🔒
              </span>
              <span className="text-xs text-slate-400 font-mono">snarkjs / Groth16 Prover</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-0.5">
              Sponsor Lead CRM ZK Verification
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>{criteria.sponsorName}</span>
        </div>
      </div>

      {/* Sponsor Criteria vs Student Private Data Vault */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sponsor Criteria Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Sponsor Eligibility Criteria</span>
            <span className="text-amber-400 font-mono">Public Inputs</span>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
            <li className="flex justify-between border-b border-slate-900 pb-1">
              <span>Required Major:</span>
              <strong className="text-indigo-300">{criteria.requiredMajor}</strong>
            </li>
            <li className="flex justify-between border-b border-slate-900 pb-1">
              <span>Minimum GPA:</span>
              <strong className="text-amber-400">&gt; {criteria.minGpa}</strong>
            </li>
            <li className="flex justify-between">
              <span>Graduation Year:</span>
              <strong className="text-emerald-400">{criteria.requiredGraduationYear}</strong>
            </li>
          </ul>
        </div>

        {/* Student Private Vault Box */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Verified Academic Data Vault</span>
            <span className="text-emerald-400 font-mono flex items-center gap-1">
              <Lock className="w-3 h-3" /> Private Witness
            </span>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
            <li className="flex justify-between border-b border-slate-900 pb-1">
              <span>Your Major:</span>
              <span className="text-slate-200">{academicData.major}</span>
            </li>
            <li className="flex justify-between border-b border-slate-900 pb-1">
              <span>Your Exact GPA:</span>
              <span className="text-slate-200">{academicData.gpa} (Verified)</span>
            </li>
            <li className="flex justify-between">
              <span>Your Grad Year:</span>
              <span className="text-slate-200">{academicData.graduationYear}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Privacy Guarantee Alert */}
      <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 flex items-center gap-2.5">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Zero-Knowledge Guarantee:</strong> Your Name, Email, Exact GPA ({academicData.gpa}
          ), and Transcript remain on your device. The sponsor receives only a ZK proof string
          confirming you meet their criteria.
        </span>
      </div>

      {/* Error display */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Proof Generation & Submission Button */}
      {!verifiedProxy ? (
        <button
          onClick={handleGenerateProof}
          disabled={isGenerating}
          data-testid="generate-zkp-btn"
          className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
        >
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
          <span>
            {isGenerating
              ? "Generating Groth16 ZK Proof..."
              : "Generate ZK Proof & Submit to Sponsor CRM"}
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          <div
            data-testid="zk-verified-badge"
            className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="font-bold text-xs sm:text-sm text-white">
                  ZK Proof Verified by Sponsor CRM!
                </h4>
                <p className="text-xs text-emerald-300 font-mono">
                  Proxy Lead ID: {verifiedProxy.leadProxyId}
                </p>
              </div>
            </div>

            <span className="text-xs font-mono font-bold bg-slate-950 px-2.5 py-1 rounded-xl border border-emerald-500/30 text-emerald-400">
              0 PII SHARED
            </span>
          </div>

          {/* Simulate Sponsor Interview Offer Button */}
          {!currentOffer && (
            <button
              onClick={handleSimulateSponsorOffer}
              className="text-xs font-mono text-indigo-300 hover:text-white underline transition flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Simulate Sponsor Sending Interview Offer via Proxy</span>
            </button>
          )}
        </div>
      )}

      {/* Proxy Interview Offer & Explicit PII Consent Flow */}
      {currentOffer && (
        <div
          data-testid="interview-offer-box"
          className="p-5 rounded-2xl bg-slate-950 border border-amber-500/40 space-y-4 shadow-xl relative"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm text-white">
                Interview Offer from {currentOffer.sponsorName}
              </h3>
            </div>
            <span
              data-testid="offer-status-badge"
              className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full uppercase ${
                currentOffer.status === "ACCEPTED"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : currentOffer.status === "DECLINED"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
              }`}
            >
              {currentOffer.status}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-indigo-200">{currentOffer.positionTitle}</div>
            <p className="text-xs text-slate-300 leading-relaxed italic">
              "{currentOffer.message}"
            </p>
          </div>

          {currentOffer.status === "PENDING" && (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>PII Release Warning:</strong> Accepting this offer will release your Name
                  (
                  <strong>
                    {academicData.firstName} {academicData.lastName}
                  </strong>
                  ) and Email (<strong>{academicData.email}</strong>) to {currentOffer.sponsorName}.
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAcceptOffer}
                  data-testid="accept-offer-btn"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/30 active:scale-95"
                >
                  Accept & Release Contact Info
                </button>

                <button
                  onClick={handleDeclineOffer}
                  data-testid="decline-offer-btn"
                  className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition border border-slate-700"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {currentOffer.status === "ACCEPTED" && currentOffer.studentPii && (
            <div
              data-testid="pii-released-confirmation"
              className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 space-y-1"
            >
              <div className="font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Offer Accepted — Contact Info Released:</span>
              </div>
              <div className="font-mono text-[11px] text-slate-300 pl-5">
                Name: {currentOffer.studentPii.firstName} {currentOffer.studentPii.lastName} |
                Email: {currentOffer.studentPii.email}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SponsorZkLeadProverCard;
