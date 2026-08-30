import React, { useEffect, useState } from "react";
import {
  Coins,
  ShieldCheck,
  Building2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Key,
  ExternalLink,
  Lock,
  Layers,
  Award,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { equitySwapService } from "@/services/equitySwap/equitySwapService";
import { EquitySwapAgreement, SponsorPppOffer } from "@/types/equitySwap";
import { Link } from "react-router-dom";

export function EquitySwapDashboard() {
  const [offers, setOffers] = useState<SponsorPppOffer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<SponsorPppOffer | null>(null);
  const [activeAgreement, setActiveAgreement] = useState<EquitySwapAgreement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [startupName, setStartupName] = useState("Vanguard AI Labs");
  const [founderName, setFounderName] = useState("Sophia Lin");

  useEffect(() => {
    const availableOffers = equitySwapService.getOffers();
    setOffers(availableOffers);
    if (availableOffers.length > 0) {
      setSelectedOffer(availableOffers[0]);
    }
  }, []);

  const handleAcceptOffer = async () => {
    if (!selectedOffer) return;
    setIsProcessing(true);

    try {
      const agreement = await equitySwapService.acceptOfferAndGenerateAgreement(
        selectedOffer.id,
        "st_vanguard_99",
        startupName,
        "founder_sophia",
        founderName,
      );
      setActiveAgreement(agreement);
    } catch (e) {
      console.error("Failed to generate agreement:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignFounder = async () => {
    if (!activeAgreement) return;
    setIsProcessing(true);

    try {
      const signed = await equitySwapService.signAgreement(
        activeAgreement.id,
        "founder_sophia",
        founderName,
        "founder",
      );
      setActiveAgreement(signed);
    } catch (e) {
      console.error("Founder signing error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignSponsor = async () => {
    if (!activeAgreement) return;
    setIsProcessing(true);

    try {
      const finalized = await equitySwapService.signAgreement(
        activeAgreement.id,
        activeAgreement.sponsorId,
        `${activeAgreement.sponsorName} Partner Rep`,
        "sponsor",
      );
      setActiveAgreement(finalized);
    } catch (e) {
      console.error("Sponsor signing error:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <Link
              to="/dashboard"
              className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Coins className="w-8 h-8 text-amber-400" />
              Sponsor Logo PPP Adjuster & Equity Swaps
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              B2B Enterprise Software License Financing via Purchasing Power Parity (PPP) & SAFE
              Equity Instruments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-amber-950/80 text-amber-400 border border-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> POLYGON BLOCKCHAIN ANCHORED
            </span>
          </div>
        </div>

        {/* Main Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: B2B Sponsor PPP Offer Selector */}
          <div className="lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400" /> Available B2B PPP Software Offers
            </h3>

            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedOffer?.id === offer.id
                      ? "bg-amber-950/40 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">{offer.sponsorName}</span>
                    <span className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-0.5 rounded font-mono text-slate-300">
                      {(offer.pppAdjustmentFactor * 100).toFixed(0)}% PPP Tier
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-1">{offer.softwareLicenseName}</h4>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-900">
                    <div>
                      <span className="text-slate-500 text-[10px]">PPP Adjusted Value</span>
                      <p className="font-bold text-emerald-400">
                        ${offer.adjustedUsdValue.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px]">Equity Trade-Off</span>
                      <p className="font-bold text-amber-300">
                        {offer.equityPercentage}% {offer.equityInstrument}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Founder Startup Input Config */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Startup Founder Identity
              </span>
              <div className="space-y-2">
                <input
                  type="text"
                  value={startupName}
                  onChange={(e) => setStartupName(e.target.value)}
                  placeholder="Startup Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  value={founderName}
                  onChange={(e) => setFounderName(e.target.value)}
                  placeholder="Founder Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleAcceptOffer}
                disabled={isProcessing || !selectedOffer}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" /> Accept PPP Terms & Draft SAFE
              </button>
            </div>
          </div>

          {/* Right Column: SAFE Agreement Preview & Dual Signature Workflow */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agreement Workspace */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" /> SAFE Equity Swap Agreement
                  Document
                </h3>
                <span className="text-xs font-mono bg-slate-950 border border-slate-800 text-amber-400 px-2.5 py-1 rounded font-bold">
                  Status: {activeAgreement ? activeAgreement.status : "DRAFT_SELECTION"}
                </span>
              </div>

              {/* Agreement Text Preview Box */}
              <div className="h-64 bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                {activeAgreement ? (
                  activeAgreement.agreementText
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center space-y-2 font-sans">
                    <FileText className="w-8 h-8 text-slate-700" />
                    <p>
                      Select a sponsor B2B software offer on the left and click "Accept PPP Terms &
                      Draft SAFE" to generate the structured legal agreement.
                    </p>
                  </div>
                )}
              </div>

              {/* SHA-256 Immutability Hash */}
              {activeAgreement && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Document SHA-256 Hash:</span>
                    <span className="text-amber-400 font-bold truncate max-w-[280px]">
                      {activeAgreement.documentSha256Hash}
                    </span>
                  </div>
                </div>
              )}

              {/* Dual Signature Controls */}
              {activeAgreement && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleSignFounder}
                    disabled={isProcessing || !!activeAgreement.founderSignature}
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      activeAgreement.founderSignature
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 cursor-default"
                        : "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400"
                    }`}
                  >
                    {activeAgreement.founderSignature ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Founder Signed (
                        {activeAgreement.founderName})
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" /> Sign as Founder ({founderName})
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSignSponsor}
                    disabled={
                      isProcessing ||
                      !activeAgreement.founderSignature ||
                      !!activeAgreement.sponsorSignature
                    }
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                      activeAgreement.sponsorSignature
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-300 cursor-default"
                        : activeAgreement.founderSignature
                          ? "bg-purple-600 hover:bg-purple-500 text-white border-purple-400"
                          : "bg-slate-950 border-slate-800 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    {activeAgreement.sponsorSignature ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sponsor Signed (
                        {activeAgreement.sponsorName})
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" /> Sign as Sponsor Partner
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Polygon Blockchain Anchor & Software Key Entitlement Card */}
            {activeAgreement?.status === "ACTIVE" && (
              <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-xl p-5 space-y-4 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
                <div className="flex items-center justify-between border-b border-emerald-900/60 pb-3">
                  <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Equity Swap Complete &
                    Software License Active
                  </h3>
                  <span className="text-[10px] font-mono bg-emerald-900/60 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded font-bold">
                    POLYGON ANCHORED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Blockchain Proof */}
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Polygon Ledger Proof
                    </span>
                    <p className="font-mono text-purple-300 text-[11px] truncate">
                      Tx: {activeAgreement.blockchainAnchor?.transactionHash}
                    </p>
                    <a
                      href={`https://polygonscan.com/tx/${activeAgreement.blockchainAnchor?.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-[10px] text-cyan-400 hover:underline mt-1"
                    >
                      View on PolygonScan <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>

                  {/* Provisioned B2B Software Key */}
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                    <span className="text-slate-500 font-semibold uppercase text-[10px] flex items-center gap-1">
                      <Key className="w-3.5 h-3.5 text-amber-400" /> Provisioned Enterprise License
                      Key
                    </span>
                    <p className="font-mono text-amber-300 font-bold text-sm">
                      {activeAgreement.licenseEntitlement?.licenseKey}
                    </p>
                    <span className="text-[10px] text-slate-400 block">
                      Seats: {activeAgreement.licenseEntitlement?.seatsCount} | Tier:{" "}
                      {activeAgreement.licenseEntitlement?.supportTier}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EquitySwapDashboard;
