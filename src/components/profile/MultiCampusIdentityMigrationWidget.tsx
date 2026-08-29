import React, { useState } from "react";
import {
  ShieldCheck,
  Key,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  Award,
  Calendar,
  Sparkles,
  Lock,
  UserCheck,
  RefreshCw,
  Landmark,
} from "lucide-react";
import {
  IdentityMigrationPayload,
  MigrationResult,
  generateIdentityMigrationToken,
  verifyIdentityMigrationToken,
  executeCrossCampusMigration,
} from "@/lib/multiCampusIdentity";
import { cn } from "@/lib/utils";

export interface MultiCampusIdentityMigrationWidgetProps {
  currentCampusId?: string;
  currentUserId?: string;
  userHandle?: string;
  initialPoints?: number;
  initialRsvpsCount?: number;
  onMigrationSuccess?: (result: MigrationResult) => void;
  className?: string;
}

export const MultiCampusIdentityMigrationWidget: React.FC<MultiCampusIdentityMigrationWidgetProps> = ({
  currentCampusId = "uni-a-stanford",
  currentUserId = "u-stanford-101",
  userHandle = "alice_v",
  initialPoints = 50000,
  initialRsvpsCount = 42,
  onMigrationSuccess,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<"issue" | "import">("issue");
  const [tokenInput, setTokenInput] = useState<string>("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [previewPayload, setPreviewPayload] = useState<IdentityMigrationPayload | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleCertificates = [
    { id: "cert-101", title: "Leadership Excellence 2025", issuerCampus: "Stanford", issuedAt: "2025-05-15" },
    { id: "cert-102", title: "Hackathon Champion 2025", issuerCampus: "Stanford", issuedAt: "2025-11-20" },
  ];

  const handleGenerateToken = () => {
    const token = generateIdentityMigrationToken({
      sourceCampusId: currentCampusId,
      sourceUserId: currentUserId,
      userHandle,
      gamificationPoints: initialPoints,
      eventRsvpsCount: initialRsvpsCount,
      certificates: sampleCertificates,
    });
    setGeneratedToken(token);
    setErrorMsg(null);
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleVerifyToken = () => {
    try {
      setErrorMsg(null);
      const decoded = verifyIdentityMigrationToken(tokenInput);
      setPreviewPayload(decoded);
    } catch (err) {
      setPreviewPayload(null);
      setErrorMsg((err as Error).message);
    }
  };

  const handleExecuteMigration = () => {
    try {
      setErrorMsg(null);
      const res = executeCrossCampusMigration(tokenInput, "u-berkeley-202", "uni-b-berkeley");
      setMigrationResult(res);
      if (onMigrationSuccess) onMigrationSuccess(res);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-cyan-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-cyan-950">
            <Landmark className="w-5 h-5 text-cyan-700" />
            <span>Multi-Campus Identity Resolution & Transfer Portal</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Transfer points, event history, and verified certificates across university instances using signed cryptographic JWT tokens.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-md border-2 border-black">
          <button
            type="button"
            onClick={() => setActiveTab("issue")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold uppercase rounded transition-colors",
              activeTab === "issue" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
            )}
          >
            1. Issue Token (Uni A)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={cn(
              "px-3 py-1.5 text-xs font-bold uppercase rounded transition-colors",
              activeTab === "import" ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
            )}
          >
            2. Import & Merge (Uni B)
          </button>
        </div>
      </div>

      {/* Migration Success Confirmation Banner */}
      {migrationResult && (
        <div className="p-4 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 space-y-1">
          <div className="flex items-center gap-2 text-sm font-black uppercase">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Identity Migration Completed & Verified</span>
          </div>
          <p className="font-sans font-medium">{migrationResult.message}</p>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-100 border-b-2 border-black text-xs font-bold text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab 1: Issue Migration Token (University A) */}
      {activeTab === "issue" && (
        <div className="p-5 space-y-4 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3.5 border-2 border-black rounded-lg bg-amber-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold uppercase text-amber-900 block">Gamification Points</span>
              <span className="text-xl font-black text-amber-700">{initialPoints.toLocaleString()} PTS</span>
              <span className="text-[11px] font-sans text-amber-900 block">Ready to transfer</span>
            </div>

            <div className="p-3.5 border-2 border-black rounded-lg bg-indigo-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold uppercase text-indigo-900 block">Event History</span>
              <span className="text-xl font-black text-indigo-700">{initialRsvpsCount} RSVPs</span>
              <span className="text-[11px] font-sans text-indigo-900 block">Event participation record</span>
            </div>

            <div className="p-3.5 border-2 border-black rounded-lg bg-emerald-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold uppercase text-emerald-900 block">Verified Certificates</span>
              <span className="text-xl font-black text-emerald-700">{sampleCertificates.length} Certificates</span>
              <span className="text-[11px] font-sans text-emerald-900 block">Cryptographic achievements</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerateToken}
              className="w-full py-3 px-4 border-2 border-black bg-cyan-600 text-white font-bold text-xs uppercase rounded-md hover:bg-cyan-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <Key className="w-4 h-4 text-amber-300" />
              Generate Signed Cryptographic JWT Migration Token
            </button>
          </div>

          {generatedToken && (
            <div className="p-4 border-2 border-black rounded-lg bg-slate-900 text-white space-y-3 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[11px] border-b border-slate-700 pb-2">
                <span className="font-bold text-cyan-400 uppercase flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Signed Migration Token
                </span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-sky-300 font-bold flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied Token!" : "Copy Token"}
                </button>
              </div>

              <textarea
                readOnly
                rows={3}
                value={generatedToken}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-gray-300 select-all"
              />

              <p className="text-[11px] font-sans text-gray-400">
                Copy this token string and paste it into your new account portal on University B.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Import & Merge Token (University B) */}
      {activeTab === "import" && (
        <div className="p-5 space-y-4 bg-white">
          <div className="space-y-2">
            <label htmlFor="token-import-input" className="text-xs font-bold uppercase block text-gray-800">
              Paste Signed Migration Token String *
            </label>
            <textarea
              id="token-import-input"
              rows={3}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste JWT migration token from University A..."
              className="w-full p-3 border-2 border-black rounded-md text-xs font-mono bg-white"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleVerifyToken}
              className="px-4 py-2 border-2 border-black bg-slate-100 hover:bg-slate-200 text-gray-900 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-600" />
              Verify Token Cryptographic Signature
            </button>
          </div>

          {/* Token Payload Verification Preview */}
          {previewPayload && (
            <div className="p-4 border-2 border-black rounded-lg bg-slate-50 space-y-3 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center border-b border-slate-300 pb-2">
                <span className="font-bold uppercase text-indigo-900 flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-emerald-600" /> Token Payload Verified
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-400 rounded text-[10px] font-bold">
                  VALID SIGNATURE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Source Campus:</span>
                  <span className="font-bold text-gray-900">{previewPayload.sourceCampusId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">User Handle:</span>
                  <span className="font-bold text-gray-900">@{previewPayload.userHandle}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Gamification Points:</span>
                  <span className="font-bold text-amber-600">{previewPayload.gamificationPoints.toLocaleString()} PTS</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block">Certificates:</span>
                  <span className="font-bold text-emerald-600">{previewPayload.certificates.length} Verified</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleExecuteMigration}
                  className="w-full py-3 px-4 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 text-amber-300" />
                  Merge Identity & Disable Old Account
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
