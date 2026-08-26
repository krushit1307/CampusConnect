// =============================================================================
// Service: Spotify Search Autocomplete
// Issue: #3462 - Build an 'Interactive Live DJ Request System'
// Description: Queries Spotify Search API for track metadata autocomplete (song_title,
// artist, album_art_url) so attendees submit accurate song requests.
// =============================================================================

export interface SpotifyTrack {
  id: string;
  song_title: string;
  artist: string;
  album_art_url: string;
  preview_url?: string | null;
}

/**
 * Curated catalog of popular campus event dance tracks for fallback / offline testing.
 */
export const POPULAR_CAMPUS_TRACKS: SpotifyTrack[] = [
  {
    id: "spotify-track-1",
    song_title: "Levitating",
    artist: "Dua Lipa",
    album_art_url:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "spotify-track-2",
    song_title: "Blinding Lights",
    artist: "The Weeknd",
    album_art_url:
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "spotify-track-3",
    song_title: "Uptown Funk",
    artist: "Mark Ronson ft. Bruno Mars",
    album_art_url:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "spotify-track-4",
    song_title: "Mr. Brightside",
    artist: "The Killers",
    album_art_url:
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "spotify-track-5",
    song_title: "As It Was",
    artist: "Harry Styles",
    album_art_url:
      "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "spotify-track-6",
    song_title: "One Dance",
    artist: "Drake ft. Wizkid & Kyla",
    album_art_url:
      "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=150&auto=format&fit=crop&q=80",
  },
  {
    id: "spotify-track-7",
    song_title: "Starboy",
    artist: "The Weeknd ft. Daft Punk",
    album_art_url:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=150&auto=format&fit=crop&q=80",
  },
];

/**
 * Searches Spotify track catalog via Web API (or fallback track catalog).
 */
export async function searchSpotifyTracks(
  query: string,
  spotifyAccessToken?: string,
): Promise<SpotifyTrack[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  if (spotifyAccessToken) {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?type=track&limit=8&q=${encodeURIComponent(cleanQuery)}`,
        {
          headers: { Authorization: `Bearer ${spotifyAccessToken}` },
        },
      );
      if (response.ok) {
        const data = await response.json();
        if (data.tracks?.items) {
          return data.tracks.items.map((item: any) => ({
            id: item.id,
            song_title: item.name,
            artist: item.artists.map((a: any) => a.name).join(", "),
            album_art_url: item.album?.images?.[0]?.url || "",
            preview_url: item.preview_url,
          }));
        }
      }
    } catch (err) {
      console.warn("[spotifySearchService] Remote Spotify API request failed, using catalog:", err);
    }
  }

  // Filter curated popular campus catalog for instant autocomplete
  const matches = POPULAR_CAMPUS_TRACKS.filter(
    (track) =>
      track.song_title.toLowerCase().includes(cleanQuery) ||
      track.artist.toLowerCase().includes(cleanQuery),
  );

  if (matches.length > 0) return matches;

  // If query is custom user input, format custom result entry
  return [
    {
      id: `custom-${Date.now()}`,
      song_title: query.trim(),
      artist: "Requested Track",
      album_art_url:
        "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150&auto=format&fit=crop&q=80",
    },
  ];
}
