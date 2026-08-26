import React, { useState } from "react";
import {
  AccommodationRequest,
  FulfillmentStage,
  FulfillmentStatus,
} from "@/types/accessibilityFulfillment";
import {
  CATEGORY_CONFIGS,
  STAGE_CONFIGS,
  accessibilityFulfillmentService,
} from "@/services/accessibilityFulfillmentService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserCheck,
  Plus,
  RefreshCw,
} from "lucide-react";

interface StaffCommandCenterProps {
  requests: AccommodationRequest[];
  onSelectRequest: (request: AccommodationRequest) => void;
  selectedRequestId?: string;
  onOpenNewModal: () => void;
}

export const StaffCommandCenter: React.FC<StaffCommandCenterProps> = ({
  requests,
  onSelectRequest,
  selectedRequestId,
  onOpenNewModal,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const filteredRequests = requests.filter((r) => {
    const matchesSearch =
      r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.accommodationType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.buildingName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStage =
      stageFilter === "all"
        ? true
        : stageFilter === "active"
        ? r.currentStage !== "completed"
        : r.currentStage === stageFilter;

    return matchesSearch && matchesStage;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Access Ops Dispatch Command Desk
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Real-time fulfillment control, stage overrides & dispatcher assignment
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onOpenNewModal}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            <Plus className="h-4 w-4 mr-1" /> New Ticket
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => accessibilityFulfillmentService.resetToSample()}
            className="border-slate-800 text-slate-400 hover:text-white text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reset Demo
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="my-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search request #, student, venue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 border-slate-800 bg-slate-950 text-xs text-white"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {["all", "active", "submitted", "triaged", "dispatched", "in_progress", "completed"].map((filter) => (
            <button
              key={filter}
              onClick={() => setStageFilter(filter)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                stageFilter === filter
                  ? "bg-blue-600 text-white"
                  : "bg-slate-950 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {filter.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-3 px-3">Request ID</th>
              <th className="py-3 px-3">Student</th>
              <th className="py-3 px-3">Accommodation Type</th>
              <th className="py-3 px-3">Venue / Building</th>
              <th className="py-3 px-3">Domino's Stage</th>
              <th className="py-3 px-3">ETA</th>
              <th className="py-3 px-3 text-right">Dispatch Control</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No matching accessibility requests found.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => {
                const categoryConfig = CATEGORY_CONFIGS.find((c) => c.id === req.category);
                const stageConfig = STAGE_CONFIGS.find((s) => s.stage === req.currentStage);
                const isSelected = selectedRequestId === req.id;
                const isCompleted = req.currentStage === "completed";

                return (
                  <tr
                    key={req.id}
                    onClick={() => onSelectRequest(req)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-500/10 border-l-4 border-l-blue-500"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {req.id}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={req.studentAvatar}
                          alt={req.studentName}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                        <span className="font-semibold text-slate-200">{req.studentName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-white">{req.accommodationType}</div>
                      {categoryConfig && (
                        <span className="text-[10px] text-slate-400">{categoryConfig.name}</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-300">{req.buildingName}</div>
                      <div className="text-[10px] text-slate-500">{req.roomNumber || req.eventOrLocation}</div>
                    </td>

                    <td className="py-3 px-3">
                      <Badge
                        className={`text-[10px] font-semibold ${
                          isCompleted
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : req.status === "delayed"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {stageConfig?.label || req.currentStage}
                      </Badge>
                    </td>

                    <td className="py-3 px-3 font-bold text-white">
                      {isCompleted ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Done
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-blue-400" /> {req.etaMinutes}m
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {!isCompleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            accessibilityFulfillmentService.advanceStage(req.id);
                          }}
                          className="h-7 text-[11px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                        >
                          <span>Advance</span>
                          <ChevronRight className="h-3 w-3 ml-0.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
