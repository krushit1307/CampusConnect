import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  Zap,
  CheckCircle2,
  Clock,
  Gauge,
  Radio,
  Server,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  WebhookResponseHeaders,
  WebhookDispatchResult,
  processCrmWebhookResponse,
} from "@/lib/sponsorCrmRateLimitBackpressure";
import { cn } from "@/lib/utils";

export interface SponsorCrmRateLimitBackpressureWidgetProps {
  sponsorId?: string;
  sponsorName?: string;
  crmTargetUrl?: string;
  onBackpressureTriggered?: (result: WebhookDispatchResult) => void;
  className?: string;
}

export const SponsorCrmRateLimitBackpressureWidget: React.FC<SponsorCrmRateLimitBackpressureWidgetProps> = ({
  sponsorId = "sponsor-salesforce-101",
  sponsorName = "TechCorp Global (Salesforce CRM)",
  crmTargetUrl = "https://salesforce.techcorp.com/api/v1/leads",
  onBackpressureTriggered,
  className,
}) => {
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [retryAfterTimer, setRetryAfterTimer] = useState<number>(0);
  const [currentRatePerSec, setCurrentRatePerSec] = useState<number>(10);
  const [lastResult, setLastResult] = useState<WebhookDispatchResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Backpressure Countdown Timer Effect
  useEffect(() => {
    if (retryAfterTimer <= 0) {
      if (isPaused) {
        setIsPaused(false);
        setNotice("Backpressure delay elapsed! Resuming SQS queue consumer at throttled rate (5 req/sec).");
        setTimeout(() => setNotice(null), 5000);
      }
      return;
    }

    const timer = setInterval(() => {
      setRetryAfterTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [retryAfterTimer, isPaused]);

  const handleSimulateHttp429 = () => {
    const headers: WebhookResponseHeaders = {
      "retry-after": "60",
      "x-ratelimit-remaining": "0",
    };

    const result = processCrmWebhookResponse(sponsorId, crmTargetUrl, 429, headers);

    setLastResult(result);
    setIsPaused(true);
    setRetryAfterTimer(result.retryAfterSeconds);
    setCurrentRatePerSec(result.nextThrottledRatePerSec);

    if (onBackpressureTriggered) onBackpressureTriggered(result);

    setNotice(
      `HTTP 429 Rate Limit Detected from Salesforce! SQS Queue Consumer paused for ${result.retryAfterSeconds}s and throttled to ${result.nextThrottledRatePerSec} req/sec.`
    );
    setTimeout(() => setNotice(null), 6000);
  };

  const handleSimulateHttp200 = () => {
    const result = processCrmWebhookResponse(sponsorId, crmTargetUrl, 200);

    setLastResult(result);
    setIsPaused(false);
    setRetryAfterTimer(0);
    setCurrentRatePerSec(result.nextThrottledRatePerSec);

    setNotice("Webhook payload delivered successfully! SQS queue operating at normal rate (10 req/sec).");
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-rose-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-rose-950">
            <ShieldAlert className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>"Sponsor Lead" CRM Webhook Rate Limit Backpressure — {sponsorName}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Dynamic HTTP 429 Retry-After header parsing. Pauses SQS queue consumers and applies backpressure to prevent IP blacklisting on target CRM servers.
          </p>
        </div>

        <span
          className={cn(
            "px-3 py-1 font-bold text-xs uppercase rounded border border-black flex items-center gap-1.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]",
            isPaused ? "bg-rose-600 text-white animate-pulse" : "bg-emerald-600 text-white"
          )}
        >
          {isPaused ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
          <span>{isPaused ? "🔴 SQS CONSUMER PAUSED (429)" : "🟢 SQS CONSUMER ACTIVE"}</span>
        </span>
      </div>

      {/* Confirmation Notification Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Grid: Consumer Rate Metrics & Backpressure Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Left Column: SQS Queue Consumer Controls & Metrics */}
        <div className="p-5 border-b-2 md:border-b-0 md:border-r-2 border-black space-y-4 bg-white">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Gauge className="w-4 h-4 text-rose-600" />
            Queue Rate & Throttling Metrics
          </h4>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border-2 border-black rounded-lg bg-rose-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Retry-After Delay</span>
              <span className="font-black text-lg text-rose-900 font-mono">
                {retryAfterTimer > 0 ? `${retryAfterTimer}s` : "0s"}
              </span>
              <p className="text-[10px] font-sans text-gray-600">Countdown timer</p>
            </div>

            <div className="p-3 border-2 border-black rounded-lg bg-emerald-50 space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Throttled Queue Rate</span>
              <span className="font-black text-lg text-emerald-900 font-mono">
                {currentRatePerSec} req/sec
              </span>
              <p className="text-[10px] font-sans text-gray-600">{isPaused ? "Paused" : "Active"}</p>
            </div>
          </div>

          <div className="p-3.5 border-2 border-black rounded-lg bg-slate-50 space-y-1 text-xs font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[10px] font-bold text-gray-500 uppercase block">Target CRM Webhook URL:</span>
            <span className="font-bold text-gray-900 text-[11px] block truncate">{crmTargetUrl}</span>
          </div>

          {/* Simulation Trigger Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleSimulateHttp429}
              className="w-full py-3 px-4 border-2 border-black bg-rose-600 text-white font-bold text-xs uppercase rounded-md hover:bg-rose-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <PauseCircle className="w-4 h-4 text-amber-300" />
              <span>Simulate HTTP 429 (Retry-After: 60s)</span>
            </button>

            <button
              type="button"
              onClick={handleSimulateHttp200}
              className="w-full py-2.5 px-4 border-2 border-black bg-emerald-500 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>Simulate HTTP 200 Success Response</span>
            </button>
          </div>
        </div>

        {/* Right Column: Webhook Response Audit & Backpressure Log */}
        <div className="p-5 bg-slate-50 space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
            <Radio className="w-4 h-4 text-rose-600" />
            Sponsor Webhook Response Audit Log
          </h4>

          {lastResult ? (
            <div className="p-4 border-2 border-black rounded-lg bg-slate-900 text-white space-y-3 font-mono text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <div className="flex justify-between items-center text-[10px] text-rose-400 font-bold border-b border-slate-700 pb-2">
                <span>DISPATCH ID: {lastResult.dispatchId}</span>
                <span className={cn(lastResult.statusCode === 429 ? "text-rose-400" : "text-emerald-400")}>
                  HTTP {lastResult.statusCode}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-gray-300">
                <p>Backpressure Triggered: <span className="font-bold text-white">{lastResult.backpressureTriggered ? "YES" : "NO"}</span></p>
                <p>Retry-After Delay: <span className="font-bold text-rose-300">{lastResult.retryAfterSeconds}s</span></p>
                <p>Adjusted Rate: <span className="font-bold text-emerald-400">{lastResult.nextThrottledRatePerSec} req/sec</span></p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-gray-500 bg-white border-2 border-black border-dashed rounded-lg">
              No webhook responses logged yet. Click "Simulate HTTP 429" to test backpressure parsing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
