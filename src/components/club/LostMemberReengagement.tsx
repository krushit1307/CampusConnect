import React, { useEffect, useState } from "react";
import {
  Mail,
  CheckCircle,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Clock,
  UserCheck,
} from "lucide-react";
import { lostMemberService, LostMemberCampaign } from "@/services/lostMemberService";
import { toast } from "sonner";

interface LostMemberReengagementProps {
  clubId: string;
  clubName: string;
}

export const LostMemberReengagement: React.FC<LostMemberReengagementProps> = ({
  clubId,
  clubName,
}) => {
  const [campaigns, setCampaigns] = useState<LostMemberCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<LostMemberCampaign | null>(null);
  const [editableBody, setEditableBody] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await lostMemberService.getPendingCampaigns(clubId);
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaign) {
        setSelectedCampaign(data[0]);
        setEditableBody(data[0].draft_body);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load lost member re-engagement campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [clubId]);

  const handleRunDetection = async () => {
    try {
      setAnalyzing(true);
      const res = await lostMemberService.runDetectionCron(clubId);
      toast.success(
        `Analysis completed. ${res.draftsCreated} new lost member outreach draft(s) created.`,
      );
      await fetchCampaigns();
    } catch (err) {
      console.error(err);
      toast.error("Failed to run lost member detection analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApproveAndSend = async (campaign: LostMemberCampaign) => {
    try {
      setProcessingId(campaign.id);
      await lostMemberService.approveAndSend(campaign.id, editableBody);
      toast.success(
        `Personalized outreach approved and dispatched to ${campaign.user?.full_name || "member"}!`,
      );
      const remaining = campaigns.filter((c) => c.id !== campaign.id);
      setCampaigns(remaining);
      setSelectedCampaign(remaining[0] || null);
      if (remaining[0]) {
        setEditableBody(remaining[0].draft_body);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send re-engagement outreach.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (campaignId: string) => {
    try {
      setProcessingId(campaignId);
      await lostMemberService.dismissDraft(campaignId);
      toast.info("Re-engagement draft dismissed.");
      const remaining = campaigns.filter((c) => c.id !== campaignId);
      setCampaigns(remaining);
      setSelectedCampaign(remaining[0] || null);
      if (remaining[0]) {
        setEditableBody(remaining[0].draft_body);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to dismiss draft.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="bg-card text-card-foreground border rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">
              Post-Event "Lost Member" Re-Engagement
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-amber-900/30 dark:text-amber-300">
              Churn Detection
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Detects active attendees who disappeared (&gt;3 past events, 0 in last 60 days) and
            drafts personalized outreach.
          </p>
        </div>
        <button
          onClick={handleRunDetection}
          disabled={analyzing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${analyzing ? "animate-spin" : ""}`} />
          {analyzing ? "Analyzing Attendance..." : "Run Churn Analysis"}
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center items-center text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          Loading churn campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl space-y-3 bg-muted/20">
          <UserCheck className="w-12 h-12 mx-auto text-emerald-500" />
          <h3 className="text-base font-semibold">No Lost Members Detected</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Great news! All active attendees have participated recently or no severe drop-offs were
            detected for {clubName}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of pending drafts */}
          <div className="lg:col-span-1 border rounded-lg divide-y bg-background overflow-hidden">
            <div className="p-3 bg-muted/40 font-semibold text-xs text-muted-foreground uppercase tracking-wider flex justify-between items-center">
              <span>Pending Outreach ({campaigns.length})</span>
            </div>
            <div className="divide-y max-h-[460px] overflow-y-auto">
              {campaigns.map((c) => {
                const isSelected = selectedCampaign?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCampaign(c);
                      setEditableBody(c.draft_body);
                    }}
                    className={`w-full text-left p-4 transition-colors flex flex-col gap-1.5 ${
                      isSelected ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate">
                        {c.user?.full_name || "Member"}
                      </span>
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {c.days_inactive}d inactive
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {c.user?.email || "No email available"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                        {c.total_past_attended} past events attended
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Draft Preview and Approval panel */}
          <div className="lg:col-span-2 border rounded-lg p-5 bg-background space-y-4 flex flex-col justify-between">
            {selectedCampaign ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Review Personalized Email Draft</h3>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Recipient:{" "}
                        <strong className="text-foreground">
                          {selectedCampaign.user?.full_name}
                        </strong>{" "}
                        ({selectedCampaign.user?.email})
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      Leadership Approval Required
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      value={selectedCampaign.subject}
                      readOnly
                      className="w-full bg-muted/40 border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold uppercase text-muted-foreground">
                        Message Body (Editable)
                      </label>
                      <span className="text-xs text-muted-foreground">Tailor before sending</span>
                    </div>
                    <textarea
                      rows={8}
                      value={editableBody}
                      onChange={(e) => setEditableBody(e.target.value)}
                      className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none font-sans"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t">
                  <button
                    onClick={() => handleDismiss(selectedCampaign.id)}
                    disabled={processingId === selectedCampaign.id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleApproveAndSend(selectedCampaign)}
                    disabled={processingId === selectedCampaign.id}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {processingId === selectedCampaign.id ? "Sending..." : "Approve & Send"}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-muted-foreground">
                Select a member outreach draft from the left panel to review.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
