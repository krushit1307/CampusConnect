// src/components/admin/SpeakerBriefingPanel.tsx
// Issue: #5059 - Dynamic "Alumni Speaker" Natural Language Speaker Briefing
// Description: Admin interface for viewing and managing speaker briefings

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, Download, Mail, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SpeakerBriefing {
  id: string;
  event_id: string;
  event_title: string;
  club_id: string;
  club_name: string;
  speaker_name: string;
  speaker_email: string;
  aggregation_start_date: string;
  aggregation_end_date: string;
  chat_messages_count: number;
  forum_posts_count: number;
  qa_questions_count: number;
  briefing_summary: string | null;
  top_anxieties: any;
  top_topics: any;
  top_questions: any;
  pdf_url: string | null;
  pdf_generated_at: string | null;
  email_sent_at: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function SpeakerBriefingPanel() {
  const supabase = createClient();
  const [briefings, setBriefings] = useState<SpeakerBriefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBriefing, setSelectedBriefing] = useState<SpeakerBriefing | null>(null);

  useEffect(() => {
    fetchBriefings();
  }, []);

  const fetchBriefings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("speaker_briefings")
        .select(
          `
          *,
          events!inner(title, speaker_name, speaker_email),
          clubs!inner(name)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedData = (data || []).map((b: any) => ({
        id: b.id,
        event_id: b.event_id,
        event_title: b.events.title,
        club_id: b.club_id,
        club_name: b.clubs.name,
        speaker_name: b.events.speaker_name,
        speaker_email: b.events.speaker_email,
        aggregation_start_date: b.aggregation_start_date,
        aggregation_end_date: b.aggregation_end_date,
        chat_messages_count: b.chat_messages_count,
        forum_posts_count: b.forum_posts_count,
        qa_questions_count: b.qa_questions_count,
        briefing_summary: b.briefing_summary,
        top_anxieties: b.top_anxieties,
        top_topics: b.top_topics,
        top_questions: b.top_questions,
        pdf_url: b.pdf_url,
        pdf_generated_at: b.pdf_generated_at,
        email_sent_at: b.email_sent_at,
        status: b.status,
        error_message: b.error_message,
        created_at: b.created_at,
      }));

      setBriefings(formattedData);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch speaker briefings");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBriefing = async (briefingId: string) => {
    try {
      const response = await fetch("/functions/v1/generate-speaker-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing_id: briefingId }),
      });

      if (!response.ok) throw new Error("Failed to regenerate briefing");

      toast.success("Briefing regeneration started");
      fetchBriefings();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to regenerate briefing");
    }
  };

  const handleResendEmail = async (briefing: SpeakerBriefing) => {
    // Placeholder for email resend functionality
    toast.info(`Email resend functionality would send to ${briefing.speaker_email}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "generating":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
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
          <h2 className="text-2xl font-bold font-display uppercase">Speaker Briefings</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            AI-generated briefings for alumni speakers based on student discussions
          </p>
        </div>
        <Button onClick={fetchBriefings} variant="outline">
          Refresh
        </Button>
      </div>

      {briefings.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="font-mono text-gray-600">No speaker briefings generated yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {briefings.map((briefing) => (
            <div
              key={briefing.id}
              className="border-2 border-gray-200 bg-white rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
              onClick={() => setSelectedBriefing(briefing)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(briefing.status)}
                    <span className="font-bold text-gray-900">{briefing.event_title}</span>
                    <span className="text-sm text-gray-600">| {briefing.club_name}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm font-mono text-gray-700 mb-2">
                    <span>Speaker: {briefing.speaker_name}</span>
                    <span>Chat: {briefing.chat_messages_count}</span>
                    <span>Posts: {briefing.forum_posts_count}</span>
                    <span>Q&A: {briefing.qa_questions_count}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(briefing.created_at).toLocaleString()}</span>
                    {briefing.status === "completed" && briefing.pdf_url && (
                      <span className="text-green-600">• PDF Ready</span>
                    )}
                    {briefing.email_sent_at && <span className="text-blue-600">• Email Sent</span>}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  {briefing.pdf_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(briefing.pdf_url, "_blank");
                      }}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      PDF
                    </Button>
                  )}
                  {briefing.status === "failed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRegenerateBriefing(briefing.id);
                      }}
                    >
                      Regenerate
                    </Button>
                  )}
                  {briefing.status === "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResendEmail(briefing);
                      }}
                    >
                      <Mail className="w-4 h-4 mr-1" />
                      Resend Email
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedBriefing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedBriefing(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold font-display uppercase">Briefing Details</h3>
              <Button variant="ghost" onClick={() => setSelectedBriefing(null)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">Event</span>
                <p className="font-bold">{selectedBriefing.event_title}</p>
              </div>

              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">Speaker</span>
                <p>
                  {selectedBriefing.speaker_name} ({selectedBriefing.speaker_email})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Chat Messages
                  </span>
                  <p className="font-bold">{selectedBriefing.chat_messages_count}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Forum Posts
                  </span>
                  <p className="font-bold">{selectedBriefing.forum_posts_count}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Q&A Questions
                  </span>
                  <p className="font-bold">{selectedBriefing.qa_questions_count}</p>
                </div>
              </div>

              {selectedBriefing.briefing_summary && (
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    AI Summary
                  </span>
                  <p className="bg-gray-50 p-3 rounded border text-sm whitespace-pre-wrap">
                    {selectedBriefing.briefing_summary}
                  </p>
                </div>
              )}

              {selectedBriefing.top_anxieties && selectedBriefing.top_anxieties.length > 0 && (
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Top Anxieties
                  </span>
                  <div className="space-y-2">
                    {selectedBriefing.top_anxieties.map((anxiety: any, idx: number) => (
                      <div key={idx} className="bg-red-50 p-2 rounded border border-red-200">
                        <p className="font-bold text-sm">{anxiety.topic}</p>
                        <p className="text-xs text-gray-600">{anxiety.description}</p>
                        <span className="text-xs font-mono text-red-600">
                          Severity: {anxiety.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBriefing.top_topics && selectedBriefing.top_topics.length > 0 && (
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Top Topics
                  </span>
                  <div className="space-y-2">
                    {selectedBriefing.top_topics.map((topic: any, idx: number) => (
                      <div key={idx} className="bg-blue-50 p-2 rounded border border-blue-200">
                        <p className="font-bold text-sm">{topic.topic}</p>
                        <p className="text-xs text-gray-600">{topic.description}</p>
                        <span className="text-xs font-mono text-blue-600">
                          Relevance: {topic.relevance}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBriefing.top_questions && selectedBriefing.top_questions.length > 0 && (
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Top Questions
                  </span>
                  <div className="space-y-2">
                    {selectedBriefing.top_questions.map((question: any, idx: number) => (
                      <div key={idx} className="bg-green-50 p-2 rounded border border-green-200">
                        <p className="font-bold text-sm">{question.question}</p>
                        <p className="text-xs text-gray-600">Context: {question.context}</p>
                        <span className="text-xs font-mono text-green-600">
                          Priority: {question.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedBriefing.error_message && (
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">Error</span>
                  <p className="bg-red-100 p-3 rounded border border-red-300 text-red-800">
                    {selectedBriefing.error_message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
