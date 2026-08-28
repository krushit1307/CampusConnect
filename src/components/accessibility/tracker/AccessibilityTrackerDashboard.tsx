import React, { useEffect, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  AccommodationRequest,
  FulfillmentMetrics,
} from "@/types/accessibilityFulfillment";
import {
  CATEGORY_CONFIGS,
  accessibilityFulfillmentService,
} from "@/services/accessibilityFulfillmentService";
import { DominosProgressTracker } from "./DominosProgressTracker";
import { DispatcherLiveMap } from "./DispatcherLiveMap";
import { AccommodationRequestModal } from "./AccommodationRequestModal";
import { StaffCommandCenter } from "./StaffCommandCenter";
import { FulfillmentMetricsBar } from "./FulfillmentMetricsBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Accessibility,
  Play,
  Pause,
  Plus,
  Shield,
  User,
  MessageSquare,
  History,
  Star,
  Send,
  Sparkles,
  Info,
  Check,
} from "lucide-react";

export const AccessibilityTrackerDashboard: React.FC = () => {
  const [requests, setRequests] = useState<AccommodationRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"student" | "staff">("student");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [metrics, setMetrics] = useState<FulfillmentMetrics>(
    accessibilityFulfillmentService.getMetrics(),
  );

  // Feedback form state
  const [rating, setRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [newLogNote, setNewLogNote] = useState<string>("");

  useEffect(() => {
    // Initial fetch
    const reqs = accessibilityFulfillmentService.getAllRequests();
    setRequests(reqs);

    if (reqs.length > 0 && !selectedRequestId) {
      setSelectedRequestId(reqs[0].id);
    }
    setMetrics(accessibilityFulfillmentService.getMetrics());

    // Subscribe to updates
    const unsubscribe = accessibilityFulfillmentService.subscribe(() => {
      const updatedReqs = accessibilityFulfillmentService.getAllRequests();
      setRequests(updatedReqs);
      setMetrics(accessibilityFulfillmentService.getMetrics());
    });

    return () => {
      unsubscribe();
    };
  }, [selectedRequestId]);

  const selectedRequest =
    requests.find((r) => r.id === selectedRequestId) || requests[0];

  const handleToggleSimulation = () => {
    if (isSimulating) {
      accessibilityFulfillmentService.stopSimulation();
      setIsSimulating(false);
    } else {
      accessibilityFulfillmentService.startSimulation();
      setIsSimulating(true);
    }
  };

  const handleAddTimelineNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogNote.trim() || !selectedRequest) return;

    accessibilityFulfillmentService.addTimelineNote(
      selectedRequest.id,
      newLogNote,
      viewMode === "staff" ? "Access Ops Staff" : selectedRequest.studentName,
      viewMode === "staff" ? "staff" : "student",
    );

    setNewLogNote("");
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    accessibilityFulfillmentService.submitFeedback(
      selectedRequest.id,
      rating,
      feedbackComment,
    );
    setFeedbackComment("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Accessibility className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Real-Time Accessibility Tracker
                </h1>
                <Badge className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs border-0 shadow-md">
                  Domino's Pizza Tracker UX
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Instant accommodation fulfillment tracking for ramps, ASL interpreters, quiet exam rooms & assistive tech.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Simulation Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleSimulation}
            className="border-slate-800 bg-slate-900/80 text-xs font-medium text-slate-300 hover:text-white"
          >
            {isSimulating ? (
              <>
                <Pause className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                <span>Pause Auto Simulation</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                <span>Start Live Simulation</span>
              </>
            )}
          </Button>

          {/* View Switcher: Student vs Staff */}
          <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setViewMode("student")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "student"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <User className="h-3.5 w-3.5" />
              <span>Student View</span>
            </button>
            <button
              onClick={() => setViewMode("staff")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "staff"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Staff Desk</span>
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg"
          >
            <Plus className="h-4 w-4 mr-1" />
            Request Need
          </Button>
        </div>
      </div>

      {/* Metrics Banner */}
      <FulfillmentMetricsBar metrics={metrics} />

      {/* Main Content View Switcher */}
      {viewMode === "staff" ? (
        <div className="space-y-6">
          <StaffCommandCenter
            requests={requests}
            onSelectRequest={(r) => {
              setSelectedRequestId(r.id);
              setViewMode("student"); // Switch to pizza tracker for selected ticket
            }}
            selectedRequestId={selectedRequestId}
            onOpenNewModal={() => setIsModalOpen(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Active Tickets Switcher & Domino's Tracker */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Ticket Pills Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Active Requests:
              </span>
              {requests.map((req) => (
                <button
                  key={req.id}
                  onClick={() => setSelectedRequestId(req.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedRequestId === req.id
                      ? "bg-blue-600/20 border-blue-500 text-blue-300 ring-2 ring-blue-500/30"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <span className="font-mono font-bold">{req.id}</span>
                  <span className="truncate max-w-[120px]">{req.accommodationType}</span>
                </button>
              ))}
            </div>

            {/* Flagship Domino's Pizza Tracker UI */}
            {selectedRequest ? (
              <DominosProgressTracker
                request={selectedRequest}
                onAdvanceStage={() =>
                  accessibilityFulfillmentService.advanceStage(selectedRequest.id)
                }
                isStaffView={viewMode === "staff"}
              />
            ) : (
              <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
                No active accommodation requests found. Click "Request Need" to create one!
              </div>
            )}

            {/* Live Dispatch Map */}
            {selectedRequest && (
              <DispatcherLiveMap
                destination={selectedRequest.destinationLocation}
                destinationName={`${selectedRequest.buildingName}${
                  selectedRequest.roomNumber ? ` (${selectedRequest.roomNumber})` : ""
                }`}
                dispatcher={selectedRequest.dispatcher}
                etaMinutes={selectedRequest.etaMinutes}
              />
            )}
          </div>

          {/* Right Column: Timeline Log & Feedback Panel */}
          <div className="space-y-6">
            {/* Activity Log / Dispatch Feed */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <History className="h-4 w-4 text-blue-400" />
                  <span>Real-Time Timeline Logs</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                  {selectedRequest?.timelineLogs.length || 0} Events
                </Badge>
              </div>

              {/* Timeline list */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedRequest?.timelineLogs.map((log) => (
                  <div
                    key={log.id}
                    className="relative pl-4 border-l-2 border-slate-800 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{log.author}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-400 font-medium">{log.text}</p>
                  </div>
                ))}
              </div>

              {/* Post Quick Note */}
              <form onSubmit={handleAddTimelineNote} className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                <Textarea
                  rows={1}
                  placeholder="Send note to dispatch team..."
                  value={newLogNote}
                  onChange={(e) => setNewLogNote(e.target.value)}
                  className="border-slate-800 bg-slate-950 text-xs text-white resize-none"
                />
                <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-500 text-white shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>

            {/* Completion Rating & Feedback Card */}
            {selectedRequest && selectedRequest.currentStage === "completed" && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Rate Your Accommodation Service</span>
                </div>

                {selectedRequest.studentFeedback ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      {[...Array(selectedRequest.studentFeedback.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400" />
                      ))}
                      <span className="ml-1 text-white">
                        ({selectedRequest.studentFeedback.rating}/5)
                      </span>
                    </div>
                    {selectedRequest.studentFeedback.comment && (
                      <p className="text-slate-300 italic">
                        "{selectedRequest.studentFeedback.comment}"
                      </p>
                    )}
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      <Check className="h-3 w-3 mr-1 inline" /> Feedback Verified
                    </Badge>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitFeedback} className="space-y-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="p-1 text-amber-400 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              star <= rating ? "fill-amber-400" : "text-slate-600"
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    <Textarea
                      rows={2}
                      placeholder="Optional feedback for access ops..."
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      className="border-slate-800 bg-slate-950 text-xs text-white"
                    />

                    <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs w-full font-bold">
                      Submit Rating
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Accommodation Request Modal */}
      <AccommodationRequestModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRequestCreated={(newId) => {
          setSelectedRequestId(newId);
        }}
      />
    </div>
  );
};
