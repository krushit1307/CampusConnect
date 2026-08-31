// =============================================================================
// Service: DMCATakedownService
// Purpose: Manages automated media quarantines, fetches copyright infringement
//   compliance logs, and formats legal exports for the University Legal team.
// =============================================================================

import { createClient } from "@/lib/supabase/client";

export interface DMCATakedownLog {
  id: string;
  photo_id: string;
  student_id: string;
  song_title: string;
  artist_name: string;
  match_confidence: number;
  acr_response: any;
  quarantined_at: string;
  profiles?: {
    full_name: string;
  };
  event_photos?: {
    url: string;
    event_id: string;
  };
}

export class DMCATakedownService {
  /**
   * Fetches all registered DMCA Takedown Logs.
   */
  static async fetchDMCALogs(): Promise<DMCATakedownLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("dmca_takedown_logs")
        .select(`
          *,
          profiles:student_id(full_name),
          event_photos:photo_id(url, event_id)
        `)
        .order("quarantined_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DMCATakedownLog[];
    } catch (err) {
      console.error("Error fetching DMCA logs:", err);
      return [];
    }
  }

  /**
   * Executes the automated DMCA quarantine RPC.
   */
  static async triggerDMCAQuarantine(
    photoId: string,
    songTitle: string,
    artistName: string,
    matchConfidence: number,
    acrResponse: any
  ): Promise<{
    success: boolean;
    status?: string;
    song_title?: string;
    artist_name?: string;
    match_confidence?: number;
    error?: string;
  }> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase.rpc("quarantine_media_dmca", {
        p_photo_id: photoId,
        p_song_title: songTitle,
        p_artist_name: artistName,
        p_match_confidence: matchConfidence,
        p_acr_response: acrResponse,
      });

      if (error) throw error;

      const res = typeof data === "string" ? JSON.parse(data) : data;
      return {
        success: res?.success ?? false,
        status: res?.status,
        song_title: res?.song_title,
        artist_name: res?.artist_name,
        match_confidence: res?.match_confidence,
        error: res?.error,
      };
    } catch (err: any) {
      console.error("Error running DMCA quarantine:", err);
      return { success: false, error: err.message || "Failed to quarantine media." };
    }
  }

  /**
   * Generates and downloads a CSV export file of DMCA compliance logs.
   */
  static exportComplianceCSV(logs: DMCATakedownLog[]): void {
    if (logs.length === 0) {
      alert("No DMCA logs available to export.");
      return;
    }

    const headers = [
      "Log ID",
      "Photo/Video ID",
      "Student ID",
      "Student Name",
      "Song Title",
      "Artist Name",
      "Match Confidence (%)",
      "Storage URL",
      "Quarantined At",
    ];

    const rows = logs.map((log) => [
      log.id,
      log.photo_id,
      log.student_id,
      log.profiles?.full_name || "Unknown Student",
      `"${log.song_title.replace(/"/g, '""')}"`,
      `"${log.artist_name.replace(/"/g, '""')}"`,
      log.match_confidence,
      log.event_photos?.url || "N/A",
      log.quarantined_at,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DMCA_Compliance_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
