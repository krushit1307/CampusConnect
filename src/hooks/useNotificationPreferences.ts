import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type NotificationChannel = "email" | "push" | "in_app" | "sms";
export type NotificationCategory =
  | "event_reminders"
  | "club_updates"
  | "rsVP_changes"
  | "new_posts"
  | "comments_on_posts"
  | "direct_messages"
  | "announcements"
  | "security_alerts"
  | "weekly_digest";

export interface QuietHoursConfig {
  enabled: boolean;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  timezone: string;
}

export interface DigestConfig {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  day_of_week: number; // 0=Sun, 6=Sat
  time: string; // "HH:mm"
  include_events: boolean;
  include_club_activity: boolean;
  include_popular_posts: boolean;
  include_upcoming_deadlines: boolean;
}

export interface NotificationPreference {
  category: NotificationCategory;
  label: string;
  description: string;
  channels: {
    email: boolean;
    push: boolean;
    in_app: boolean;
    sms: boolean;
  };
}

export interface NotificationPreferencesState {
  preferences: NotificationPreference[];
  quietHours: QuietHoursConfig;
  digest: DigestConfig;
  unreadCount: number;
}

const DEFAULT_PREFERENCES: NotificationPreference[] = [
  {
    category: "event_reminders",
    label: "Event Reminders",
    description: "Get reminded before events you RSVP'd to",
    channels: { email: true, push: true, in_app: true, sms: false },
  },
  {
    category: "club_updates",
    label: "Club Updates",
    description: "News and updates from clubs you've joined",
    channels: { email: true, push: true, in_app: true, sms: false },
  },
  {
    category: "rsVP_changes",
    label: "RSVP Changes",
    description: "When event details change or events are cancelled",
    channels: { email: true, push: true, in_app: true, sms: true },
  },
  {
    category: "new_posts",
    label: "New Posts",
    description: "When someone posts in your club feeds",
    channels: { email: false, push: true, in_app: true, sms: false },
  },
  {
    category: "comments_on_posts",
    label: "Post Comments",
    description: "Replies to your posts or comments",
    channels: { email: false, push: true, in_app: true, sms: false },
  },
  {
    category: "direct_messages",
    label: "Direct Messages",
    description: "Personal messages from other students",
    channels: { email: true, push: true, in_app: true, sms: false },
  },
  {
    category: "announcements",
    label: "Campus Announcements",
    description: "Official university-wide announcements",
    channels: { email: true, push: true, in_app: true, sms: true },
  },
  {
    category: "security_alerts",
    label: "Security Alerts",
    description: "Important security and safety notifications",
    channels: { email: true, push: true, in_app: true, sms: true },
  },
  {
    category: "weekly_digest",
    label: "Weekly Digest",
    description: "Summary of campus activity and upcoming events",
    channels: { email: true, push: false, in_app: true, sms: false },
  },
];

const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: true,
  start: "22:00",
  end: "08:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const DEFAULT_DIGEST: DigestConfig = {
  enabled: true,
  frequency: "weekly",
  day_of_week: 0,
  time: "09:00",
  include_events: true,
  include_club_activity: true,
  include_popular_posts: true,
  include_upcoming_deadlines: true,
};

function loadPreferences(): NotificationPreferencesState {
  try {
    const raw = localStorage.getItem("cc-notification-prefs");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        preferences: parsed.preferences || DEFAULT_PREFERENCES,
        quietHours: parsed.quietHours || DEFAULT_QUIET_HOURS,
        digest: parsed.digest || DEFAULT_DIGEST,
        unreadCount: parsed.unreadCount || 0,
      };
    }
  } catch {
    // ignore
  }
  return {
    preferences: DEFAULT_PREFERENCES,
    quietHours: DEFAULT_QUIET_HOURS,
    digest: DEFAULT_DIGEST,
    unreadCount: 0,
  };
}

function savePreferences(state: NotificationPreferencesState): void {
  localStorage.setItem(
    "cc-notification-prefs",
    JSON.stringify({
      preferences: state.preferences,
      quietHours: state.quietHours,
      digest: state.digest,
    }),
  );
}

export function useNotificationPreferences() {
  const [state, setState] = useState<NotificationPreferencesState>(loadPreferences);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    savePreferences(state);
  }, [state]);

  const toggleChannel = useCallback(
    (category: NotificationCategory, channel: NotificationChannel) => {
      setState((prev) => ({
        ...prev,
        preferences: prev.preferences.map((p) =>
          p.category === category
            ? { ...p, channels: { ...p.channels, [channel]: !p.channels[channel] } }
            : p,
        ),
      }));
    },
    [],
  );

  const setAllChannels = useCallback((category: NotificationCategory, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      preferences: prev.preferences.map((p) =>
        p.category === category
          ? { ...p, channels: { email: enabled, push: enabled, in_app: enabled, sms: enabled } }
          : p,
      ),
    }));
  }, []);

  const updateQuietHours = useCallback((update: Partial<QuietHoursConfig>) => {
    setState((prev) => ({
      ...prev,
      quietHours: { ...prev.quietHours, ...update },
    }));
  }, []);

  const updateDigest = useCallback((update: Partial<DigestConfig>) => {
    setState((prev) => ({
      ...prev,
      digest: { ...prev.digest, ...update },
    }));
  }, []);

  const toggleAllForChannel = useCallback((channel: NotificationChannel, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      preferences: prev.preferences.map((p) => ({
        ...p,
        channels: { ...p.channels, [channel]: enabled },
      })),
    }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setState({
      preferences: DEFAULT_PREFERENCES,
      quietHours: DEFAULT_QUIET_HOURS,
      digest: DEFAULT_DIGEST,
      unreadCount: 0,
    });
  }, []);

  return {
    state,
    toggleChannel,
    setAllChannels,
    updateQuietHours,
    updateDigest,
    toggleAllForChannel,
    resetToDefaults,
    isSaving,
  };
}
