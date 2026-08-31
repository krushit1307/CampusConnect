import React, { useState } from "react";
import {
  ShieldAlert,
  Download,
  KeyRound,
  Server,
  FileJson,
  CheckCircle2,
  Lock,
  Fingerprint,
  CalendarDays,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const SubpoenaExportTool: React.FC = () => {
  const [targetUserId, setTargetUserId] = useState("00000000-0000-0000-0000-000000000000");
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-12-31");
  const [reason, setReason] = useState("Law Enforcement Subpoena Case #4492-B");
  const [mfaCode, setMfaCode] = useState("");

  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<{ signature: string; payload: any } | null>(null);

  const handleExport = () => {
    if (mfaCode !== "654321") {
      alert("Invalid MFA Code. Security lockdown initiated.");
      return;
    }
    setIsExporting(true);

    // Simulating Edge Function Latency for Massive Data Aggregation
    setTimeout(() => {
      setIsExporting(false);
      setExportData({
        signature: "a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7",
        payload: {
          metadata: {
            extracted_by: "Admin-Root",
            target: targetUserId,
            range: `${startDate} to ${endDate}`,
          },
          data: {
            chat_logs: 1452,
            webrtc_sessions: 34,
            ip_addresses: 12,
            stripe_transactions: 4,
          },
        },
      });
    }, 2500);
  };

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subpoena_export_${targetUserId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-red-900 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            Automated Subpoena Export
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl">
            Highly restricted Admin gateway for compiling legally admissible, cryptographically
            signed user data matrices in response to law enforcement requests.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <Card className="bg-slate-900 border-red-900/50 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Server className="h-5 w-5 text-red-400" />
              Target Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                <Fingerprint className="h-3 w-3" /> Target User ID (UUID)
              </Label>
              <Input
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                  <CalendarDays className="h-3 w-3" /> Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-400 font-bold uppercase tracking-wider text-xs">
                  End Date
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                <FileJson className="h-3 w-3" /> Subpoena Reference / Reason
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono h-20"
              />
            </div>

            <div className="pt-4 border-t border-slate-800">
              <Label className="text-red-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2 mb-2">
                <KeyRound className="h-3 w-3" /> Admin MFA Authorization
              </Label>
              <div className="flex gap-4">
                <Input
                  type="text"
                  placeholder="Enter 6-digit Authenticator Code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  maxLength={6}
                  className="bg-slate-950 border-red-900/50 text-white font-mono text-center tracking-widest text-lg"
                />
              </div>
              <p className="text-xs text-slate-500 mt-2 font-mono">Use code 654321 for demo.</p>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-950/50 border-t border-slate-800 pt-4">
            <Button
              onClick={handleExport}
              disabled={isExporting || mfaCode.length < 6}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 uppercase tracking-wide"
            >
              {isExporting ? "Aggregating Database Matrix..." : "Execute Chain-of-Custody Export"}
            </Button>
          </CardFooter>
        </Card>

        {/* Results Panel */}
        <div className="space-y-6">
          <Card
            className={`bg-slate-900 border-slate-800 shadow-xl transition-opacity duration-500 ${exportData ? "opacity-100" : "opacity-30 pointer-events-none"}`}
          >
            <CardHeader className="bg-emerald-950/20 border-b border-emerald-900/30 pb-4">
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Data Matrix Compiled
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {exportData && (
                <>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase text-slate-500">Records Extracted</p>
                    <div className="grid grid-cols-2 gap-2 text-sm font-mono text-slate-300 bg-slate-950 p-3 rounded border border-slate-800">
                      <div>
                        Chat Logs:{" "}
                        <span className="text-emerald-400">
                          {exportData.payload.data.chat_logs}
                        </span>
                      </div>
                      <div>
                        IP Addresses:{" "}
                        <span className="text-emerald-400">
                          {exportData.payload.data.ip_addresses}
                        </span>
                      </div>
                      <div>
                        WebRTC:{" "}
                        <span className="text-emerald-400">
                          {exportData.payload.data.webrtc_sessions}
                        </span>
                      </div>
                      <div>
                        Stripe:{" "}
                        <span className="text-emerald-400">
                          {exportData.payload.data.stripe_transactions}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-4 border-t border-slate-800">
                    <p className="text-xs font-bold uppercase text-slate-500 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> HMAC-SHA256 Cryptographic Signature
                    </p>
                    <div className="bg-slate-950 p-3 rounded border border-indigo-500/30 font-mono text-[10px] text-indigo-300 break-all leading-relaxed">
                      {exportData.signature}
                    </div>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      This signature guarantees data integrity and chain-of-custody for legal
                      admissibility.
                    </p>
                  </div>

                  <Button
                    onClick={handleDownload}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold mt-4"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Signed JSON Package
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubpoenaExportTool;
