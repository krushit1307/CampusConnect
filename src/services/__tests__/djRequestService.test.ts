import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchSpotifyTracks } from "../spotifySearchService";
import { submitSongRequest, upvoteSongRequest, dismissSongRequest } from "../djRequestService";
import { createClient } from "../../lib/supabase/client";

vi.mock("../../lib/supabase/client", () => {
  const mockInsert = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  const mockFrom = vi.fn();

  return {
    createClient: () => ({
      from: mockFrom,
    }),
    __mockFrom: mockFrom,
  };
});

describe("Live DJ Request Service (#3462)", () => {
  describe("searchSpotifyTracks", () => {
    it("returns track search autocomplete results for Dua Lipa", async () => {
      const results = await searchSpotifyTracks("Levitating");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].song_title).toBe("Levitating");
      expect(results[0].artist).toBe("Dua Lipa");
    });

    it("returns empty array for empty search queries", async () => {
      const results = await searchSpotifyTracks("   ");
      expect(results).toEqual([]);
    });

    it("creates custom fallback track object for custom user queries", async () => {
      const results = await searchSpotifyTracks("Custom Party Anthem 2026");
      expect(results.length).toBe(1);
      expect(results[0].song_title).toBe("Custom Party Anthem 2026");
    });
  });

  describe("submitSongRequest", () => {
    it("validates required fields before submitting request", async () => {
      const result = await submitSongRequest("", "user-1", "", "Artist");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required");
    });
  });
});
