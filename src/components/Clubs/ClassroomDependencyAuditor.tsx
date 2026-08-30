// =============================================================================
// Component: ClassroomDependencyAuditor
// Purpose: Allows series organizers to manage classroom assignments, view student
//   submissions, run Supply-Chain Dependency audits via OSV.dev, and inspect CVEs.
// =============================================================================

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import {
  ClassroomAuditorService,
  type ClassroomAssignment,
  type ClassroomSubmission,
  type DependencyAuditLog,
} from "@/services/classroomAuditorService";
import { Button } from "@/components/ui/button";
import Github from "lucide-react/dist/esm/icons/github";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import Play from "lucide-react/dist/esm/icons/play";
import Terminal from "lucide-react/dist/esm/icons/terminal";

interface ClassroomDependencyAuditorProps {
  seriesId: string;
}

export function ClassroomDependencyAuditor({ seriesId }: ClassroomDependencyAuditorProps) {
  const [assignments, setAssignments] = useState<ClassroomAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>("");
  const [submissions, setSubmissions] = useState<ClassroomSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>("");
  const [auditLogs, setAuditLogs] = useState<DependencyAuditLog[]>([]);
  
  // Manifest Form states
  const [manifestContent, setManifestContent] = useState("");
  const [manifestType, setManifestType] = useState<"json" | "txt" | "mod">("json");
  
  // Assignment creation form states
  const [newTitle, setNewTitle] = useState("");
  const [newOrg, setNewOrg] = useState("cc-classroom");
  const [newPrefix, setNewPrefix] = useState("lab-");
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAssignments = useCallback(async () => {
    const data = await ClassroomAuditorService.fetchAssignmentsForSeries(seriesId);
    setAssignments(data);
    if (data.length > 0 && !selectedAssignmentId) {
      setSelectedAssignmentId(data[0].id);
    }
  }, [seriesId, selectedAssignmentId]);

  const loadSubmissions = useCallback(async () => {
    if (!selectedAssignmentId) return;
    const data = await ClassroomAuditorService.fetchSubmissionsForAssignment(selectedAssignmentId);
    setSubmissions(data);
  }, [selectedAssignmentId]);

  const loadAuditLogs = useCallback(async () => {
    if (!selectedSubmissionId) return;
    const logs = await ClassroomAuditorService.fetchAuditLogsForSubmission(selectedSubmissionId);
    setAuditLogs(logs);
  }, [selectedSubmissionId]);

  useEffect(() => {
    void loadAssignments();
  }, [seriesId, loadAssignments]);

  useEffect(() => {
    if (selectedAssignmentId) {
      void loadSubmissions();
    }
  }, [selectedAssignmentId, loadSubmissions]);

  useEffect(() => {
    if (selectedSubmissionId) {
      void loadAuditLogs();
    }
  }, [selectedSubmissionId, loadAuditLogs]);

  // Realtime subscription updates for submissions & logs
  useEffect(() => {
    if (!selectedAssignmentId) return;
    const channel = supabase
      .channel(`classroom-audits-realtime-${selectedAssignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "github_classroom_submissions",
          filter: `assignment_id=eq.${selectedAssignmentId}`,
        },
        () => {
          void loadSubmissions();
          if (selectedSubmissionId) void loadAuditLogs();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedAssignmentId, selectedSubmissionId, loadSubmissions, loadAuditLogs]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newOrg.trim() || !newPrefix.trim()) {
      toast.error("All assignment fields are required.");
      return;
    }
    const created = await ClassroomAuditorService.createAssignment(
      seriesId,
      newTitle,
      newOrg,
      newPrefix
    );
    if (created) {
      toast.success("GitHub Classroom Assignment registered successfully!");
      setNewTitle("");
      setShowAssignForm(false);
      void loadAssignments();
    } else {
      toast.error("Failed to register assignment.");
    }
  };

  const handleRunAudit = async () => {
    if (!selectedSubmissionId) {
      toast.error("Please select a student submission to audit.");
      return;
    }
    if (!manifestContent.trim()) {
      toast.error("Please enter package.json or dependency list content.");
      return;
    }
    setLoading(true);
    toast.info("Parsing manifest and querying OSV.dev vulnerability REST API...");
    try {
      const res = await ClassroomAuditorService.runDependencyAudit(
        selectedSubmissionId,
        manifestContent,
        manifestType
      );
      if (res.success) {
        if (res.audit_status === "FAILED") {
          toast.error("Dependency Audit FAILED: High CVSS score vulnerability detected! Build blocked.");
        } else {
          toast.success("Dependency Audit PASSED: Supply chain supply verified.");
        }
        void loadSubmissions();
        void loadAuditLogs();
      } else {
        toast.error(res.error || "Auditing error");
      }
    } catch (err: any) {
      toast.error(err.message || "Auditing failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="border-4 border-black bg-purple-50 p-6 shadow-[8px_8px_0px_rgba(0,0,0,1)] rounded-none text-black font-mono mt-8"
      data-testid="classroom-dependency-auditor"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-4 border-black pb-3 mb-6">
        <h3 className="flex items-center gap-2 text-2xl font-black uppercase text-black">
          <Github className="h-6 w-6 text-black animate-pulse" /> Supply-Chain Manifest Auditor
        </h3>
        <Button
          onClick={() => setShowAssignForm(!showAssignForm)}
          className="neu-border bg-black text-lime font-mono text-xs font-bold uppercase px-4 py-2 border-2 border-black"
          data-testid="toggle-assign-form-btn"
        >
          {showAssignForm ? "Hide Settings" : "+ Register Assignment"}
        </Button>
      </div>

      {/* Register Assignment Form */}
      {showAssignForm && (
        <form onSubmit={handleCreateAssignment} className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] mb-6 space-y-3">
          <span className="font-black text-xs uppercase text-indigo-900 block border-b pb-1 mb-2">
            Configure GitHub Classroom Webhook Hook
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase">Assignment Title</label>
              <input
                type="text"
                placeholder="e.g. Lab 1: Express REST API"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                data-testid="new-title-input"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase">GitHub Organization</label>
              <input
                type="text"
                placeholder="e.g. cc-classroom"
                value={newOrg}
                onChange={(e) => setNewOrg(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase">Repository Prefix</label>
              <input
                type="text"
                placeholder="e.g. lab-1-express"
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value)}
                className="border-2 border-black bg-white px-2 py-1.5 text-xs font-mono outline-none w-full text-black"
                required
              />
            </div>
          </div>
          <Button
            type="submit"
            className="neu-border bg-lime text-black font-mono text-xs font-bold uppercase px-4 py-2 mt-2 shadow-[2px_2px_0_0_#000]"
            data-testid="submit-assignment-btn"
          >
            Create Webhook Trigger
          </Button>
        </form>
      )}

      {/* Main Grid split: Submissions & Manifest Auditor Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
            <span className="font-black text-xs uppercase text-indigo-900 block mb-2">
              Select Classroom Assignment
            </span>
            <select
              value={selectedAssignmentId}
              onChange={(e) => setSelectedAssignmentId(e.target.value)}
              className="neu-border bg-white w-full p-2 font-mono text-sm"
              data-testid="assignment-select"
            >
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.github_org}/{a.github_repo_prefix})
                </option>
              ))}
            </select>
          </div>

          {/* Submissions List Table */}
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
            <span className="font-black text-xs uppercase text-indigo-900 block mb-3">
              Student Submissions
            </span>

            {submissions.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs italic">
                No submissions registered yet for this assignment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-black bg-zinc-50">
                      <th className="p-2">Student</th>
                      <th className="p-2">Repository</th>
                      <th className="p-2">SCA Audit</th>
                      <th className="p-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => (
                      <tr
                        key={sub.id}
                        onClick={() => setSelectedSubmissionId(sub.id)}
                        className={`border-b border-black/5 hover:bg-zinc-50 cursor-pointer ${
                          selectedSubmissionId === sub.id ? "bg-indigo-50/50" : ""
                        }`}
                        data-testid={`submission-row-${sub.id}`}
                      >
                        <td className="p-2 font-bold">{sub.profiles?.full_name || sub.student_id.slice(0, 8)}</td>
                        <td className="p-2 text-[10px] text-zinc-600 truncate max-w-[120px]">{sub.github_repo_name}</td>
                        <td className="p-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                              sub.audit_status === "PASSED"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : sub.audit_status === "FAILED"
                                  ? "bg-red-50 border-red-200 text-red-800 animate-pulse"
                                  : "bg-yellow-50 border-yellow-200 text-yellow-800"
                            }`}
                          >
                            {sub.audit_status}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          <Button className="neu-border bg-white text-black px-2 py-0.5 text-[9px] font-bold">Select</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Run Manifest Audit form & CVE details */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Manifest Auditor Inputs */}
          {selectedSubmissionId && (
            <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] space-y-3">
              <span className="font-black text-xs uppercase text-indigo-900 block">
                SCA Supply-Chain Sandbox Simulator
              </span>

              <div className="flex gap-4 items-center">
                <span className="text-[10px] font-bold uppercase text-zinc-500">Manifest Type:</span>
                <div className="flex gap-2">
                  {(["json", "txt", "mod"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1 text-[10px] font-bold cursor-pointer">
                      <input
                        type="radio"
                        name="manifestType"
                        checked={manifestType === t}
                        onChange={() => setManifestType(t)}
                      />
                      {t === "json" ? "package.json" : t === "txt" ? "requirements.txt" : "go.mod"}
                    </label>
                  ))}
                </div>
              </div>

              <textarea
                placeholder={
                  manifestType === "json"
                    ? '{\n  "dependencies": {\n    "express": "4.16.0"\n  }\n}'
                    : manifestType === "txt"
                      ? "express==4.16.0"
                      : "require github.com/gin-gonic/gin v1.7.0"
                }
                value={manifestContent}
                onChange={(e) => setManifestContent(e.target.value)}
                className="border-2 border-black bg-zinc-50 p-2 font-mono text-xs w-full h-24 outline-none resize-none text-black"
                data-testid="manifest-input"
              />

              <Button
                onClick={handleRunAudit}
                disabled={loading}
                className="neu-border bg-[#a3e635] text-black hover:bg-lime-400 font-mono text-xs font-bold uppercase w-full py-2 shadow-[2px_2px_0_0_#000] flex items-center justify-center gap-1.5"
                data-testid="run-audit-btn"
              >
                <Play className="h-4 w-4" /> {loading ? "Querying OSV.dev REST..." : "Trigger Auto-Grader Hook (Audit)"}
              </Button>
            </div>
          )}

          {/* Audit Logs Details */}
          <div className="border-2 border-black bg-white p-4 shadow-[3px_3px_0px_rgba(0,0,0,1)] flex-1">
            <span className="font-black text-xs uppercase text-indigo-900 block mb-3 flex items-center gap-1.5">
              <Terminal className="h-4 w-4" /> Detailed Supply-Chain Log Report
            </span>

            {selectedSubmissionId ? (
              auditLogs.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs italic border border-dashed border-zinc-200 bg-zinc-50 rounded">
                  No high CVSS vulnerabilities detected on this manifest. Auto-grader grade: 100/100.
                </div>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border-2 border-red-500 bg-red-50 p-3 shadow-[1.5px_1.5px_0px_rgba(0,0,0,1)] flex flex-col gap-1 relative overflow-hidden text-red-950"
                      data-testid={`cve-log-${log.id}`}
                    >
                      <div className="flex items-center justify-between border-b border-red-200 pb-1">
                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                          <AlertCircle className="h-3 w-3 shrink-0" /> {log.cve_id || "CVE ID"}
                        </div>
                        <span className="text-[9px] font-black text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                          CVSS: {log.cvss_score?.toFixed(1) || "7.5"}
                        </span>
                      </div>

                      <div className="text-[10px]">
                        <div>
                          <span className="font-bold text-red-800">Package:</span>{" "}
                          <strong className="text-black font-black">{log.package_name}</strong> ({log.current_version})
                        </div>
                        <div className="mt-1 text-[9px] leading-relaxed text-zinc-800 font-bold">
                          {log.summary}
                        </div>
                        <div className="mt-1 pt-1 border-t border-red-200/50 flex justify-between items-center text-[9px]">
                          <span className="font-bold text-red-800">Remediation:</span>
                          <span className="font-black text-black">{log.patched_version}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="text-center py-8 text-zinc-400 text-xs">
                Select a student submission to view detailed supply-chain report.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
