// =============================================================================
// Service: ThermalOvercrowdingService
// Purpose: Handles querying thermostat logs, ingesting environmental readings,
//   and managing overcrowding thermal alerts.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface ThermostatReading {
  id: string;
  venue_id: string;
  temperature_fahrenheit: number;
  recorded_at: string;
}

export interface ThermalAlert {
  id: string;
  venue_id: string;
  initial_temp: number;
  current_temp: number;
  temp_spike: number;
  status: 'TRIGGERED' | 'RESOLVED';
  created_at: string;
  resolved_at?: string | null;
}

export class ThermalOvercrowdingService {
  /**
   * Fetches thermostat telemetry logs for a given venue.
   */
  static async fetchTelemetry(venueId: string): Promise<ThermostatReading[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("thermostat_telemetry")
        .select("*")
        .eq("venue_id", venueId)
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as ThermostatReading[];
    } catch (err) {
      console.error("Error fetching thermostat telemetry:", err);
      return [];
    }
  }

  /**
   * Ingests a new temperature reading and triggers alert dispatches if needed.
   */
  static async ingestReading(
    venueId: string,
    temp: number
  ): Promise<{
    success: boolean;
    delta_t: number;
    baseline_temp: number;
    alert_triggered: boolean;
    alert_id?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("ingest_thermostat_reading", {
        p_venue_id: venueId,
        p_temperature: temp,
        p_now: new Date().toISOString()
      });

      if (error) throw error;
      
      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        delta_t: res?.delta_t ?? 0,
        baseline_temp: res?.baseline_temp ?? temp,
        alert_triggered: res?.alert_triggered ?? false,
        alert_id: res?.alert_id
      };
    } catch (err: any) {
      console.error("Error ingesting thermostat reading:", err);
      return {
        success: false,
        delta_t: 0,
        baseline_temp: temp,
        alert_triggered: false
      };
    }
  }

  /**
   * Fetches active thermal alerts for a venue.
   */
  static async fetchActiveAlerts(venueId: string): Promise<ThermalAlert[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("thermal_alerts")
        .select("*")
        .eq("venue_id", venueId)
        .eq("status", "TRIGGERED");

      if (error) throw error;
      return (data || []) as ThermalAlert[];
    } catch (err) {
      console.error("Error fetching active thermal alerts:", err);
      return [];
    }
  }

  /**
   * Resolves an active thermal alert.
   */
  static async resolveAlert(alertId: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("thermal_alerts")
        .update({
          status: 'RESOLVED',
          resolved_at: new Date().toISOString()
        })
        .eq("id", alertId);

      return !error;
    } catch (err) {
      console.error("Error resolving thermal alert:", err);
      return false;
    }
  }
}
