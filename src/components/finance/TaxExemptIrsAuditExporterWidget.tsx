import React, { useState } from "react";
import {
  ShieldAlert,
  FileCheck,
  Download,
  Mail,
  CheckCircle2,
  Lock,
  FileText,
  FileSpreadsheet,
  Image,
  Clock,
  Sparkles,
  Archive,
} from "lucide-react";
import {
  AuditExportRequest,
  AuditExportResult,
  compileIrsAuditTrailPackage,
} from "@/lib/taxExemptIrsAuditExporter";
import { cn } from "@/lib/utils";

export interface TaxExemptIrsAuditExporterWidgetProps {
  clubId?: string;
  clubName?: string;
  requesterId?: string;
  requesterEmail?: string;
  onExportCompleted?: (result: AuditExportResult) => void;
  className?: string;
}

export const TaxExemptIrsAuditExporterWidget: React.FC<TaxExemptIrsAuditExporterWidgetProps> = ({
  clubId = "club-cs-1",
  clubName = "Computer Science Society",
  requesterId = "u-treasurer-101",
  requesterEmail = "treasurer@cs-society.edu",
  onExportCompleted,
  className,
}) => {
  const [fiscalYear, setFiscalYear] = useState<number>(2025);
  const [exportResult, setExportResult] = useState<AuditExportResult | null>(null);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCompileAuditPackage = () => {
    setIsCompiling(true);
    const request: AuditExportRequest = {
      clubId,
      clubName,
      fiscalYear,
      requesterId,
      requesterEmail,
    };

    setTimeout(() => {
      const result = compileIrsAuditTrailPackage(request);
      setExportResult(result);
      setIsCompiling(false);

      if (onExportCompleted) onExportCompleted(result);

      setNotice(
        `IRS Audit Package compiled successfully! Expiring download link sent to ${requesterEmail}.`
      );
      setTimeout(() => setNotice(null), 6000);
    }, 1500);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-amber-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-amber-950">
            <ShieldAlert className="w-5 h-5 text-amber-600 animate-bounce" />
            <span>Automated "Tax-Exempt" IRS Audit Trail Exporter — {clubName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            1-click "Audit Mode" data compilation engine. Compiles ledger CSVs, Form 990-EZ PDFs, and OCR receipt scans into encrypted ZIP packages.
          </p>
        </div>

        <span className="px-3 py-1 bg-black text-white font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
          <Lock className="w-3.5 h-3.5 text-amber-300" />
          <span>Legal Discovery Mode</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Controls & Asset Checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: Fiscal Year Selector & Audit Trigger Form */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Archive className="w-4 h-4 text-indigo-600" />
            IRS Audit Export Configuration
          </h4>

          <div className="space-y-2">
            <label htmlFor="fy-select" className="text-xs font-bold uppercase block text-gray-700">
              Select Audit Fiscal Year *
            </label>
            <select
              id="fy-select"
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full px-3 py-2 border-2 border-black rounded-md text-xs font-mono font-bold bg-white"
            >
              <option value={2025}>FY 2025 (Jan 1, 2025 – Dec 31, 2025)</option>
              <option value={2024}>FY 2024 (Jan 1, 2024 – Dec 31, 2024)</option>
              <option value={2023}>FY 2023 (Jan 1, 2023 – Dec 31, 2023)</option>
            </select>
          </div>

          {/* Included Asset Checklist */}
          <div className="p-3.5 border-2 border-black rounded-lg bg-slate-50 space-y-2 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Included Audit Discovery Assets:</span>
            <div className="space-y-1.5 text-[11px] text-gray-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold">Ledger Transactions CSV</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold">IRS Form 990-EZ Tax Return PDF</span>
              </div>
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold">OCR Expense Receipt Scans (24 Files)</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={isCompiling}
            onClick={handleCompileAuditPackage}
            className="w-full py-3 px-4 border-2 border-black bg-amber-500 text-black font-bold text-xs uppercase rounded-md hover:bg-amber-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isCompiling ? "Compiling Encrypted ZIP Archive..." : "Compile & Export IRS Audit Package"}
          </button>
        </div>

        {/* Right Column: Compiled Audit Archive Card */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            Compiled Legal Discovery Package
          </h4>

          {exportResult ? (
            <div className="p-4 border-2 border-black rounded-lg bg-white space-y-3 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-gray-500 border-b border-gray-200 pb-2">
                <span className="font-bold uppercase text-amber-900 flex items-center gap-1">
                  <Archive className="w-3.5 h-3.5" /> {exportResult.exportZipFilename}
                </span>
                <span className="text-emerald-600 font-bold">READY (18.5 MB)</span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-700">
                <p>Status: <span className="font-bold text-emerald-700">Compiled & Encrypted</span></p>
                <p>Recipient: <span className="font-bold text-black">{requesterEmail}</span></p>
                <p className="flex items-center gap-1 text-rose-700 font-bold">
                  <Clock className="w-3.5 h-3.5" /> Link Expires in 7 Days
                </p>
              </div>

              <a
                href={exportResult.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 px-3 border-2 border-black bg-black text-white font-bold text-xs uppercase rounded hover:bg-gray-800 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                Download IRS Audit Package ZIP
              </a>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-gray-500 bg-white border-2 border-black border-dashed rounded-lg">
              No audit export compiled yet. Select a fiscal year and click "Compile & Export IRS Audit Package" above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
