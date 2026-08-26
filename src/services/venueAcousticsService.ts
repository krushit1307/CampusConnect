import { createClient } from "../lib/supabase/client";

const supabase = createClient();

export type AcousticProfile = "echo_heavy" | "soundproof" | "moderate" | "loud_ambient";

export interface VenueAcoustics {
  id: string;
  name: string;
  location?: string;
  capacity?: number;
  acoustic_profile: AcousticProfile;
  ambient_db_avg: number;
  acoustic_notes?: string;
  latitude?: number;
  longitude?: number;
}

export interface SoundMeasurement {
  id: string;
  venue_id: string;
  user_id: string;
  decibel_reading: number;
  sample_duration_seconds: number;
  recorded_at: string;
  event_id?: string;
}

export interface AcousticCompatibility {
  isCompatible: boolean;
  severity: "none" | "warning" | "incompatible";
  warningMessage?: string;
}

/**
 * Event categories that require strict or low-noise acoustic conditions.
 */
const SENSITIVE_EVENT_CATEGORIES = [
  "acoustic music",
  "spoken word",
  "poetry",
  "study session",
  "meditation",
  "classical music",
  "keynote",
  "podcast recording",
];

/**
 * Evaluates whether a venue's acoustic profile matches an event category or title.
 */
export function evaluateAcousticMatch(
  eventCategory: string,
  venue: Pick<VenueAcoustics, "name" | "acoustic_profile" | "ambient_db_avg">,
): AcousticCompatibility {
  const normalizedCategory = (eventCategory || "").toLowerCase().trim();
  const isSensitive = SENSITIVE_EVENT_CATEGORIES.some((cat) => normalizedCategory.includes(cat));

  if (!isSensitive) {
    return { isCompatible: true, severity: "none" };
  }

  if (venue.acoustic_profile === "echo_heavy") {
    return {
      isCompatible: false,
      severity: "incompatible",
      warningMessage: `Warning: ${venue.name} has heavy reverberation / echo properties and is not recommended for ${eventCategory || "this event type"}.`,
    };
  }

  if (venue.acoustic_profile === "loud_ambient" || venue.ambient_db_avg >= 70) {
    return {
      isCompatible: false,
      severity: "warning",
      warningMessage: `Warning: ${venue.name} has high ambient noise (avg ${venue.ambient_db_avg} dB) and is not recommended for ${eventCategory || "spoken word"} events.`,
    };
  }

  return { isCompatible: true, severity: "none" };
}

/**
 * Filters a list of venues based on the chosen event category to exclude poor acoustic choices.
 */
export function filterAcousticFriendlyVenues(
  venues: VenueAcoustics[],
  eventCategory: string,
): VenueAcoustics[] {
  const normalizedCategory = (eventCategory || "").toLowerCase().trim();
  const isSensitive = SENSITIVE_EVENT_CATEGORIES.some((cat) => normalizedCategory.includes(cat));

  if (!isSensitive) {
    return venues;
  }

  return venues.filter(
    (v) => v.acoustic_profile !== "echo_heavy" && v.acoustic_profile !== "loud_ambient",
  );
}

export const venueAcousticsService = {
  /**
   * Fetches all venues with their acoustic profiles and ambient decibel averages.
   */
  async getVenuesAcousticMap(): Promise<VenueAcoustics[]> {
    const { data, error } = await supabase
      .from("venues")
      .select(
        "id, name, location, capacity, acoustic_profile, ambient_db_avg, acoustic_notes, latitude, longitude",
      )
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching venues acoustics:", error);
      return [];
    }

    return (data as unknown as VenueAcoustics[]) || [];
  },

  /**
   * Submits a crowdsourced decibel reading measured via microphone.
   */
  async submitSoundMeasurement(params: {
    venueId: string;
    decibelReading: number;
    sampleDurationSeconds?: number;
    eventId?: string;
  }): Promise<{ success: boolean; measurement?: SoundMeasurement }> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User must be authenticated to submit DB readings");

    const { data, error } = await supabase
      .from("venue_sound_measurements")
      .insert({
        venue_id: params.venueId,
        user_id: user.id,
        decibel_reading: params.decibelReading,
        sample_duration_seconds: params.sampleDurationSeconds || 5,
        event_id: params.eventId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error recording sound measurement:", error);
      throw error;
    }

    return { success: true, measurement: data as unknown as SoundMeasurement };
  },
};
