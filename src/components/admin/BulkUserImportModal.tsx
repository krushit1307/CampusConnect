import React, { useState } from "react";
import Upload from "lucide-react/dist/esm/icons/upload";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Cpu from "lucide-react/dist/esm/icons/cpu";
import Download from "lucide-react/dist/esm/icons/download";
import X from "lucide-react/dist/esm/icons/x";
import Layers from "lucide-react/dist/esm/icons/layers";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Clock from "lucide-react/dist/esm/icons/clock";
import Database from "lucide-react/dist/esm/icons/database";
import FileText from "lucide-react/dist/esm/icons/file-text";
import {
  generateDummyUserCsv,
  BulkImportSummary,
} from "../../lib/validations/bulkImportValidation";
import { handleBulkUserImportApiRequest } from "../../services/adminUsersImportApi";
import { BulkImportService } from "../../services/bulkImportService";

interface BulkUserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessRefresh?: () => void;
}

export const BulkUserImportModal: React.FC<BulkUserImportModalProps> = ({
  isOpen,
  onClose,
  onSuccessRefresh,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [batchSize, setBatchSize] = useState<number>(500);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [summary, setSummary] = useState<BulkImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"upload" | "summary" | "errors">("upload");

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setError("Please select a valid CSV file (.csv)");
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setFileContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleGenerateTestCsv = (totalRows: number, invalidCount: number) => {
    const invalidIndices = invalidCount === 2 ? [5000, 7500] : [];
    const testCsv = generateDummyUserCsv(totalRows, invalidIndices);
    setFileContent(testCsv);
    setSelectedFile(new File([testCsv], `demo_${totalRows}_students.csv`, { type: "text/csv" }));
    setError(null);
    setSummary(null);
  };

  const handleExecuteImport = async () => {
    if (!fileContent) {
      setError("Please select or generate a CSV file first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSummary(null);

    try {
      const response = await handleBulkUserImportApiRequest(fileContent, batchSize);
      setSummary(response.data);
      setActiveTab("summary");
      if (response.data.insertedCount > 0 && onSuccessRefresh) {
        onSuccessRefresh();
      }
    } catch (err: any) {
      setError(err?.message || "Stream processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadFailedRows = () => {
    if (!summary || summary.failedRows.length === 0) return;
    const service = new BulkImportService();
    const csvContent = service.generateFailedRowsCsv(summary.failedRows);

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `failed_rows_report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleTemplate = () => {
    const template =
      "email,name,role,department,studentId,phone\njohn.doe@campusconnect.edu,John Doe,student,Computer Science,CS1001,+1555123456\njane.smith@campusconnect.edu,Jane Smith,faculty,Electrical Engineering,FAC2002,+1555987654\n";
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "campusconnect_student_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border-2 border-black w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Streaming Bulk User Import</h2>
              <p className="text-xs text-slate-300">
                Memory-efficient streaming CSV parser (Node.js Streams & Batch Pipeline)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === "upload"
                ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Upload className="w-4 h-4" /> CSV Source
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            disabled={!summary}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              !summary
                ? "text-gray-300 cursor-not-allowed border-transparent"
                : activeTab === "summary"
                  ? "border-indigo-600 text-indigo-600 bg-white rounded-t-lg"
                  : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Import Metrics
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            disabled={!summary || summary.failedCount === 0}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${
              !summary || summary.failedCount === 0
                ? "text-gray-300 cursor-not-allowed border-transparent"
                : activeTab === "errors"
                  ? "border-amber-600 text-amber-600 bg-white rounded-t-lg"
                  : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> Failed Rows ({summary?.failedCount || 0})
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-6">
              {/* File Upload Zone */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 transition bg-slate-50">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-file-input"
                />
                <label
                  htmlFor="csv-file-input"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="p-4 bg-indigo-100 rounded-full text-indigo-600">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800">Click to upload CSV file</span> or
                    drag and drop
                  </div>
                  <span className="text-xs text-gray-500">
                    Supports 10,000+ student rows (e.g. 15MB CSV) via Node.js Streams
                  </span>
                </label>

                {selectedFile && (
                  <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg inline-flex items-center gap-3 text-sm font-medium text-indigo-900">
                    <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                    <span>{selectedFile.name}</span>
                    <span className="text-xs text-indigo-500">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                )}
              </div>

              {/* Streaming Configuration & Quick Demo Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm space-y-3">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" /> Streaming Batch Buffer Size
                  </label>
                  <select
                    value={batchSize}
                    onChange={(e) => setBatchSize(Number(e.target.value))}
                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value={100}>100 rows per batch (High Frequency)</option>
                    <option value={250}>250 rows per batch</option>
                    <option value={500}>500 rows per batch (Recommended Standard)</option>
                    <option value={1000}>1000 rows per batch (High Throughput)</option>
                  </select>
                  <p className="text-xs text-gray-500">
                    Stream pauses every {batchSize} rows to execute bulk SQL insert, ensuring RAM
                    stays flat.
                  </p>
                </div>

                <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm space-y-3">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-indigo-600" /> Test Data Generators
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleGenerateTestCsv(10000, 2)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 transition"
                    >
                      10k CSV (9,998 valid + 2 invalid)
                    </button>
                    <button
                      onClick={() => handleGenerateTestCsv(1000, 0)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg border border-emerald-200 transition"
                    >
                      1k CSV (100% Valid)
                    </button>
                  </div>
                </div>
              </div>

              {/* Sample Download */}
              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                <span>Need proper CSV header format?</span>
                <button
                  onClick={handleDownloadSampleTemplate}
                  className="text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" /> Download Sample CSV Template
                </button>
              </div>
            </div>
          )}

          {activeTab === "summary" && summary && (
            <div className="space-y-6">
              {/* Status Header */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  summary.failedCount === 0
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  {summary.failedCount === 0 ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  )}
                  <div>
                    <h3 className="font-bold text-base">
                      {summary.failedCount === 0
                        ? "100% Successful Stream Import"
                        : "Partial Stream Import Success"}
                    </h3>
                    <p className="text-xs opacity-90">
                      Processed {summary.totalProcessed.toLocaleString()} total rows across{" "}
                      {Math.ceil(summary.totalProcessed / summary.batchSize)} stream batches.
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold">
                    {summary.insertedCount.toLocaleString()}
                  </span>
                  <span className="text-xs block opacity-75">Users Inserted</span>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                    <Database className="w-4 h-4 text-indigo-600" /> Total Rows
                  </div>
                  <div className="text-xl font-bold text-slate-900">
                    {summary.totalProcessed.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Inserted
                  </div>
                  <div className="text-xl font-bold text-emerald-900">
                    {summary.insertedCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Failed Rows
                  </div>
                  <div className="text-xl font-bold text-amber-900">
                    {summary.failedCount.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-purple-700 font-semibold">
                    <Clock className="w-4 h-4 text-purple-600" /> Duration
                  </div>
                  <div className="text-xl font-bold text-purple-900">
                    {summary.executionTimeMs} ms
                  </div>
                </div>
              </div>

              {/* RAM Memory Stability Telemetry */}
              <div className="p-5 border border-gray-200 rounded-xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-400">
                    <Cpu className="w-5 h-5" /> Memory Usage Telemetry (Node.js Heap)
                  </div>
                  <span className="text-xs text-slate-400">
                    Batch Size: {summary.batchSize} rows/chunk
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-xs text-slate-400 block">Initial Heap</span>
                    <span className="text-lg font-mono font-bold text-slate-200">
                      {summary.memoryMetrics.initialHeapMB} MB
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Peak Heap (Flat)</span>
                    <span className="text-lg font-mono font-bold text-emerald-400">
                      {summary.memoryMetrics.peakHeapMB} MB
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Final Heap</span>
                    <span className="text-lg font-mono font-bold text-slate-200">
                      {summary.memoryMetrics.finalHeapMB} MB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "errors" && summary && summary.failedRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">
                  Failed Row Breakdown ({summary.failedRows.length} reported)
                </h3>
                <button
                  onClick={handleDownloadFailedRows}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" /> Download Error CSV Log
                </button>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-3 w-20">Row #</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {summary.failedRows.map((failedItem, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/50">
                        <td className="p-3 font-mono font-bold text-amber-700">
                          #{failedItem.rowNumber}
                        </td>
                        <td className="p-3 font-mono text-gray-800">
                          {failedItem.email || "(Missing)"}
                        </td>
                        <td className="p-3 text-red-600 font-medium">{failedItem.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Close
          </button>

          {activeTab === "upload" && (
            <button
              onClick={handleExecuteImport}
              disabled={isProcessing || !fileContent}
              className={`px-6 py-2 text-sm font-bold text-white rounded-lg transition flex items-center gap-2 ${
                isProcessing || !fileContent
                  ? "bg-indigo-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Streaming CSV...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Start Streaming Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
