import React from "react";
import { m, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Search,
  Truck,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  PhoneCall,
  User,
  Sparkles,
  MapPin,
  Flame,
} from "lucide-react";
import {
  AccommodationRequest,
  FulfillmentStage,
} from "@/types/accessibilityFulfillment";
import {
  CATEGORY_CONFIGS,
  STAGE_CONFIGS,
  accessibilityFulfillmentService,
} from "@/services/accessibilityFulfillmentService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DominosProgressTrackerProps {
  request: AccommodationRequest;
  onAdvanceStage?: () => void;
  isStaffView?: boolean;
}

const STAGE_ICONS: Record<FulfillmentStage, React.ElementType> = {
  submitted: ClipboardCheck,
  triaged: Search,
  dispatched: Truck,
  in_progress: Wrench,
  completed: CheckCircle2,
};

export const DominosProgressTracker: React.FC<DominosProgressTrackerProps> = ({
  request,
  onAdvanceStage,
  isStaffView = false,
}) => {
  const currentStageIndex = STAGE_CONFIGS.findIndex(
    (s) => s.stage === request.currentStage,
  );

  const categoryConfig = CATEGORY_CONFIGS.find(
    (c) => c.id === request.category,
  );

  const currentStageConfig = STAGE_CONFIGS[currentStageIndex];

  // Calculate percentage of pizza tracker progress bar
  const progressPercent = Math.min(
    100,
    Math.max(0, (currentStageIndex / (STAGE_CONFIGS.length - 1)) * 100),
  );

  const isCompleted = request.currentStage === "completed";
  const isDelayed = request.status === "delayed";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* Background Ambient Glow tailored by status */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-20 blur-3xl transition-all duration-700"
        style={{
          backgroundColor: isCompleted
            ? "#10B981"
            : isDelayed
            ? "#EF4444"
            : categoryConfig?.color || "#3B82F6",
        }}
      />

      {/* Header Info Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400">
              {request.id}
            </span>
            {categoryConfig && (
              <Badge className={`${categoryConfig.badgeBg} text-xs font-medium`}>
                {categoryConfig.name}
              </Badge>
            )}
            {request.urgency === "immediate" && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/40 flex items-center gap-1 text-xs animate-pulse">
                <Flame className="h-3 w-3" /> Urgent Dispatch
              </Badge>
            )}
          </div>
          <h2 className="mt-1 text-xl font-bold text-white tracking-tight flex items-center gap-2">
            {request.accommodationType}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-medium text-slate-300">
              {request.buildingName}
            </span>
            {request.roomNumber && ` (${request.roomNumber})`} •{" "}
            <span className="text-slate-500">{request.eventOrLocation}</span>
          </p>
        </div>

        {/* Live Status & ETA Box */}
        <div className="flex items-center gap-4 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 self-start sm:self-auto">
          {isCompleted ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <div className="text-xs text-emerald-500 font-semibold uppercase">
                  Fulfillment Verified
                </div>
                <div className="text-sm font-bold">Service Active</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
                <Clock className="h-5 w-5 animate-spin" style={{ animationDuration: "12s" }} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Estimated Arrival (ETA)
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black tracking-tight text-white">
                    {request.etaMinutes}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    mins
                  </span>
                  {isDelayed && (
                    <Badge variant="destructive" className="ml-1 text-[10px] py-0">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5 inline" /> Delayed +5m
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Flagship Domino's Tracker Step Bar */}
      <div className="my-8 px-2 sm:px-6">
        <div className="relative">
          {/* Background Track Line */}
          <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-slate-800" />

          {/* Animated Filled Progress Track Line */}
          <m.div
            className={`absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full transition-all duration-700 ${
              isCompleted
                ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                : isDelayed
                ? "bg-gradient-to-r from-amber-500 to-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                : "bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            }`}
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />

          {/* 5 Milestones / Stage Circles */}
          <div className="relative z-10 flex justify-between items-center">
            {STAGE_CONFIGS.map((stageConfig, index) => {
              const IconComp = STAGE_ICONS[stageConfig.stage];
              const isPast = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isFuture = index > currentStageIndex;

              return (
                <div
                  key={stageConfig.stage}
                  className="flex flex-col items-center group relative cursor-default"
                >
                  {/* Stage Circle */}
                  <m.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${
                      isCurrent
                        ? "bg-slate-900 border-blue-400 text-blue-400 shadow-[0_0_25px_rgba(59,130,246,0.6)] ring-4 ring-blue-500/20"
                        : isPast
                        ? "bg-emerald-950/80 border-emerald-500 text-emerald-400 shadow-md"
                        : "bg-slate-950 border-slate-800 text-slate-600"
                    }`}
                  >
                    <IconComp
                      className={`h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-300 ${
                        isCurrent ? "scale-110 animate-bounce" : ""
                      }`}
                      style={{ animationDuration: "2s" }}
                    />

                    {/* Active Pulsing Ring Aura for Current Stage */}
                    {isCurrent && (
                      <span className="absolute -inset-1 rounded-2xl border border-blue-400/50 animate-ping pointer-events-none opacity-40" />
                    )}

                    {/* Step Number Badge */}
                    <span
                      className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isPast
                          ? "bg-emerald-500 text-slate-950"
                          : isCurrent
                          ? "bg-blue-500 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </m.div>

                  {/* Stage Label & Time */}
                  <div className="mt-3 text-center">
                    <span
                      className={`block text-xs font-semibold sm:text-sm tracking-tight ${
                        isCurrent
                          ? "text-blue-300 font-bold"
                          : isPast
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      {stageConfig.label}
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-0.5 hidden sm:block">
                      {isPast
                        ? "Done"
                        : isCurrent
                        ? "Active Phase"
                        : `~${stageConfig.estimatedDurationMins}m`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Stage Detail & Action Callout */}
      <AnimatePresence mode="wait">
        <m.div
          key={request.currentStage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-5 backdrop-blur-sm"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Current Status: {currentStageConfig.label}
                </span>
              </div>
              <p className="text-sm text-slate-300 font-medium">
                {currentStageConfig.detailedDescription}
              </p>
            </div>

            {/* Dispatched Specialist Info Box if available */}
            {request.dispatcher && (
              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/90 p-2.5 self-start sm:self-auto shrink-0">
                <img
                  src={request.dispatcher.avatar}
                  alt={request.dispatcher.name}
                  className="h-10 w-10 rounded-full object-cover border border-blue-500/40"
                />
                <div className="text-xs">
                  <div className="font-bold text-white flex items-center gap-1">
                    {request.dispatcher.name}
                  </div>
                  <div className="text-slate-400 font-medium text-[11px]">
                    {request.dispatcher.role}
                  </div>
                  <a
                    href={`tel:${request.dispatcher.phone}`}
                    className="mt-0.5 text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 text-[11px]"
                  >
                    <PhoneCall className="h-3 w-3" /> {request.dispatcher.phone}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Quick Simulation / Advance Stage Controls for testing & staff */}
          <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-500 italic">
              * Tracker updates in real-time. Audio announcements active for screen readers.
            </div>

            <div className="flex items-center gap-2">
              {isStaffView && !isCompleted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    accessibilityFulfillmentService.setStatus(
                      request.id,
                      isDelayed ? "on_schedule" : "delayed",
                      isDelayed ? "Delay cleared." : "Equipment transport heavy traffic.",
                    )
                  }
                  className="text-xs h-8 border-slate-700 text-slate-300"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-400" />
                  {isDelayed ? "Clear Delay" : "Report Delay"}
                </Button>
              )}

              {!isCompleted && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (onAdvanceStage) {
                      onAdvanceStage();
                    } else {
                      accessibilityFulfillmentService.advanceStage(request.id);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs h-8 shadow-md"
                >
                  <span>Advance Stage</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </m.div>
      </AnimatePresence>
    </div>
  );
};
