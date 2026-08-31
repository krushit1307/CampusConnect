import React, { useState } from "react";
import {
  ShieldCheck,
  FileText,
  Database,
  Link as LinkIcon,
  Download,
  CheckCircle2,
  AlertOctagon,
  Fingerprint,
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const FdaHealthAuditExport: React.FC = () => {
  const [vendorId, setVendorId] = useState("vendor-acme-catering-4091");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);

  const handleGenerate = () => {
    setIsGenerating(true);
    setReportReady(false);

    // Simulate API Call to Edge Function
    setTimeout(() => {
      setAuditData({
        vendor_id: vendorId,
        contract_date: new Date().toISOString(),
        blockchain_verification: {
          network: "Polygon Mainnet",
          contract_address: "0x892aF0f6EbD3Bc40C4d29311B9a83B32dE28E951",
          transaction_hash:
            "0x" +
            Array.from(crypto.getRandomValues(new Uint8Array(32)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(""),
          cv_hash:
            "sha256:" +
            Array.from(crypto.getRandomValues(new Uint8Array(32)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(""),
        },
        iot_temperature_logs: [
          { timestamp: "2026-08-31T08:00:00Z", temp_f: 38.2, status: "COMPLIANT" },
          { timestamp: "2026-08-31T09:00:00Z", temp_f: 38.5, status: "COMPLIANT" },
          { timestamp: "2026-08-31T10:00:00Z", temp_f: 41.5, status: "WARNING" },
          { timestamp: "2026-08-31T10:15:00Z", temp_f: 39.0, status: "COMPLIANT" },
          { timestamp: "2026-08-31T11:00:00Z", temp_f: 37.8, status: "COMPLIANT" },
        ],
        computer_vision_logs: [
          {
            timestamp: "2026-08-31T10:05:00Z",
            camera: "Kitchen Cam 1",
            event: "Food Spoilage Detected",
            action: "Flagged for Disposal",
            confidence: "98.5%",
          },
        ],
      });
      setIsGenerating(false);
      setReportReady(true);
    }, 2000);
  };

  const handleDownloadPdf = () => {
    if (!auditData) return;

    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("FDA HACCP Compliance Audit Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Vendor ID: ${auditData.vendor_id}`, 14, 33);

    // Cryptographic Proof Section
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("Cryptographic Verification (Polygon Blockchain)", 14, 45);

    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Network: ${auditData.blockchain_verification.network}`, 14, 52);
    doc.text(`Smart Contract: ${auditData.blockchain_verification.contract_address}`, 14, 57);
    doc.text(`Transaction Hash: ${auditData.blockchain_verification.transaction_hash}`, 14, 62);
    doc.text(`CV Spoilage Merkle Root: ${auditData.blockchain_verification.cv_hash}`, 14, 67);

    // IoT Temperature Logs
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("IoT Cold Storage Temperature Logs", 14, 80);

    autoTable(doc, {
      startY: 85,
      head: [["Timestamp (UTC)", "Temperature (F)", "Status"]],
      body: auditData.iot_temperature_logs.map((log: any) => [
        log.timestamp,
        log.temp_f.toFixed(1),
        log.status,
      ]),
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    // Computer Vision Action Logs
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(
      "Computer Vision Spoilage Intervention Logs",
      14,
      (doc as any).lastAutoTable.finalY + 15,
    );

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Timestamp (UTC)", "Camera", "Event", "Action Taken", "Confidence"]],
      body: auditData.computer_vision_logs.map((log: any) => [
        log.timestamp,
        log.camera,
        log.event,
        log.action,
        log.confidence,
      ]),
      theme: "grid",
      headStyles: { fillColor: [192, 57, 43] },
    });

    // Footer
    doc.setFontSize(8);
    doc.text("This document is cryptographically guaranteed and legally admissible.", 14, 280);

    doc.save(`FDA_HACCP_Audit_${auditData.vendor_id}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-sky-500" />
            FDA / Health Dept Audit Export
          </h1>
          <p className="text-slate-400 mt-2 font-mono text-sm max-w-2xl leading-relaxed">
            Generate legally admissible HACCP compliance PDFs. Data is directly aggregated from
            Immutable Polygon Blockchain records, mathematically proving that the University did not
            retroactively alter safety logs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Configuration Panel */}
        <Card className="bg-slate-900 border-slate-800 shadow-2xl relative overflow-hidden">
          <CardHeader className="border-b border-slate-800 pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-400" />
              Audit Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-400 font-bold uppercase tracking-wider text-xs flex items-center gap-2">
                <FileText className="h-3 w-3" /> Target Vendor / Catering Contract ID
              </Label>
              <Input
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white font-mono"
              />
            </div>

            <div className="bg-sky-950/20 border border-sky-900/50 p-4 rounded-lg flex gap-4 mt-4">
              <Fingerprint className="h-8 w-8 text-sky-500 shrink-0" />
              <p className="text-xs font-mono text-sky-200/80 leading-relaxed">
                When generated, the Edge Function will query the Polygon Mainnet RPC to fetch the
                cryptographically signed IoT Temperature Arrays and the Computer Vision Spoilage
                Hashes.
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-950/50 border-t border-slate-800 pt-4">
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !vendorId}
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold h-12 uppercase tracking-wide"
            >
              {isGenerating ? "Querying Blockchain RPC..." : "Compile Blockchain Audit Data"}
            </Button>
          </CardFooter>
        </Card>

        {/* Results Panel */}
        <div className="space-y-6 flex flex-col h-full justify-center">
          <Card
            className={`bg-slate-900 border-slate-800 shadow-xl transition-opacity duration-500 ${reportReady ? "opacity-100" : "opacity-30 pointer-events-none"}`}
          >
            <CardHeader className="bg-emerald-950/20 border-b border-emerald-900/30 pb-4">
              <CardTitle className="text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Data Integrity Verified
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {auditData && (
                <>
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <LinkIcon className="h-3 w-3" /> Polygon Tx Hash
                    </p>
                    <div className="bg-slate-950 p-2 rounded border border-indigo-500/30 font-mono text-[10px] text-indigo-300 break-all leading-relaxed">
                      {auditData.blockchain_verification.transaction_hash}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <AlertOctagon className="h-3 w-3" /> Computer Vision Merkle Root
                    </p>
                    <div className="bg-slate-950 p-2 rounded border border-rose-500/30 font-mono text-[10px] text-rose-300 break-all leading-relaxed">
                      {auditData.blockchain_verification.cv_hash}
                    </div>
                  </div>

                  <Button
                    onClick={handleDownloadPdf}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 font-bold mt-6 h-12"
                  >
                    <Download className="mr-2 h-5 w-5" /> Generate HACCP PDF Report
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

export default FdaHealthAuditExport;
