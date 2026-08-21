// =============================================================================
// Component: SongRequestModal
// Issue: #3462 - Build an 'Interactive Live DJ Request System'
// Description: Modal allowing dance event attendees to search songs via Spotify
// autocomplete, submit requests, and upvote crowd favorites in real-time.
// =============================================================================

import React, { useState, useEffect } from "react";
import { useLiveDjRequests } from "@/hooks/useLiveDjRequests";
import { searchSpotifyTracks, type SpotifyTrack } from "@/services/spotifySearchService";
import Music from "lucide-react/dist/esm/icons/music";
import Search from "lucide-react/dist/esm/icons/search";
import ThumbsUp from "lucide-react/dist/esm/icons/thumbs-up";
import X from "lucide-react/dist/esm/icons/x";
import Disc from "lucide-react/dist/esm/icons/disc";
import Plus from "lucide-react/dist/esm/icons/plus";
import Check from "lucide-react/dist/esm/icons/check";

interface SongRequestModalProps {
  eventId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SongRequestModal({ eventId, userId, isOpen, onClose }: SongRequestModalProps) {
  const { requests, isLoading, toggleUpvote, submitRequest } = useLiveDjRequests(eventId, userId);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [submittedSongId, setSubmittedSongId] = useState<string | null>(null);

  // Debounced Spotify autocomplete search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      const results = await searchSpotifyTracks(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSelectTrack = async (track: SpotifyTrack) => {
    setSubmittedSongId(track.id);
    const success = await submitRequest(track.song_title, track.artist, track.album_art_url);
    if (success) {
      setSearchQuery("");
      setSearchResults([]);
    }
    setTimeout(() => setSubmittedSongId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <Music className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Live DJ Song Requests</h2>
              <p className="text-xs text-slate-400">
                Search Spotify catalog & upvote crowd favorites
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 pb-4 border-b border-slate-800/60 bg-slate-900">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search song title or artist (e.g. Levitating, Dua Lipa)..."
              className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Autocomplete Results Dropdown */}
          {searchQuery.trim() && (
            <div className="mt-3 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl max-h-60 overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-xs text-slate-400 font-mono">
                  Searching Spotify...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-mono">
                  No matching songs found
                </div>
              ) : (
                searchResults.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => handleSelectTrack(track)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-700/70 text-left transition-colors border-b border-slate-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {track.album_art_url ? (
                        <img
                          src={track.album_art_url}
                          alt={track.song_title}
                          className="w-10 h-10 rounded-lg object-cover bg-slate-900"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-slate-500">
                          <Disc className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-white">{track.song_title}</div>
                        <div className="text-xs text-slate-400">{track.artist}</div>
                      </div>
                    </div>

                    <div className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5">
                      {submittedSongId === track.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Requested
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" /> Request
                        </>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Crowd Request Live Feed */}
        <div className="p-6 overflow-y-auto grow">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Active Queue (Sorted by Upvotes)
            </h3>
            <span className="text-xs font-mono text-indigo-400">
              {requests.length} requests in queue
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm font-mono text-slate-400">
              Loading live DJ queue...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center text-sm font-mono text-slate-400 border border-dashed border-slate-800 rounded-xl">
              No active song requests yet. Be the first to request a song above!
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req, index) => (
                <div
                  key={req.id}
                  data-testid={`request-item-${req.id}`}
                  className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between gap-4 transition-transform hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-black text-slate-500 font-mono w-6 text-center">
                      #{index + 1}
                    </div>

                    {req.album_art_url ? (
                      <img
                        src={req.album_art_url}
                        alt={req.song_title}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-700"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-500">
                        <Disc className="w-6 h-6" />
                      </div>
                    )}

                    <div>
                      <div className="text-base font-bold text-white line-clamp-1">
                        {req.song_title}
                      </div>
                      <div className="text-xs text-slate-400 line-clamp-1">{req.artist}</div>
                    </div>
                  </div>

                  {/* Upvote Counter & Button */}
                  <button
                    type="button"
                    onClick={() => toggleUpvote(req.id)}
                    aria-label={`Upvote ${req.song_title}`}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      req.user_has_upvoted
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4 fill-current" />
                    <span>{req.upvotes}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
