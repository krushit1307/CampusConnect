import { create } from "zustand";

export interface Track {
  url: string;
  eventId: string;
  title: string;
  speaker?: string;
  clubName?: string;
  clubLogo?: string;
}

interface AudioState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  playTrack: (track: Track) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  closePlayer: () => void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,

  playTrack: (track) => {
    set({ currentTrack: track, isPlaying: true, currentTime: 0, duration: 0 });

    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.speaker || "Guest Speaker",
        album: track.clubName || "CampusConnect",
        artwork: track.clubLogo
          ? [{ src: track.clubLogo, sizes: "512x512", type: "image/png" }]
          : [],
      });
    }
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setVolume: (volume) => set({ volume }),

  closePlayer: () => {
    set({ currentTrack: null, isPlaying: false, currentTime: 0 });
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = null;
    }
  },
}));
