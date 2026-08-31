// src/components/admin/ContentModerationPanel.tsx
// Issue: #5359 - Automated "Profanity/Harassment" Automated Deepfake Pornography Detection (Hash Matching)
// Description: Admin interface for content moderation and forensic reporting

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  FileText,
  User,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ContentModerationQueue {
  id: string;
  user_id: string;
  upload_id: string;
  file_name: string;
  file_size_bytes: number;
  content_type: string;
  bucket: string;
  path: string;
  ip_address: string | null;
  user_agent: string | null;
  upload_timestamp: string;
  screening_status: string;
  screening_started_at: string | null;
  screening_completed_at: string | null;
  rejection_reason: string | null;
  match_database: string | null;
  match_score: number | null;
  is_hash_match: boolean;
  is_deepfake_detected: boolean;
  is_csam_detected: boolean;
  user_name?: string;
  user_email?: string;
}

interface ForensicReport {
  id: string;
  moderation_queue_id: string;
  user_id: string;
  report_type: string;
  severity: string;
  report_status: string;
  ip_address: string | null;
  file_name: string | null;
  match_details: any;
  incident_timestamp: string;
  report_submitted_at: string | null;
  report_submitted_to: string[];
  case_number: string | null;
  notes: string | null;
  user_name?: string;
}

interface UserSuspension {
  id: string;
  user_id: string;
  suspension_type: string;
  severity: string;
  suspension_status: string;
  reason: string;
  suspended_at: string;
  is_permanent: boolean;
  lifted_at: string | null;
  user_name?: string;
  user_email?: string;
}

export function ContentModerationPanel() {
  const supabase = createClient();
  const [queue, setQueue] = useState<ContentModerationQueue[]>([]);
  const [forensicReports, setForensicReports] = useState<ForensicReport[]>([]);
  const [suspensions, setSuspensions] = useState<UserSuspension[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState<ContentModerationQueue | null>(null);
  const [activeTab, setActiveTab] = useState<"queue" | "forensic" | "suspensions">("queue");

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "queue") {
        await fetchModerationQueue();
      } else if (activeTab === "forensic") {
        await fetchForensicReports();
      } else if (activeTab === "suspensions") {
        await fetchSuspensions();
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchModerationQueue = async () => {
    const { data, error } = await supabase
      .from("content_moderation_queue")
      .select(
        `
        *,
        profiles!inner(full_name, email)
      `,
      )
      .order("upload_timestamp", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      user_name: item.profiles?.full_name,
      user_email: item.profiles?.email,
    }));

    setQueue(formattedData);
  };

  const fetchForensicReports = async () => {
    const { data, error } = await supabase
      .from("forensic_reports")
      .select(
        `
        *,
        profiles!inner(full_name, email)
      `,
      )
      .order("incident_timestamp", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      user_name: item.profiles?.full_name,
    }));

    setForensicReports(formattedData);
  };

  const fetchSuspensions = async () => {
    const { data, error } = await supabase
      .from("user_suspensions")
      .select(
        `
        *,
        profiles!inner(full_name, email)
      `,
      )
      .order("suspended_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const formattedData = (data || []).map((item: any) => ({
      ...item,
      user_name: item.profiles?.full_name,
      user_email: item.profiles?.email,
    }));

    setSuspensions(formattedData);
  };

  const handleLiftSuspension = async (suspensionId: string, userId: string) => {
    const notes = prompt("Enter reason for lifting suspension:");
    if (!notes) return;

    try {
      const { error } = await supabase
        .from("user_suspensions")
        .update({
          suspension_status: "lifted",
          lifted_at: new Date().toISOString(),
          lifted_by: (await supabase.auth.getUser()).data.user?.id,
          lift_reason: notes,
        })
        .eq("id", suspensionId);

      if (error) throw error;

      toast.success("Suspension lifted successfully");
      fetchSuspensions();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to lift suspension");
    }
  };

  const handleUpdateReport = async (reportId: string) => {
    const notes = prompt("Enter update notes:");
    if (!notes) return;

    try {
      const { error } = await supabase
        .from("forensic_reports")
        .update({
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (error) throw error;

      toast.success("Report updated successfully");
      fetchForensicReports();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update report");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      screening: "bg-blue-100 text-blue-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      error: "bg-gray-100 text-gray-800",
      submitted: "bg-purple-100 text-purple-800",
      acknowledged: "bg-blue-100 text-blue-800",
      resolved: "bg-green-100 text-green-800",
      active: "bg-red-100 text-red-800",
      lifted: "bg-green-100 text-green-800",
      permanent: "bg-black text-white",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status] || colors.pending}`}
      >
        {status}
      </span>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-bold ${colors[severity] || colors.low}`}
      >
        {severity.toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display uppercase">Content Moderation</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            Hash-based content detection and forensic reporting
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant={activeTab === "queue" ? "default" : "ghost"}
          onClick={() => setActiveTab("queue")}
        >
          <FileText className="w-4 h-4 mr-2" />
          Moderation Queue
        </Button>
        <Button
          variant={activeTab === "forensic" ? "default" : "ghost"}
          onClick={() => setActiveTab("forensic")}
        >
          <Shield className="w-4 h-4 mr-2" />
          Forensic Reports
        </Button>
        <Button
          variant={activeTab === "suspensions" ? "default" : "ghost"}
          onClick={() => setActiveTab("suspensions")}
        >
          <User className="w-4 h-4 mr-2" />
          Suspensions
        </Button>
      </div>

      {activeTab === "queue" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Moderation Queue</h3>
          {queue.length === 0 ? (
            <p className="text-gray-600 font-mono">No items in queue</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded border ${
                    item.screening_status === "rejected"
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(item.screening_status)}
                        <span className="font-bold">{item.file_name}</span>
                      </div>
                      <div className="text-xs text-gray-600 font-mono space-y-1">
                        <p>
                          User: {item.user_name} ({item.user_email})
                        </p>
                        <p>Size: {(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                        <p>Type: {item.content_type}</p>
                        {item.ip_address && <p>IP: {item.ip_address}</p>}
                        <p>Uploaded: {new Date(item.upload_timestamp).toLocaleString()}</p>
                      </div>
                      {item.rejection_reason && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-800">
                          <p className="font-bold">Rejected: {item.rejection_reason}</p>
                          {item.match_database && <p>Database: {item.match_database}</p>}
                          {item.match_score && <p>Match Score: {item.match_score}</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {item.is_hash_match && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-bold">
                          Hash Match
                        </span>
                      )}
                      {item.is_csam_detected && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">
                          CSAM
                        </span>
                      )}
                      {item.is_deepfake_detected && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold">
                          Deepfake
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "forensic" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">Forensic Reports</h3>
          {forensicReports.length === 0 ? (
            <p className="text-gray-600 font-mono">No forensic reports</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {forensicReports.map((report) => (
                <div key={report.id} className="p-3 rounded border bg-orange-50 border-orange-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <span className="font-bold">{report.report_type.toUpperCase()}</span>
                      {getSeverityBadge(report.severity)}
                      {getStatusBadge(report.report_status)}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(report.incident_timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    <p>User: {report.user_name}</p>
                    {report.ip_address && <p>IP: {report.ip_address}</p>}
                    {report.file_name && <p>File: {report.file_name}</p>}
                    {report.case_number && <p>Case: {report.case_number}</p>}
                  </div>
                  {report.notes && <p className="text-sm text-gray-700 mb-2">{report.notes}</p>}
                  <div className="flex gap-2">
                    {report.report_status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateReport(report.id)}
                      >
                        Update
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "suspensions" && (
        <div className="border-2 border-gray-200 bg-white rounded-lg p-4">
          <h3 className="font-bold font-display uppercase mb-4">User Suspensions</h3>
          {suspensions.length === 0 ? (
            <p className="text-gray-600 font-mono">No suspensions</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {suspensions.map((suspension) => (
                <div
                  key={suspension.id}
                  className={`p-3 rounded border ${
                    suspension.suspension_status === "active"
                      ? "bg-red-50 border-red-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-bold">{suspension.user_name}</span>
                      {getStatusBadge(suspension.suspension_status)}
                      {getSeverityBadge(suspension.severity)}
                    </div>
                    {suspension.is_permanent && (
                      <span className="px-2 py-1 bg-black text-white rounded-full text-xs font-bold">
                        PERMANENT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 font-mono space-y-1 mb-2">
                    <p>Email: {suspension.user_email}</p>
                    <p>Type: {suspension.suspension_type}</p>
                    <p>Reason: {suspension.reason}</p>
                    <p>Suspended: {new Date(suspension.suspended_at).toLocaleString()}</p>
                    {suspension.lifted_at && (
                      <p>Lifted: {new Date(suspension.lifted_at).toLocaleString()}</p>
                    )}
                  </div>
                  {suspension.suspension_status === "active" && !suspension.is_permanent && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLiftSuspension(suspension.id, suspension.user_id)}
                    >
                      Lift Suspension
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
