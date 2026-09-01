export interface SpotifyTrackMetadata {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  explicit: boolean;
}

export interface SoundtrackQueueRequest {
  eventId: string;
  userId: string;
  allowExplicitMusic: boolean;
  track: SpotifyTrackMetadata;
}

export interface SoundtrackValidationResult {
  isAllowed: boolean;
  trackId: string;
  trackTitle: string;
  artistName: string;
  isExplicit: boolean;
  warningMessage?: string;
}

export const EXPLICIT_BLOCK_WARNING =
  "This event is family-friendly. Explicit tracks cannot be queued.";

/**
 * Validates whether a Spotify track can be queued into an event playlist based on explicit settings.
 */
export function validateSoundtrackQueueRequest(
  request: SoundtrackQueueRequest,
): SoundtrackValidationResult {
  const primaryArtist = request.track.artists?.[0]?.name || "Unknown Artist";
  const isExplicit = Boolean(request.track.explicit);

  if (isExplicit && !request.allowExplicitMusic) {
    return {
      isAllowed: false,
      trackId: request.track.id,
      trackTitle: request.track.name,
      artistName: primaryArtist,
      isExplicit: true,
      warningMessage: EXPLICIT_BLOCK_WARNING,
    };
  }

  return {
    isAllowed: true,
    trackId: request.track.id,
    trackTitle: request.track.name,
    artistName: primaryArtist,
    isExplicit,
  };
}

/**
 * Returns Tailwind CSS badge styling for queued track items.
 */
export function getTrackExplicitBadgeCss(isExplicit: boolean): { label: string; css: string } {
  if (isExplicit) {
    return {
      label: "E",
      css: "bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded text-xs border border-red-200",
    };
  }

  return {
    label: "Clean",
    css: "bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs",
  };
}
