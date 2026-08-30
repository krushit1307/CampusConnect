import { useState } from "react";
import {
  Bell,
  Mail,
  Smartphone,
  Monitor,
  MessageSquare,
  Clock,
  Calendar,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Shield,
} from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import type { NotificationCategory, NotificationChannel } from "@/hooks/useNotificationPreferences";
import { QuietHoursPicker } from "./QuietHoursPicker";
import { DigestPreview } from "./DigestPreview";

const CHANNEL_META: Record<
  NotificationChannel,
  { label: string; icon: typeof Bell; color: string }
> = {
  email: { label: "Email", icon: Mail, color: "bg-blue-100 text-blue-700" },
  push: { label: "Push", icon: Smartphone, color: "bg-green-100 text-green-700" },
  in_app: { label: "In-App", icon: Monitor, color: "bg-purple-100 text-purple-700" },
  sms: { label: "SMS", icon: MessageSquare, color: "bg-orange-100 text-orange-700" },
};

const CHANNELS: NotificationChannel[] = ["email", "push", "in_app", "sms"];

const CATEGORY_ICONS: Record<NotificationCategory, typeof Bell> = {
  event_reminders: Calendar,
  club_updates: Bell,
  rsVP_changes: RotateCcw,
  new_posts: Sparkles,
  comments_on_posts: MessageSquare,
  direct_messages: Mail,
  announcements: Bell,
  security_alerts: Shield,
  weekly_digest: Calendar,
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ChannelToggle({
  enabled,
  onToggle,
  channel,
}: {
  enabled: boolean;
  onToggle: () => void;
  channel: NotificationChannel;
}) {
  const meta = CHANNEL_META[channel];
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase font-mono transition-all ${
        enabled
          ? `${meta.color} border border-current/20`
          : "bg-gray-100 text-gray-400 border border-gray-200"
      }`}
      title={`${enabled ? "Disable" : "Enable"} ${meta.label}`}
    >
      <meta.icon size={10} />
      {meta.label}
    </button>
  );
}

export function NotificationPreferencesPage() {
  const {
    state,
    toggleChannel,
    setAllChannels,
    updateQuietHours,
    updateDigest,
    toggleAllForChannel,
    resetToDefaults,
  } = useNotificationPreferences();

  const [expandedCategory, setExpandedCategory] = useState<NotificationCategory | null>(null);
  const [activeSection, setActiveSection] = useState<"channels" | "quiet_hours" | "digest">(
    "channels",
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-black uppercase tracking-tight">
            Notification Preferences
          </h1>
          <p className="font-mono text-sm text-gray-500 mt-1">
            Control how and when CampusConnect reaches you
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase flex items-center gap-2 hover:bg-cream transition-colors shadow-[2px_2px_0_0_#000] neu-press"
        >
          <RotateCcw size={14} />
          Reset Defaults
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {[
          { id: "channels" as const, label: "Channels", icon: Bell },
          { id: "quiet_hours" as const, label: "Quiet Hours", icon: Clock },
          { id: "digest" as const, label: "Digest", icon: Calendar },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeSection === tab.id
                ? "bg-white shadow-sm text-black"
                : "text-gray-500 hover:text-black"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Channel Preferences */}
      {activeSection === "channels" && (
        <div className="space-y-4">
          {/* Quick Actions Row */}
          <div className="neu-border bg-white p-4 shadow-[2px_2px_0_0_#000]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-sm">Quick Toggle by Channel</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map((ch) => {
                const allOn = state.preferences.every((p) => p.channels[ch]);
                const meta = CHANNEL_META[ch];
                return (
                  <button
                    key={ch}
                    onClick={() => toggleAllForChannel(ch, !allOn)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                      allOn
                        ? "bg-lime border-2 border-black"
                        : "bg-gray-100 border-2 border-gray-300 text-gray-500"
                    }`}
                  >
                    <meta.icon size={14} />
                    {meta.label}: {allOn ? "ALL ON" : "ALL OFF"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-Category Preferences */}
          <div className="space-y-3">
            {state.preferences.map((pref) => {
              const Icon = CATEGORY_ICONS[pref.category];
              const isExpanded = expandedCategory === pref.category;
              const allEnabled = Object.values(pref.channels).every(Boolean);
              const noneEnabled = Object.values(pref.channels).every((v) => !v);

              return (
                <div
                  key={pref.category}
                  className="neu-border bg-white shadow-[2px_2px_0_0_#000] overflow-hidden"
                >
                  {/* Category Header */}
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? null : pref.category)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-cream/50 transition-colors"
                  >
                    <div
                      className={`p-2 neu-border ${
                        allEnabled ? "bg-lime" : noneEnabled ? "bg-gray-100" : "bg-yellow-100"
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-sm">{pref.label}</p>
                      <p className="font-mono text-[10px] text-gray-500 truncate">
                        {pref.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {CHANNELS.map((ch) => (
                        <ChannelToggle
                          key={ch}
                          channel={ch}
                          enabled={pref.channels[ch]}
                          onToggle={(e) => {
                            e.stopPropagation();
                            toggleChannel(pref.category, ch);
                          }}
                        />
                      ))}
                    </div>
                    <div className="shrink-0 text-gray-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-mono text-[10px] font-bold uppercase text-gray-500">
                          Channel Settings
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAllChannels(pref.category, true)}
                            className="font-mono text-[10px] font-bold text-green-600 hover:underline"
                          >
                            Enable All
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setAllChannels(pref.category, false)}
                            className="font-mono text-[10px] font-bold text-red-600 hover:underline"
                          >
                            Disable All
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {CHANNELS.map((ch) => {
                          const meta = CHANNEL_META[ch];
                          const enabled = pref.channels[ch];
                          return (
                            <button
                              key={ch}
                              onClick={() => toggleChannel(pref.category, ch)}
                              className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                                enabled
                                  ? "border-black bg-white shadow-[2px_2px_0_0_#000]"
                                  : "border-gray-200 bg-gray-50 opacity-60"
                              }`}
                            >
                              <meta.icon
                                size={20}
                                className={enabled ? "text-black" : "text-gray-400"}
                              />
                              <span className="font-mono text-[10px] font-bold uppercase">
                                {meta.label}
                              </span>
                              <span
                                className={`text-[10px] font-bold ${
                                  enabled ? "text-green-600" : "text-gray-400"
                                }`}
                              >
                                {enabled ? "ON" : "OFF"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quiet Hours Section */}
      {activeSection === "quiet_hours" && (
        <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000]">
          <QuietHoursPicker config={state.quietHours} onChange={updateQuietHours} />
        </div>
      )}

      {/* Digest Section */}
      {activeSection === "digest" && (
        <div className="space-y-6">
          {/* Digest Config */}
          <div className="neu-border bg-white p-6 shadow-[2px_2px_0_0_#000] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm">Email Digest</h3>
                <p className="font-mono text-[10px] text-gray-500 mt-0.5">
                  Receive a summary of campus activity
                </p>
              </div>
              <button
                onClick={() => updateDigest({ enabled: !state.digest.enabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  state.digest.enabled ? "bg-lime" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-black rounded-full transition-transform ${
                    state.digest.enabled ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            {state.digest.enabled && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                      Frequency
                    </label>
                    <select
                      value={state.digest.frequency}
                      onChange={(e) =>
                        updateDigest({
                          frequency: e.target.value as "daily" | "weekly" | "monthly",
                        })
                      }
                      className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-1 block">
                      Time
                    </label>
                    <select
                      value={state.digest.time}
                      onChange={(e) => updateDigest({ time: e.target.value })}
                      className="w-full neu-border bg-white px-3 py-2 font-mono text-sm outline-none focus:bg-cream"
                    >
                      {Array.from({ length: 24 }, (_, i) => {
                        const t = `${String(i).padStart(2, "0")}:00`;
                        const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
                        const ampm = i >= 12 ? "PM" : "AM";
                        return (
                          <option key={t} value={t}>
                            {h12}:00 {ampm}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {state.digest.frequency === "weekly" && (
                  <div>
                    <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-2 block">
                      Day of Week
                    </label>
                    <div className="flex gap-2">
                      {DAY_NAMES.map((day, i) => (
                        <button
                          key={i}
                          onClick={() => updateDigest({ day_of_week: i })}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all ${
                            state.digest.day_of_week === i
                              ? "bg-lime border-2 border-black"
                              : "bg-gray-100 border-2 border-gray-200 hover:border-gray-400"
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="font-mono text-[10px] font-bold uppercase text-gray-600 mb-2 block">
                    Include in Digest
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "include_events" as const, label: "Upcoming Events" },
                      { key: "include_club_activity" as const, label: "Club Activity" },
                      { key: "include_popular_posts" as const, label: "Popular Posts" },
                      { key: "include_upcoming_deadlines" as const, label: "Deadlines" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => updateDigest({ [item.key]: !state.digest[item.key] })}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold font-mono text-left transition-all ${
                          state.digest[item.key]
                            ? "bg-lime border-2 border-black"
                            : "bg-gray-100 border-2 border-gray-200 text-gray-500"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded border-2 flex items-center justify-center ${
                            state.digest[item.key] ? "border-black bg-black" : "border-gray-300"
                          }`}
                        >
                          {state.digest[item.key] && (
                            <span className="w-1.5 h-1.5 bg-white rounded-sm" />
                          )}
                        </span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Digest Preview */}
          {state.digest.enabled && <DigestPreview digest={state.digest} />}
        </div>
      )}
    </div>
  );
}
