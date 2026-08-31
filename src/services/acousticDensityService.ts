// =============================================================================
// Service: AcousticDensityService
// Purpose: Manages Edge ML acoustic microphones, flashes firmware, and processes
//          privacy-preserving MQTT density telemetry.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface AcousticMicrophone {
  id: string;
  venue_id: string;
  room_number: string;
  firmware_version: string;
  is_model_flashed: boolean;
  created_at: string;
}

export interface AcousticTelemetry {
  id: string;
  microphone_id: string;
  density_score: number;
  mqtt_topic: string;
  recorded_at: string;
}

export interface AcousticAlert {
  id: string;
  microphone_id: string;
  density_score: number;
  status: "TRIGGERED" | "RESOLVED";
  created_at: string;
  resolved_at: string | null;
}

export class AcousticDensityService {
  /**
   * Fetches all microphone array devices configured in a venue.
   */
  static async fetchMicrophonesForVenue(venueId: string): Promise<AcousticMicrophone[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("acoustic_microphones")
        .select("*")
        .eq("venue_id", venueId)
        .order("room_number", { ascending: true });

      if (error) throw error;
      return (data || []) as AcousticMicrophone[];
    } catch (err) {
      console.error("Error fetching acoustic microphones:", err);
      return [];
    }
  }

  /**
   * Fetches recent telemetry readings for a microphone.
   */
  static async fetchLatestTelemetry(microphoneId: string): Promise<AcousticTelemetry[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("acoustic_density_telemetry")
        .select("*")
        .eq("microphone_id", microphoneId)
        .order("recorded_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as AcousticTelemetry[];
    } catch (err) {
      console.error("Error fetching telemetry logs:", err);
      return [];
    }
  }

  /**
   * Simulated MQTT broker ingestion. Simulates microphone extracting audio signatures locally,
   * deleting raw data from RAM, and sending ONLY the density score.
   */
  static async ingestAcousticDensity(
    microphoneId: string,
    densityScore: number,
    mqttTopic: string
  ): Promise<{
    success: boolean;
    alert_triggered?: boolean;
    density_score?: number;
    alert_id?: string;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("ingest_acoustic_density", {
        p_microphone_id: microphoneId,
        p_density_score: densityScore,
        p_mqtt_topic: mqttTopic,
      });

      if (error) throw error;

      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        alert_triggered: res?.alert_triggered,
        density_score: res?.density_score,
        alert_id: res?.alert_id,
        error: res?.error,
      };
    } catch (err: any) {
      console.error("MQTT ingestion failed:", err);
      return { success: false, error: err.message || "Failed to ingest telemetry." };
    }
  }

  /**
   * Flashes TensorFlow Lite / PyTorch Mobile model binary firmware onto the microphone IoT array.
   */
  static async flashModelToMicrophone(microphoneId: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("acoustic_microphones")
        .update({
          is_model_flashed: true,
          firmware_version: "v1.1.0-tflite-density",
        })
        .eq("id", microphoneId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Error flashing model firmware:", err);
      return false;
    }
  }
}
