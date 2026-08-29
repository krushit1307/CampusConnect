import { createClient } from "@/lib/supabase/client";

// =============================================================================
// Service: Event Weather Alert Service
// Issue: #4224 - Implement 'Automated "Event Cancellation" Weather Triggers'
// =============================================================================

export interface EventWeatherAlert {
  id: string;
  event_id: string;
  organizer_id: string;
  forecast_time: string;
  condition: string;
  precipitation_probability: number;
  temperature_c?: number | null;
  indoor_backup_url: string;
  alert_level?: string;
  acknowledged_at?: string | null;
  created_at: string;
}

/**
 * Checks if a weather forecast condition qualifies as severe (Thunderstorm, Tornado, Extreme Rain, Extreme Heat).
 */
export function isSevereWeatherCondition(
  condition: string,
  precipitationProbability: number = 0,
  temperatureC: number | null = null,
): { isSevere: boolean; alertLabel: string; severity: "critical" | "warning" | "none" } {
  const norm = (condition || "").toLowerCase();
  const prob = precipitationProbability > 1 ? precipitationProbability / 100 : precipitationProbability;

  if (norm.includes("tornado") || norm.includes("hurricane")) {
    return { isSevere: true, alertLabel: "Tornado / Extreme Wind Warning", severity: "critical" };
  }
  if (norm.includes("thunderstorm")) {
    return { isSevere: true, alertLabel: "Severe Thunderstorm Warning", severity: "critical" };
  }
  if ((norm.includes("rain") || norm.includes("shower") || norm.includes("snow")) && prob >= 0.6) {
    return {
      isSevere: true,
      alertLabel: norm.includes("snow") ? "Heavy Snow Warning" : "Heavy Rain Warning",
      severity: "warning",
    };
  }
  if (temperatureC !== null && temperatureC >= 35) {
    return { isSevere: true, alertLabel: "Extreme Heat Warning", severity: "warning" };
  }

  return { isSevere: false, alertLabel: "Normal Weather", severity: "none" };
}

/**
 * Constructs organizer weather warning SMS/Email payload.
 */
export function buildWeatherWarningMessage(
  eventTitle: string,
  alertLabel: string,
  actionUrl: string,
): string {
  return `CRITICAL: Severe weather (${alertLabel}) detected during your "${eventTitle}". Click here to instantly notify attendees of cancellation or a venue change: ${actionUrl}`;
}

/**
 * Fetches active weather alerts for a given event.
 */
export async function getEventWeatherAlerts(eventId: string): Promise<EventWeatherAlert[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("event_weather_alerts")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching event weather alerts:", error);
    return [];
  }

  return (data as EventWeatherAlert[]) || [];
}

/**
 * Manually invokes weather monitor edge function for a specific outdoor event.
 */
export async function triggerWeatherCheck(): Promise<{ success: boolean; checked?: number; alertsSent?: number }> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("weather-monitor", {
    body: { source: "manual-trigger" },
  });

  if (error) {
    return { success: false };
  }

  return { success: true, checked: data?.checked, alertsSent: data?.alertsSent };
}
