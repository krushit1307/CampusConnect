import React, { useState } from "react";
import {
  Bell,
  Smartphone,
  Zap,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  WaitlistPromotionPushPayload,
  PushNotificationDispatchResult,
  registerUserFcmToken,
  generateWaitlistPushPayload,
  dispatchWaitlistPromotionPushNotification,
} from "@/lib/waitlistPromotionPush";
import { cn } from "@/lib/utils";

export interface WaitlistPromotionPushWidgetProps {
  userId?: string;
  eventId?: string;
  eventTitle?: string;
  initialFcmToken?: string;
  onDeepLinkClick?: (deepLinkUrl: string) => void;
  className?: string;
}

export const WaitlistPromotionPushWidget: React.FC<WaitlistPromotionPushWidgetProps> = ({
  userId = "u-101",
  eventId = "evt-gala-2026",
  eventTitle = "Annual Campus Spring Gala 2026",
  initialFcmToken = "fcm_tok_sample_991823",
  onDeepLinkClick,
  className,
}) => {
  const [fcmToken, setFcmToken] = useState<string>(initialFcmToken);
  const [activeNotification, setActiveNotification] = useState<PushNotificationDispatchResult | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleDispatchPush = () => {
    const payload: WaitlistPromotionPushPayload = {
      userId,
      eventId,
      eventTitle,
      fcmDeviceToken: fcmToken,
      claimDeadlineHours: 24,
      claimToken: `claim_${Date.now()}`,
    };

    const result = dispatchWaitlistPromotionPushNotification(payload);
    setActiveNotification(result);
    setNotice("FCM Push Notification dispatched directly to mobile device!");
    setTimeout(() => setNotice(null), 5000);
  };

  const handlePushClick = () => {
    if (activeNotification) {
      if (onDeepLinkClick) onDeepLinkClick(activeNotification.deepLinkUrl);
      setCheckoutModalOpen(true);
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-black rounded-xl bg-white font-mono shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden space-y-0",
        className
      )}
    >
      {/* Header Bar */}
      <div className="p-5 bg-amber-100 border-b-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold uppercase text-base text-amber-950">
            <Bell className="w-5 h-5 text-amber-600 animate-bounce" />
            <span>Automated "Waitlist Promotion" Push Notifications — {eventTitle}</span>
          </div>
          <p className="text-xs font-sans text-gray-700 mt-1">
            Bypasses slow email filters by sending high-priority FCM/APNs push notifications when waitlist tickets open up, deep-linking directly to Stripe checkout.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDispatchPush}
          className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-gray-800 font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1.5"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          Trigger Waitlist Promotion Push
        </button>
      </div>

      {/* Confirmation Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-100 border-b-2 border-black text-xs font-bold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Status & FCM Token Info Grid */}
      <div className="p-5 bg-slate-50 border-b-2 border-black grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Registered Device Token</span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <Smartphone className="w-4 h-4 shrink-0" />
            <span className="truncate">{fcmToken}</span>
          </div>
          <span className="text-[11px] font-sans text-gray-600 block">FCM High-Priority Channel Active</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Claim Deadline Window</span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <Clock className="w-4 h-4 shrink-0" />
            <span>24 Hours Strict Limit</span>
          </div>
          <span className="text-[11px] font-sans text-gray-600 block">Auto-passes to next in line</span>
        </div>

        <div className="p-3.5 border-2 border-black rounded-lg bg-white space-y-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-[10px] font-bold text-gray-500 uppercase block">Mobile Deep-Linking</span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>Direct Stripe Checkout</span>
          </div>
          <span className="text-[11px] font-sans text-gray-600 block">Instant ticket acquisition</span>
        </div>
      </div>

      {/* Simulated Lock Screen Mobile Push Banner (#4404) */}
      <div className="p-5 bg-white space-y-4">
        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-800 flex items-center gap-1.5 border-b border-gray-200 pb-2">
          <Smartphone className="w-4 h-4 text-amber-600" />
          Simulated Mobile Lock Screen Push Notification Preview
        </h4>

        {activeNotification ? (
          <div
            onClick={handlePushClick}
            className="max-w-md mx-auto p-4 border-2 border-black rounded-xl bg-slate-900 text-white space-y-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:scale-[1.02] transition-transform"
          >
            <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
              <span className="flex items-center gap-1 font-bold text-amber-400 uppercase">
                <Bell className="w-3 h-3" /> CAMPUSCONNECT • NOW
              </span>
              <span className="text-emerald-400 font-bold">24H CLAIM TIMER ACTIVE</span>
            </div>

            <h5 className="font-bold text-xs text-white leading-tight">{activeNotification.title}</h5>
            <p className="text-[11px] font-sans text-gray-300 leading-snug">{activeNotification.body}</p>

            <div className="pt-2 flex justify-between items-center border-t border-slate-800 text-[10px] font-mono text-sky-400 font-bold">
              <span>Tap to Open Stripe Checkout &rarr;</span>
              <span className="text-gray-500 truncate max-w-[150px]">{activeNotification.deepLinkUrl}</span>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-xs font-mono text-gray-500 bg-slate-50 border-2 border-black border-dashed rounded-lg">
            No push notification currently active. Click "Trigger Waitlist Promotion Push" above to test FCM push delivery.
          </div>
        )}
      </div>

      {/* Simulated Stripe Checkout Deep-Link Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="bg-white border-2 border-black rounded-xl max-w-md w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="font-bold text-sm uppercase flex items-center gap-2 text-indigo-950">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                Stripe Checkout (Deep-Linked)
              </h3>
              <span className="px-2 py-0.5 bg-amber-300 text-amber-950 font-bold text-[10px] rounded">
                23h 59m Remaining
              </span>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded text-xs space-y-1">
              <span className="font-bold text-indigo-900 block">{eventTitle}</span>
              <p className="text-[11px] font-sans text-indigo-800">
                Waitlist promotion verified. Ticket reserved for 24 hours.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCheckoutModalOpen(false)}
              className="w-full py-3 border-2 border-black bg-emerald-600 text-white font-bold text-xs uppercase rounded-md hover:bg-emerald-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              Complete $15.00 Ticket Claim
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
