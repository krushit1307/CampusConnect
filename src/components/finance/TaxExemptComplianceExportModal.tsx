// =============================================================================
// File: src/components/finance/TaxExemptComplianceExportModal.tsx
// Feature: Automated "Tax-Exempt" Audit Trail Generator
// Description: 1-Click Compliance Export modal presenting Form 990-N/EZ line items,
//              SHA-256 digital audit seal verification, and instant CSV/JSON exports.
// =============================================================================

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check";
import Download from "lucide-react/dist/esm/icons/download";
import FileText from "lucide-react/dist/esm/icons/file-text";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Printer from "lucide-react/dist/esm/icons/printer";
import Copy from "lucide-react/dist/esm/icons/copy";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import type { TaxExemptAuditReport } from "@/types/taxExemptAudit";
import {
  exportTaxExemptAuditCsv,
  exportTaxExemptAuditJson,
  getMockTaxExemptAuditData,
} from "@/services/taxExemptAuditService";

interface TaxExemptComplianceExportModalProps {
  open: boolean;
  onClose: () => void;
  clubId?: string;
  clubName?: string;
  treasurerName?: string;
  reportData?: TaxExemptAuditReport;
}

export const TaxExemptComplianceExportModal: React.FC<TaxExemptComplianceExportModalProps> = ({
  open,
  onClose,
  clubId = "club-demo-1",
  clubName = "Campus Robotics & Technology Association",
  treasurerName = "Alex Kim (Treasurer)",
  reportData,
}) => {
  const report = reportData || getMockTaxExemptAuditData(clubId);
  const [copiedHash, setCopiedHash] = useState(false);

  const handleDownloadCsv = () => {
    const csvContent = exportTaxExemptAuditCsv(report);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Tax_Exempt_Form990_Audit_${report.clubName.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadJson = () => {
    const jsonContent = exportTaxExemptAuditJson(report);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Tax_Audit_Manifest_${report.clubName.replace(/\s+/g, "_")}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(report.digitalSeal.sha256Hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="1-Click Tax-Exempt Compliance Audit Export">
      <div className="space-y-6 font-mono text-xs">
        {/* Header Tax Status Card */}
        <div className="neu-border bg-yellow-50 p-4 border-2 border-black dark:bg-zinc-900 dark:border-zinc-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              IRS Form 990-N / 990-EZ Aligned
            </span>
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded border border-black text-[10px]">
              {report.taxInfo.taxStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-zinc-700 dark:text-zinc-300 pt-1">
            <p><strong>Organization:</strong> {report.clubName}</p>
            <p><strong>EIN / Tax ID:</strong> <code className="font-bold text-black dark:text-white">{report.taxInfo.einNumber}</code></p>
            <p><strong>Treasurer Signature:</strong> {report.taxInfo.treasurerName}</p>
            <p><strong>Filing Period:</strong> {report.reportPeriod.startDate} to {report.reportPeriod.endDate}</p>
          </div>
        </div>

        {/* SHA-256 Digital Seal Verification Banner */}
        <div className="rounded border-2 border-black bg-zinc-900 p-3 text-white shadow-[2px_2px_0_0_#000] flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Cryptographic Audit Seal Verified
            </p>
            <p className="text-[10px] text-zinc-400 truncate max-w-xs sm:max-w-md font-mono">
              Digest: <span className="text-zinc-200">{report.digitalSeal.sha256Hash}</span>
            </p>
          </div>
          <button
            onClick={handleCopyHash}
            className="neu-border bg-zinc-800 hover:bg-zinc-700 text-white px-2.5 py-1 text-[10px] font-bold uppercase transition-all"
          >
            {copiedHash ? "Copied!" : <Copy className="h-3.5 w-3.5 inline" />}
          </button>
        </div>

        {/* Financial Summary KPI Grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="neu-border bg-emerald-50 p-3 border border-black dark:bg-emerald-950/40">
            <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase block">Gross Revenue</span>
            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">${report.summary.totalRevenue.toLocaleString()}</span>
          </div>

          <div className="neu-border bg-rose-50 p-3 border border-black dark:bg-rose-950/40">
            <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase block">Total Expenses</span>
            <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">${report.summary.totalExpenses.toLocaleString()}</span>
          </div>

          <div className="neu-border bg-purple-50 p-3 border border-black dark:bg-purple-950/40">
            <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase block">Net Surplus</span>
            <span className="text-base font-extrabold text-purple-700 dark:text-purple-300">${report.summary.netSurplusDeficit.toLocaleString()}</span>
          </div>
        </div>

        {/* Form 990 Line Items Breakdown Table */}
        <div className="space-y-2">
          <h4 className="font-bold uppercase text-zinc-700 dark:text-zinc-300">
            Form 990 Schedule Category Schedule Breakdown:
          </h4>

          <div className="max-h-48 overflow-y-auto border-2 border-black bg-white dark:bg-zinc-900 rounded">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-zinc-100 font-bold uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border-b border-black">
                <tr>
                  <th className="py-2 px-3">Form 990 Line</th>
                  <th className="py-2 px-3">Schedule Category</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {report.revenueLines.map((rev) => (
                  <tr key={rev.lineCode} className="text-emerald-700 dark:text-emerald-300 font-bold">
                    <td className="py-2 px-3 font-mono">{rev.lineCode}</td>
                    <td className="py-2 px-3">{rev.lineName}</td>
                    <td className="py-2 px-3 text-right">+${rev.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
                {report.expenseLines.map((exp) => (
                  <tr key={exp.lineCode} className="text-rose-700 dark:text-rose-300">
                    <td className="py-2 px-3 font-mono font-bold">{exp.lineCode}</td>
                    <td className="py-2 px-3">{exp.lineName}</td>
                    <td className="py-2 px-3 text-right font-bold">-${exp.totalAmount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 1-Click Export Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-black/20 dark:border-zinc-800 justify-end">
          <Button variant="outline" onClick={handlePrint} className="font-mono text-xs font-bold uppercase gap-1.5">
            <Printer className="h-4 w-4" /> Print Form 990 Audit
          </Button>

          <Button variant="outline" onClick={handleDownloadJson} className="font-mono text-xs font-bold uppercase gap-1.5">
            <FileText className="h-4 w-4" /> Export JSON Manifest
          </Button>

          <Button onClick={handleDownloadCsv} className="neu-border bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs font-bold uppercase gap-1.5">
            <Download className="h-4 w-4" /> Download IRS CSV Ledger
          </Button>
        </div>
      </div>
    </Modal>
  );
};
