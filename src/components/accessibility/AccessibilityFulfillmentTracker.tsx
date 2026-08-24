// =============================================================================
// File: src/components/accessibility/AccessibilityFulfillmentTracker.tsx
// Issue: #4307 - Build a 'Real-Time "Accessibility Need" Fulfillment Tracker'
// Description: Real-time 4-step "Pizza Tracker" interface for disability accommodations,
//              certified provider dispatch, SLA countdowns, and compliance reporting.
// =============================================================================

import React, { useState, useMemo } from "react";
import {
  Accessibility,
  CheckCircle2,
  Clock,
  UserCheck,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  FileSpreadsheet,
  Download,
  Search,
  Filter,
  Sparkles,
  ShieldCheck,
  Building,
  Calendar,
  ChevronRight,
  UserPlus,
  ArrowRight,
  Headphones,
  FileText,
  HeartHandshake,
  Utensils,
  Eye,
  Ear,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  AccommodationRequest,
  AccommodationCategory,
  FulfillmentStage,
  AccommodationProvider,
} from "@/types/accessibilityTracker";
import {
  ACCOMMODATION_CATEGORY_METADATA,
  MOCK_VERIFIED_PROVIDERS,
  getMockAccommodationRequests,
  buildFulfillmentSteps,
  updateAccommodationStage,
  exportAccessibilityAuditCSV,
} from "@/services/accessibilityTrackerService";

interface AccessibilityFulfillmentTrackerProps {
  initialRequests?: AccommodationRequest[];
  currentUserId?: string;
  isCoordinatorRole?: boolean;
}

export const AccessibilityFulfillmentTracker: React.FC<AccessibilityFulfillmentTrackerProps> = ({
  initialRequests,
  currentUserId = "usr-student-01",
  isCoordinatorRole = true,
}) => {
  const [requests, setRequests] = useState<AccommodationRequest[]>(
    initialRequests || getMockAccommodationRequests()
  );

  const [selectedRequestId, setSelectedRequestId] = useState<string>(
    requests[0]?.id || "req-4307-01"
  );
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
  const [targetStage, setTargetStage] = useState<FulfillmentStage>("provider_assigned");
  const [selectedProviderId, setSelectedProviderId] = useState<string>(MOCK_VERIFIED_PROVIDERS[0].id);
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Active selected request
  const selectedRequest = useMemo(() => {
    return requests.find((r) => r.id === selectedRequestId) || requests[0];
  }, [requests, selectedRequestId]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (selectedCategoryFilter !== "all" && req.category !== selectedCategoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = req.eventTitle.toLowerCase().includes(q);
        const matchesName = req.requesterName.toLowerCase().includes(q);
        const matchesVenue = req.eventVenue.toLowerCase().includes(q);
        if (!matchesTitle && !matchesName && !matchesVenue) return false;
      }
      return true;
    });
  }, [requests, selectedCategoryFilter, searchQuery]);

  // Handle stage transition
  const handleAdvanceStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setIsUpdating(true);
    const assignedProv = MOCK_VERIFIED_PROVIDERS.find((p) => p.id === selectedProviderId);

    await updateAccommodationStage(
      selectedRequest.id,
      targetStage,
      selectedProviderId,
      customInstructions
    );

    setRequests((prev) =>
      prev.map((req) => {
        if (req.id === selectedRequest.id) {
          const now = new Date().toISOString();
          return {
            ...req,
            currentStage: targetStage,
            updatedAt: now,
            assignedProvider:
              targetStage === "provider_assigned" || targetStage === "confirmed_on_site"
                ? assignedProv || req.assignedProvider
                : req.assignedProvider,
            specialInstructions: customInstructions || req.specialInstructions,
            steps: buildFulfillmentSteps(
              targetStage,
              req.createdAt,
              now,
              assignedProv || req.assignedProvider
            ),
          };
        }
        return req;
      })
    );

    setIsUpdating(false);
    setIsUpdateModalOpen(false);
  };

  const getCategoryIcon = (cat: AccommodationCategory) => {
    switch (cat) {
      case "asl_interpreter":
        return <Ear className="h-5 w-5 text-blue-500" />;
      case "wheelchair_seating":
        return <Accessibility className="h-5 w-5 text-emerald-500" />;
      case "live_captioning_cart":
        return <FileText className="h-5 w-5 text-purple-500" />;
      case "assistive_listening_device":
        return <Headphones className="h-5 w-5 text-amber-500" />;
      case "sensory_quiet_room":
        return <Sparkles className="h-5 w-5 text-pink-500" />;
      case "dietary_anaphylaxis_kit":
        return <Utensils className="h-5 w-5 text-rose-500" />;
      case "service_animal_escort":
        return <HeartHandshake className="h-5 w-5 text-teal-500" />;
      case "tactile_braille_guide":
        return <Eye className="h-5 w-5 text-indigo-500" />;
      default:
        return <Accessibility className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Audit Controls */}
      <div className="neu-border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center border-2 border-black bg-lime dark:bg-lime-400">
                <Accessibility className="h-5 w-5 text-black" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-zinc-900 dark:text-white">
                Accessibility Fulfillment Tracker
              </h2>
            </div>
            <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Live 4-Stage Accommodation Intake, Certified Provider Dispatch & On-Site Verification
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAccessibilityAuditCSV(requests)}
              className="neu-border flex items-center gap-1.5 bg-zinc-100 font-mono text-xs font-bold uppercase text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export ADA Audit CSV
            </Button>

            {isCoordinatorRole && (
              <Button
                size="sm"
                onClick={() => setIsUpdateModalOpen(true)}
                className="neu-border flex items-center gap-1.5 bg-lime font-mono text-xs font-bold uppercase text-black hover:bg-lime/80"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Manage Request Status
              </Button>
            )}
          </div>
        </div>

        {/* Global Summary KPI Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Active Requests
            </span>
            <div className="mt-1 font-mono text-xl font-black text-zinc-900 dark:text-white">
              {requests.length} Requests
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Intake active</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              On-Site Confirmed
            </span>
            <div className="mt-1 font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
              {requests.filter((r) => r.currentStage === "confirmed_on_site").length} Fully Ready
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Verified & Stationed</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              Provider Assigned
            </span>
            <div className="mt-1 font-mono text-xl font-black text-blue-600 dark:text-blue-400">
              {requests.filter((r) => r.currentStage === "provider_assigned").length} In Dispatch
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Certified specialists</span>
          </div>

          <div className="neu-border bg-zinc-50 p-3 dark:bg-zinc-800">
            <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
              SLA Compliance
            </span>
            <div className="mt-1 font-mono text-xl font-black text-purple-600 dark:text-purple-400">
              100% on-time
            </div>
            <span className="font-mono text-[10px] text-zinc-500">Zero unfulfilled events</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Interface: Left Requests Sidebar & Right Live Tracker Stage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Col: Requests Selector & Filter (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <div className="neu-border bg-white p-4 dark:bg-zinc-900">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search event or requester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="neu-border w-full bg-zinc-50 p-1.5 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            {/* Category Filter */}
            <select
              aria-label="Filter Accommodation Category"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="neu-border mb-3 w-full bg-zinc-50 p-1.5 font-mono text-xs font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
            >
              <option value="all">All Accommodation Needs</option>
              {Object.entries(ACCOMMODATION_CATEGORY_METADATA).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            {/* Request Cards List */}
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredRequests.map((req) => {
                const isSelected = req.id === selectedRequestId;
                const meta = ACCOMMODATION_CATEGORY_METADATA[req.category];

                return (
                  <div
                    key={req.id}
                    onClick={() => setSelectedRequestId(req.id)}
                    className={`neu-border cursor-pointer p-3 transition-all duration-150 ${
                      isSelected
                        ? "bg-black text-white dark:bg-lime dark:text-black shadow-[4px_4px_0_0_#000]"
                        : "bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider">
                        {req.id}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-black uppercase ${
                          req.currentStage === "confirmed_on_site"
                            ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
                            : req.currentStage === "provider_assigned"
                            ? "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                            : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                        }`}
                      >
                        {req.currentStage.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h4 className="font-mono text-xs font-black truncate">{req.eventTitle}</h4>
                    <p
                      className={`mt-0.5 truncate font-mono text-[11px] ${
                        isSelected ? "text-zinc-200 dark:text-zinc-800" : "text-zinc-500"
                      }`}
                    >
                      {meta.label}
                    </p>

                    <div className="mt-2 flex items-center justify-between font-mono text-[10px] opacity-80">
                      <span>{req.requesterName}</span>
                      <span>{new Date(req.eventDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Domino's Pizza Tracker Stage & Details (8 cols) */}
        <div className="space-y-6 lg:col-span-8">
          {selectedRequest && (
            <>
              {/* Domino's Pizza Tracker Visual Card */}
              <div className="neu-border bg-white p-6 dark:bg-zinc-900">
                <div className="flex items-center justify-between border-b-2 border-black pb-4 dark:border-zinc-700">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-black bg-zinc-100 dark:bg-zinc-800">
                      {getCategoryIcon(selectedRequest.category)}
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-zinc-900 dark:text-white">
                        {ACCOMMODATION_CATEGORY_METADATA[selectedRequest.category].label}
                      </h3>
                      <p className="font-mono text-xs text-zinc-500">
                        {selectedRequest.eventTitle} • {selectedRequest.eventVenue}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-[10px] font-bold uppercase text-zinc-400">
                      Requester
                    </span>
                    <p className="font-mono text-xs font-bold text-zinc-900 dark:text-white">
                      {selectedRequest.requesterName}
                    </p>
                  </div>
                </div>

                {/* 4-Step Linear Domino's Progress Bar */}
                <div className="mt-8">
                  <div className="relative grid grid-cols-4 gap-2">
                    {selectedRequest.steps.map((step, idx) => (
                      <div key={step.stage} className="relative flex flex-col items-center text-center">
                        {/* Connecting Line */}
                        {idx < selectedRequest.steps.length - 1 && (
                          <div
                            className={`absolute top-4 left-1/2 w-full h-1 -z-0 transition-colors ${
                              step.isCompleted
                                ? "bg-emerald-500 dark:bg-emerald-400"
                                : "bg-zinc-200 dark:bg-zinc-800"
                            }`}
                          />
                        )}

                        {/* Step Circle Indicator */}
                        <div
                          className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-black font-mono text-xs font-black transition-all ${
                            step.isCurrent
                              ? "bg-lime text-black ring-4 ring-lime/40 animate-pulse"
                              : step.isCompleted
                              ? "bg-emerald-500 text-white"
                              : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                          }`}
                        >
                          {step.isCompleted ? (
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        {/* Step Label */}
                        <span className="mt-2 font-mono text-xs font-black uppercase text-zinc-900 dark:text-white">
                          {step.title.split(". ")[1]}
                        </span>
                        <p className="mt-0.5 font-mono text-[10px] text-zinc-500 line-clamp-2 px-1">
                          {step.description}
                        </p>
                        {step.completedAt && (
                          <span className="mt-1 font-mono text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                            {new Date(step.completedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Provider Identification & On-Site Station Card */}
              {selectedRequest.assignedProvider ? (
                <div className="neu-border border-emerald-500 bg-emerald-50/60 p-6 dark:border-emerald-700 dark:bg-emerald-950/30">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-mono text-sm font-black uppercase text-emerald-950 dark:text-emerald-200">
                        Assigned Certified Professional
                      </h4>
                    </div>
                    <span className="rounded bg-emerald-200 px-2 py-0.5 font-mono text-[10px] font-black uppercase text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                      Status: {selectedRequest.assignedProvider.checkInStatus.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
                        Provider Name & Credentials
                      </span>
                      <p className="font-mono text-base font-black text-zinc-900 dark:text-white">
                        {selectedRequest.assignedProvider.name}
                      </p>
                      <p className="font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {selectedRequest.assignedProvider.agencyOrDepartment}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedRequest.assignedProvider.certifications.map((c) => (
                          <span
                            key={c}
                            className="rounded bg-white px-1.5 py-0.5 font-mono text-[9px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 font-mono text-xs">
                      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        <span>
                          <strong>On-Site Station:</strong>{" "}
                          {selectedRequest.assignedProvider.onSiteLocationBadge}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <Phone className="h-4 w-4 text-blue-600" />
                        <span>{selectedRequest.assignedProvider.contactPhone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <Mail className="h-4 w-4 text-purple-600" />
                        <span>{selectedRequest.assignedProvider.contactEmail}</span>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.specialInstructions && (
                    <div className="mt-4 border-t border-emerald-200 pt-3 dark:border-emerald-800">
                      <span className="font-mono text-[10px] font-bold uppercase text-zinc-500">
                        On-Site Instructions for Requester
                      </span>
                      <p className="font-mono text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">
                        {selectedRequest.specialInstructions}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="neu-border bg-amber-50/70 p-6 dark:bg-amber-950/30 border-amber-500">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <Clock className="h-5 w-5 text-amber-600" />
                    <h4 className="font-mono text-sm font-black uppercase">
                      Provider Dispatch In Progress
                    </h4>
                  </div>
                  <p className="mt-1 font-mono text-xs text-amber-800 dark:text-amber-300">
                    The Disability Resource Office is currently contracting a qualified certified
                    provider for this event. You will receive an immediate live notification as soon
                    as the specialist is confirmed!
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Coordinator Status Update Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="neu-border max-w-lg bg-white p-6 dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-zinc-900 dark:text-white">
              Advance Accommodation Status
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-zinc-500">
              Update fulfillment stage and assign certified service providers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAdvanceStage} className="mt-4 space-y-4 font-mono text-xs">
            <div>
              <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                Target Fulfillment Stage
              </label>
              <select
                aria-label="Target Fulfillment Stage"
                value={targetStage}
                onChange={(e) => setTargetStage(e.target.value as FulfillmentStage)}
                className="neu-border w-full bg-zinc-50 p-2 font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
              >
                <option value="requested">1. Request Submitted</option>
                <option value="approved">2. Underwriting & Approved</option>
                <option value="provider_assigned">3. Certified Provider Assigned</option>
                <option value="confirmed_on_site">4. On-Site Check-In Confirmed</option>
              </select>
            </div>

            {(targetStage === "provider_assigned" || targetStage === "confirmed_on_site") && (
              <div>
                <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                  Assign Certified Service Provider
                </label>
                <select
                  aria-label="Assign Certified Service Provider"
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="neu-border w-full bg-zinc-50 p-2 font-bold text-zinc-800 dark:bg-zinc-800 dark:text-white"
                >
                  {MOCK_VERIFIED_PROVIDERS.map((prov) => (
                    <option key={prov.id} value={prov.id}>
                      {prov.name} ({prov.agencyOrDepartment})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-bold uppercase text-zinc-700 dark:text-zinc-300 mb-1">
                On-Site Instructions / Room Details
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Interpreter will be stationed Stage Left next to podium. Reserved Row 1."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                className="neu-border w-full bg-zinc-50 p-2 text-zinc-800 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <Button
              type="submit"
              disabled={isUpdating}
              className="neu-border w-full bg-lime font-mono text-xs font-black uppercase text-black hover:bg-lime/80"
            >
              {isUpdating ? "Broadcasting Update..." : "Confirm & Broadcast Update"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessibilityFulfillmentTracker;
