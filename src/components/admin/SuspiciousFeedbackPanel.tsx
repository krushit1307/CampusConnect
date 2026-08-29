// src/components/admin/SuspiciousFeedbackPanel.tsx
// Issue: #5008 - Automated "Event Feedback" Linguistic Sentiment Drift
// Description: Admin interface for viewing flagged/coerced feedback

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { AlertTriangle, Eye, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SuspiciousFeedback {
  id: string;
  event_id: string;
  event_title: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string | null;
  keystroke_anomaly_score: number | null;
  sentiment_score: number | null;
  is_suspicious: boolean;
  weight_multiplier: number;
  coercion_flagged_at: string | null;
  avg_flight_time_ms: number | null;
  correction_rate: number | null;
}

export function SuspiciousFeedbackPanel() {
  const supabase = createClient();
  const [feedbacks, setFeedbacks] = useState<SuspiciousFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeedback, setSelectedFeedback] = useState<SuspiciousFeedback | null>(null);

  useEffect(() => {
    fetchSuspiciousFeedback();
  }, []);

  const fetchSuspiciousFeedback = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("event_feedbacks")
        .select(
          `
          id,
          event_id,
          user_id,
          rating,
          comment,
          keystroke_anomaly_score,
          sentiment_score,
          is_suspicious,
          weight_multiplier,
          coercion_flagged_at,
          avg_flight_time_ms,
          correction_rate,
          events!inner(title),
          profiles!inner(full_name)
        `,
        )
        .eq("is_suspicious", true)
        .order("coercion_flagged_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const formattedData = (data || []).map((f: any) => ({
        id: f.id,
        event_id: f.event_id,
        event_title: f.events.title,
        user_id: f.user_id,
        user_name: f.profiles.full_name,
        rating: f.rating,
        comment: f.comment,
        keystroke_anomaly_score: f.keystroke_anomaly_score,
        sentiment_score: f.sentiment_score,
        is_suspicious: f.is_suspicious,
        weight_multiplier: f.weight_multiplier,
        coercion_flagged_at: f.coercion_flagged_at,
        avg_flight_time_ms: f.avg_flight_time_ms,
        correction_rate: f.correction_rate,
      }));

      setFeedbacks(formattedData);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to fetch suspicious feedback");
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSuspicion = async (feedbackId: string, markAsGenuine: boolean) => {
    try {
      const { error } = await supabase
        .from("event_feedbacks")
        .update({
          is_suspicious: !markAsGenuine,
          weight_multiplier: markAsGenuine ? 1.0 : 0.0,
        })
        .eq("id", feedbackId);

      if (error) throw error;

      toast.success(markAsGenuine ? "Feedback marked as genuine" : "Feedback marked as suspicious");
      fetchSuspiciousFeedback();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update feedback");
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
          <h2 className="text-2xl font-bold font-display uppercase">Suspicious Feedback</h2>
          <p className="text-sm text-gray-600 font-mono mt-1">
            Reviews flagged as potentially coerced based on keystroke analysis
          </p>
        </div>
        <Button onClick={fetchSuspiciousFeedback} variant="outline">
          Refresh
        </Button>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <p className="font-mono text-gray-600">No suspicious feedback detected</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="border-2 border-red-300 bg-red-50 rounded-lg p-4 hover:bg-red-100 transition-colors cursor-pointer"
              onClick={() => setSelectedFeedback(feedback)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="font-bold text-red-900">{feedback.event_title}</span>
                    <span className="text-sm text-gray-600">by {feedback.user_name}</span>
                  </div>

                  <div className="flex items-center gap-4 text-sm font-mono text-gray-700 mb-2">
                    <span>Rating: {feedback.rating}/5</span>
                    <span>Sentiment: {feedback.sentiment_score?.toFixed(2)}</span>
                    <span>Anomaly Score: {feedback.keystroke_anomaly_score?.toFixed(1)}</span>
                    <span>Weight: {(feedback.weight_multiplier * 100).toFixed(0)}%</span>
                  </div>

                  {feedback.comment && (
                    <p className="text-sm text-gray-800 bg-white p-2 rounded border border-red-200 mt-2">
                      {feedback.comment}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOverrideSuspicion(feedback.id, true);
                    }}
                    className="border-green-500 text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Mark Genuine
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOverrideSuspicion(feedback.id, false);
                    }}
                    className="border-red-500 text-red-700 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Confirm Suspicious
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedFeedback && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedFeedback(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold font-display uppercase">Feedback Details</h3>
              <Button variant="ghost" onClick={() => setSelectedFeedback(null)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">Event</span>
                <p className="font-bold">{selectedFeedback.event_title}</p>
              </div>

              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">User</span>
                <p>{selectedFeedback.user_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Rating
                  </span>
                  <p className="font-bold">{selectedFeedback.rating}/5</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Sentiment Score
                  </span>
                  <p className="font-bold">{selectedFeedback.sentiment_score?.toFixed(2)}</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Anomaly Score
                  </span>
                  <p className="font-bold text-red-600">
                    {selectedFeedback.keystroke_anomaly_score?.toFixed(1)}
                  </p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Weight Multiplier
                  </span>
                  <p className="font-bold">
                    {(selectedFeedback.weight_multiplier * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Avg Flight Time
                  </span>
                  <p>{selectedFeedback.avg_flight_time_ms?.toFixed(0)}ms</p>
                </div>
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Correction Rate
                  </span>
                  <p>{(selectedFeedback.correction_rate * 100).toFixed(1)}%</p>
                </div>
              </div>

              {selectedFeedback.comment && (
                <div>
                  <span className="font-mono text-xs uppercase font-bold text-gray-500">
                    Comment
                  </span>
                  <p className="bg-gray-50 p-3 rounded border">{selectedFeedback.comment}</p>
                </div>
              )}

              <div>
                <span className="font-mono text-xs uppercase font-bold text-gray-500">
                  Flagged At
                </span>
                <p>{new Date(selectedFeedback.coercion_flagged_at || "").toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
