// =============================================================================
// File: src/components/events/EarlyBirdSecretUrlManager.tsx
// Task: Dynamic "Early Bird" Secret URL Expiration
// Description: Neubrutalist management interface for event organizers to generate,
//              monitor, copy, and revoke time-limited & quota-bounded secret Early Bird links,
//              plus attendee claim banner component.
// =============================================================================

import React, { useState, useEffect } from "react";
import Lock from "lucide-react/dist/esm/icons/lock";
import Link from "lucide-react/dist/esm/icons/link";
import Copy from "lucide-react/dist/esm/icons/copy";
import Clock from "lucide-react/dist/esm/icons/clock";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Ban from "lucide-react/dist/esm/icons/ban";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert";
import Plus from "lucide-react/dist/esm/icons/plus";
import { toast } from "sonner";

import {
  generateEarlyBirdSecretUrl,
  validateEarlyBirdSecretUrl,
  redeemEarlyBirdSecretUrl,
  revokeEarlyBirdSecretUrl,
  getActiveSecretUrlsForEvent,
  type SecretUrlToken,
  type ExpirationRule,
} from "@/services/earlyBirdSecretUrlService";

export interface EarlyBirdSecretUrlManagerProps {
  eventId: string;
  eventTitle?: string;
  isOrganizer?: boolean;
  activeSecretToken?: string;
  onDiscountClaimed?: (discountPercent: number) => void;
}

export const EarlyBirdSecretUrlManager: React.FC<EarlyBirdSecretUrlManagerProps> = ({
  eventId,
  eventTitle = "Annual Campus Festival",
  isOrganizer = true,
  activeSecretToken,
  onDiscountClaimed,
}) => {
  const [tokens, setTokens] = useState<SecretUrlToken[]>([]);
  const [discountInput, setDiscountInput] = useState<number>(25);
  const [quotaInput, setQuotaInput] = useState<number>(50);
  const [durationHoursInput, setDurationHoursInput] = useState<number>(24);
  const [ruleInput, setRuleInput] = useState<ExpirationRule>("time_and_quota");

  // Attendee secret claim state
  const [attendeeClaimToken, setAttendeeClaimToken] = useState<string | null>(activeSecretToken || null);
  const [attendeeClaimResult, setAttendeeClaimResult] = useState(() =>
    activeSecretToken ? validateEarlyBirdSecretUrl(activeSecretToken) : null
  );

  // Live timer tick for real-time countdowns
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const activeList = getActiveSecretUrlsForEvent(eventId);
    if (activeList.length === 0) {
      // Seed an initial demo secret URL for testing
      const initial = generateEarlyBirdSecretUrl(
        eventId,
        eventTitle,
        25,
        50,
        24,
        "time_and_quota"
      );
      setTokens([initial]);
    } else {
      setTokens(activeList);
    }
  }, [eventId, eventTitle]);

  const handleGenerateSecretUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const newToken = generateEarlyBirdSecretUrl(
      eventId,
      eventTitle,
      discountInput,
      quotaInput,
      durationHoursInput,
      ruleInput
    );
    setTokens((prev) => [newToken, ...prev]);
    toast.success(`🎉 Secret URL created! ${newToken.discountPercent}% OFF for ${newToken.maxRedemptions} claims.`);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Secret Link copied to clipboard! 🔗");
  };

  const handleRevokeToken = (tokenStr: string) => {
    const ok = revokeEarlyBirdSecretUrl(tokenStr);
    if (ok) {
      setTokens((prev) =>
        prev.map((t) => (t.token === tokenStr ? { ...t, isRevoked: true } : t))
      );
      toast.error("Secret Link de-activated and revoked.");
    }
  };

  const handleClaimDiscount = () => {
    if (!attendeeClaimToken) return;
    const res = redeemEarlyBirdSecretUrl(attendeeClaimToken, "user-1", now);
    setAttendeeClaimResult(res);
    if (res.isValid) {
      toast.success(res.message);
      if (onDiscountClaimed) onDiscountClaimed(res.discountPercent);
    } else {
      toast.error(res.message);
    }
  };

  const formatCountdown = (expiresAtIso: string) => {
    const expiresMs = new Date(expiresAtIso).getTime();
    const diffSec = Math.max(0, Math.floor((expiresMs - now.getTime()) / 1000));
    if (diffSec <= 0) return "00h 00m 00s";

    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    return `${String(hours).padStart(2, "0")}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  };

  return (
    <div
      className="neu-border border-4 border-black bg-amber-50 p-6 shadow-[6px_6px_0_0_#000] space-y-6 dark:bg-zinc-900 dark:border-amber-500"
      data-testid="early-bird-secret-url-manager"
    >
      {/* Attendee Secret Link Claim Banner (when secretToken query param exists) */}
      {attendeeClaimToken && attendeeClaimResult && (
        <div
          className={`neu-border border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-3 ${
            attendeeClaimResult.isValid
              ? "bg-emerald-100 dark:bg-emerald-950"
              : "bg-rose-100 dark:bg-rose-950"
          }`}
          data-testid="attendee-secret-claim-banner"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-amber-600 animate-spin" />
              <div>
                <span className="font-mono text-[10px] font-bold uppercase bg-black text-white px-2 py-0.5">
                  VIP Secret Access Link
                </span>
                <h3 className="font-display font-black text-lg text-black dark:text-white">
                  {attendeeClaimResult.isValid
                    ? `🎉 You Unlocked ${attendeeClaimResult.discountPercent}% OFF Early Bird Price!`
                    : "⚠️ Early Bird Secret Link Unusable"}
                </h3>
              </div>
            </div>

            {attendeeClaimResult.isValid && (
              <span className="font-mono text-xs font-bold text-emerald-950 bg-emerald-300 border border-black px-3 py-1 flex items-center gap-1">
                <Clock className="h-4 w-4" /> Expires in: {formatCountdown(attendeeClaimResult.tokenData?.expiresAt || "")}
              </span>
            )}
          </div>

          <p className="font-mono text-xs text-gray-800 dark:text-gray-200">
            {attendeeClaimResult.message}
          </p>

          {attendeeClaimResult.isValid && (
            <button
              type="button"
              onClick={handleClaimDiscount}
              className="border-2 border-black bg-emerald-400 hover:bg-emerald-500 text-black font-mono text-xs font-black uppercase px-4 py-2 shadow-[2px_2px_0_0_#000] cursor-pointer"
              data-testid="claim-secret-discount-btn"
            >
              Claim {attendeeClaimResult.discountPercent}% OFF Discount at Checkout
            </button>
          )}
        </div>
      )}

      {/* Organizer Secret Link Generator & Management Panel */}
      {isOrganizer && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-black pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="border-2 border-black bg-amber-300 text-black font-mono text-[10px] font-bold uppercase px-2.5 py-0.5 shadow-[1px_1px_0_0_#000]">
                  Early Bird VIP Control
                </span>
                <span className="border-2 border-black bg-purple-200 text-purple-950 font-mono text-[10px] font-bold uppercase px-2 py-0.5">
                  Dynamic Expiration Engine
                </span>
              </div>
              <h2 className="font-display text-2xl font-black uppercase text-black dark:text-white flex items-center gap-2">
                <Lock className="h-6 w-6 text-amber-600" />
                Secret Early Bird Link Manager
              </h2>
              <p className="font-mono text-xs text-gray-700 dark:text-gray-300">
                Generate time-limited & quota-bounded invitation URLs for exclusive VIP discounts
              </p>
            </div>
          </div>

          {/* Generator Form */}
          <form
            onSubmit={handleGenerateSecretUrl}
            className="border-2 border-black bg-white p-4 space-y-4 shadow-[4px_4px_0_0_#000] dark:bg-zinc-800"
            data-testid="secret-url-generator-form"
          >
            <h3 className="font-display text-sm font-black uppercase text-black dark:text-white flex items-center gap-1.5 border-b-2 border-black pb-2">
              <Plus className="h-4 w-4 text-amber-600" />
              Generate New Secret Early Bird Access URL
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-mono text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300 block mb-1">
                  Discount (% OFF)
                </label>
                <input
                  type="number"
                  min="5"
                  max="90"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(Number(e.target.value))}
                  className="w-full border-2 border-black bg-amber-50 px-3 py-1.5 font-mono text-xs outline-none font-bold"
                  data-testid="input-discount-percent"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300 block mb-1">
                  Max Redemptions (Quota)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={quotaInput}
                  onChange={(e) => setQuotaInput(Number(e.target.value))}
                  className="w-full border-2 border-black bg-amber-50 px-3 py-1.5 font-mono text-xs outline-none font-bold"
                  data-testid="input-max-redemptions"
                />
              </div>

              <div>
                <label className="font-mono text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300 block mb-1">
                  Expiration Duration (Hours)
                </label>
                <select
                  value={durationHoursInput}
                  onChange={(e) => setDurationHoursInput(Number(e.target.value))}
                  className="w-full border-2 border-black bg-amber-50 px-3 py-1.5 font-mono text-xs outline-none font-bold"
                  data-testid="select-duration-hours"
                >
                  <option value={2}>2 Hours</option>
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours (1 Day)</option>
                  <option value={48}>48 Hours (2 Days)</option>
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] font-bold uppercase text-gray-700 dark:text-gray-300 block mb-1">
                  Expiration Rule
                </label>
                <select
                  value={ruleInput}
                  onChange={(e) => setRuleInput(e.target.value as ExpirationRule)}
                  className="w-full border-2 border-black bg-amber-50 px-3 py-1.5 font-mono text-xs outline-none font-bold"
                  data-testid="select-expiration-rule"
                >
                  <option value="time_and_quota">Time & Quota First</option>
                  <option value="sales_velocity_decay">Sales Velocity Decay</option>
                  <option value="one_time_magic_link">One-Time Magic Link</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full border-2 border-black bg-amber-400 hover:bg-amber-500 text-black font-mono text-xs font-black uppercase py-2.5 shadow-[2px_2px_0_0_#000] cursor-pointer flex items-center justify-center gap-1.5"
              data-testid="create-secret-url-btn"
            >
              <Link className="h-4 w-4" />
              Generate & Cryptographically Sign Secret URL
            </button>
          </form>

          {/* Active Secret Tokens Table */}
          <div className="space-y-3">
            <h3 className="font-display text-base font-black uppercase text-black dark:text-white flex items-center gap-2">
              <Link className="h-5 w-5 text-amber-600" />
              Active Secret Early Bird Links ({tokens.length})
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {tokens.map((t) => {
                const validation = validateEarlyBirdSecretUrl(t.token, now, t);
                const isExpired = !validation.isValid;

                return (
                  <div
                    key={t.token}
                    className={`neu-border border-4 border-black p-4 shadow-[4px_4px_0_0_#000] space-y-3 ${
                      t.isRevoked
                        ? "bg-rose-50 opacity-75 dark:bg-zinc-800"
                        : isExpired
                        ? "bg-amber-100/50 dark:bg-zinc-800"
                        : "bg-white dark:bg-zinc-800"
                    }`}
                    data-testid={`secret-token-card-${t.token}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 border border-black ${
                            t.isRevoked
                              ? "bg-rose-400 text-black"
                              : validation.status === "VALID"
                              ? "bg-emerald-300 text-emerald-950"
                              : "bg-amber-300 text-amber-950"
                          }`}
                          data-testid={`token-status-badge-${t.token}`}
                        >
                          {t.isRevoked ? "REVOKED" : validation.status}
                        </span>
                        <span className="font-mono text-xs font-bold text-black dark:text-white">
                          {t.discountPercent}% OFF Early Bird Link
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <span>Timer: {formatCountdown(t.expiresAt)}</span>
                      </div>
                    </div>

                    {/* Progress Bar & Redemptions */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between font-mono text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <span>Redemption Quota Usage:</span>
                        <span>
                          {t.currentRedemptions} / {t.maxRedemptions} Claimed (
                          {Math.round((t.currentRedemptions / Math.max(1, t.maxRedemptions)) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full border border-black bg-gray-200 h-2 rounded-none overflow-hidden">
                        <div
                          className="bg-amber-500 h-full transition-all"
                          style={{
                            width: `${Math.min(100, (t.currentRedemptions / Math.max(1, t.maxRedemptions)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Secret URL Copy & Revoke Controls */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        readOnly
                        value={t.secretLinkUrl}
                        className="flex-1 border-2 border-black bg-gray-50 px-3 py-1 font-mono text-xs outline-none truncate dark:bg-zinc-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyLink(t.secretLinkUrl)}
                        className="border-2 border-black bg-amber-300 hover:bg-amber-400 text-black font-mono text-xs font-bold uppercase px-3 py-1 shadow-[1px_1px_0_0_#000] cursor-pointer flex items-center gap-1"
                        data-testid={`copy-secret-link-btn-${t.token}`}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </button>
                      {!t.isRevoked && (
                        <button
                          type="button"
                          onClick={() => handleRevokeToken(t.token)}
                          className="border-2 border-black bg-rose-400 hover:bg-rose-500 text-black font-mono text-xs font-bold uppercase px-3 py-1 shadow-[1px_1px_0_0_#000] cursor-pointer flex items-center gap-1"
                          data-testid={`revoke-secret-link-btn-${t.token}`}
                        >
                          <Ban className="h-3.5 w-3.5" /> Revoke
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
