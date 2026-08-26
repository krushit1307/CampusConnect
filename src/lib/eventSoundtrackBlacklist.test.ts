import { describe, it, expect } from "vitest";
import {
  validateSoundtrackQueueRequest,
  getTrackExplicitBadgeCss,
  EXPLICIT_BLOCK_WARNING,
  SpotifyTrackMetadata,
  SoundtrackQueueRequest,
} from "./eventSoundtrackBlacklist";

describe("Build Real-Time Event Soundtrack Blacklist Suite (#4414)", () => {
  const cleanTrack: SpotifyTrackMetadata = {
    id: "spotify_clean_1",
    name: "Uptown Funk",
    artists: [{ name: "Bruno Mars" }],
    explicit: false,
  };

  const explicitTrack: SpotifyTrackMetadata = {
    id: "spotify_explicit_1",
    name: "Profanity Song",
    artists: [{ name: "Explicit Rapper" }],
    explicit: true,
  };

  it("blocks explicit track requests when allowExplicitMusic is false", () => {
    const request: SoundtrackQueueRequest = {
      eventId: "evt_alumni_bbq",
      userId: "usr_troll",
      allowExplicitMusic: false,
      track: explicitTrack,
    };

    const result = validateSoundtrackQueueRequest(request);

    expect(result.isAllowed).toBe(false);
    expect(result.isExplicit).toBe(true);
    expect(result.warningMessage).toBe(EXPLICIT_BLOCK_WARNING);
  });

  it("allows clean tracks to be queued on family-friendly events", () => {
    const request: SoundtrackQueueRequest = {
      eventId: "evt_alumni_bbq",
      userId: "usr_alice",
      allowExplicitMusic: false,
      track: cleanTrack,
    };

    const result = validateSoundtrackQueueRequest(request);

    expect(result.isAllowed).toBe(true);
    expect(result.warningMessage).toBeUndefined();
  });

  it("allows explicit tracks if event configuration allowExplicitMusic is true", () => {
    const request: SoundtrackQueueRequest = {
      eventId: "evt_night_party",
      userId: "usr_bob",
      allowExplicitMusic: true,
      track: explicitTrack,
    };

    const result = validateSoundtrackQueueRequest(request);

    expect(result.isAllowed).toBe(true);
  });

  it("returns appropriate badge CSS for explicit vs clean tracks", () => {
    const explicitBadge = getTrackExplicitBadgeCss(true);
    const cleanBadge = getTrackExplicitBadgeCss(false);

    expect(explicitBadge.label).toBe("E");
    expect(explicitBadge.css).toContain("bg-red-100");
    expect(cleanBadge.label).toBe("Clean");
  });
});
