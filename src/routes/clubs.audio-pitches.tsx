import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Mic,
  Square,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Users,
  Headphones,
  Volume2,
  VolumeX,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClubPitch {
  id: string;
  club_id: string;
  audio_url: string;
  duration_seconds: number;
  listen_count: number;
  created_at: string;
  clubs: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    banner_url: string | null;
    category: string | null;
    member_count: number;
  };
}

interface ManagedClub {
  club_id: string;
  role: string;
  clubs: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DURATION = 60;

// ─── Audio Recorder Dialog ────────────────────────────────────────────────────

function AudioRecorderDialog({
  open,
  onClose,
  managedClubs,
  userId,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  managedClubs: ManagedClub[];
  userId: string;
  onRecorded: () => void;
}) {
  const supabase = createClient();
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (managedClubs.length > 0 && !selectedClubId) {
      setSelectedClubId(managedClubs[0].club_id);
    }
  }, [managedClubs, selectedClubId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(1000);
      setIsRecording(true);
      setElapsed(0);
      setRecordedBlob(null);
      setRecordedUrl("");

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_DURATION - 1) {
            mr.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      toast.error("Microphone access denied. Please allow microphone permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const discardRecording = useCallback(() => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl("");
    setElapsed(0);
  }, [recordedUrl]);

  const uploadRecording = useCallback(async () => {
    if (!recordedBlob || !selectedClubId) return;
    setIsUploading(true);
    try {
      // Archive existing active pitch for this club
      await supabase
        .from("club_audio_pitches")
        .update({ status: "archived" })
        .eq("club_id", selectedClubId)
        .eq("status", "active");

      const filePath = `${selectedClubId}/${crypto.randomUUID()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from("club-audio-pitches")
        .upload(filePath, recordedBlob);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("club-audio-pitches").getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("club_audio_pitches").insert({
        club_id: selectedClubId,
        recorded_by: userId,
        audio_url: urlData.publicUrl,
        duration_seconds: elapsed,
      });

      if (insertError) throw insertError;

      toast.success("Audio pitch uploaded! It's now live on the Discover feed. 🎤");
      discardRecording();
      onRecorded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload audio pitch.");
    } finally {
      setIsUploading(false);
    }
  }, [
    recordedBlob,
    selectedClubId,
    elapsed,
    userId,
    discardRecording,
    onRecorded,
    onClose,
    supabase,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-xl font-black uppercase tracking-wider">
            🎤 Record Audio Pitch
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Club selector */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wider">Club</label>
            <select
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
              className="rounded-lg border-2 border-black px-3 py-2 font-mono text-sm"
              disabled={isRecording}
            >
              {managedClubs.map((mc) => (
                <option key={mc.club_id} value={mc.club_id}>
                  {mc.clubs.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recording visualizer */}
          <div className="relative flex flex-col items-center gap-4 rounded-xl border-2 border-black bg-gradient-to-br from-rose-50 to-orange-50 p-8">
            {/* Timer ring */}
            <div className="relative flex h-32 w-32 items-center justify-center">
              <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={isRecording ? "#ef4444" : "#10b981"}
                  strokeWidth="6"
                  strokeDasharray={`${(elapsed / MAX_DURATION) * 283} 283`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="font-mono text-2xl font-black">{formatTime(elapsed)}</span>
            </div>

            <p className="text-center text-xs text-black/50">
              {isRecording
                ? "Recording… Speak about what makes your club special!"
                : recordedBlob
                  ? "Recording complete! Preview or re-record."
                  : "Tap the mic to start recording (max 60 seconds)"}
            </p>

            {/* Pulsing ring when recording */}
            {isRecording && (
              <motion.div
                className="absolute inset-0 rounded-xl border-2 border-red-400"
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            {!isRecording && !recordedBlob && (
              <Button
                onClick={startRecording}
                className="h-14 w-14 rounded-full border-2 border-black bg-red-500 p-0 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600"
                id="audio-pitch-record-btn"
              >
                <Mic className="h-6 w-6" />
              </Button>
            )}
            {isRecording && (
              <Button
                onClick={stopRecording}
                className="h-14 w-14 rounded-full border-2 border-black bg-black p-0 text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-800"
                id="audio-pitch-stop-btn"
              >
                <Square className="h-5 w-5" />
              </Button>
            )}
            {recordedBlob && !isRecording && (
              <>
                <audio src={recordedUrl} controls className="h-10 flex-1" />
                <Button
                  variant="outline"
                  onClick={discardRecording}
                  className="border-2 border-black font-mono text-xs font-black uppercase"
                >
                  Re-record
                </Button>
                <Button
                  onClick={uploadRecording}
                  disabled={isUploading}
                  className="border-2 border-black bg-lime-400 font-mono text-xs font-black uppercase text-black hover:bg-lime-500 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                  id="audio-pitch-upload-btn"
                >
                  {isUploading ? "Uploading…" : "Publish"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pitch Card (full-screen slide) ───────────────────────────────────────────

function PitchSlide({
  pitch,
  isActive,
  onJoin,
  isJoining,
}: {
  pitch: ClubPitch;
  isActive: boolean;
  onJoin: (clubId: string) => void;
  isJoining: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const supabase = createClient();

  // Auto-play when slide becomes active
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isActive) {
      el.currentTime = 0;
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));

      // Track listen
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase
            .from("club_audio_pitch_listens")
            .insert({
              pitch_id: pitch.id,
              user_id: data.user.id,
              listened_seconds: pitch.duration_seconds,
              completed: true,
            })
            .then(() => {});
        }
      });
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, [isActive, pitch.id, pitch.duration_seconds, supabase]);

  // Progress tracking
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const handler = () => {
      if (el.duration) setProgress((el.currentTime / el.duration) * 100);
    };
    el.addEventListener("timeupdate", handler);
    return () => el.removeEventListener("timeupdate", handler);
  }, []);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  const club = pitch.clubs;
  const bannerUrl = club.banner_url || club.logo_url;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
      {/* Background image (blurred) */}
      {bannerUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${bannerUrl})` }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
        </div>
      )}
      {!bannerUrl && (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900" />
      )}

      <audio ref={audioRef} src={pitch.audio_url} preload="auto" muted={isMuted} />

      {/* Content overlay */}
      <div className="relative z-10 flex h-full w-full max-w-md flex-col items-center justify-between px-6 py-10">
        {/* Top: Club Logo + Name */}
        <div className="flex flex-col items-center gap-3 text-center">
          {club.logo_url ? (
            <img
              src={club.logo_url}
              alt={club.name}
              className="h-20 w-20 rounded-2xl border-2 border-white/30 object-cover shadow-lg"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-white/30 bg-white/10 text-3xl font-black text-white">
              {club.name.charAt(0)}
            </div>
          )}
          <h2 className="font-mono text-2xl font-black text-white drop-shadow-lg">{club.name}</h2>
          {club.category && (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
              {club.category}
            </span>
          )}
        </div>

        {/* Center: Audio Visualizer + Play/Pause */}
        <div className="flex flex-col items-center gap-4">
          {/* Animated waveform bars */}
          <div className="flex h-16 items-end gap-[3px]">
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-[3px] rounded-full bg-white/80"
                animate={
                  isPlaying
                    ? {
                        height: [8, 20 + Math.random() * 40, 12, 30 + Math.random() * 30, 8],
                      }
                    : { height: 8 }
                }
                transition={
                  isPlaying
                    ? {
                        repeat: Infinity,
                        duration: 0.8 + Math.random() * 0.5,
                        delay: i * 0.04,
                      }
                    : { duration: 0.3 }
                }
              />
            ))}
          </div>

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/40 bg-white/20 backdrop-blur-md transition-all hover:scale-110 hover:bg-white/30"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-7 w-7 text-white" />
            ) : (
              <Play className="ml-1 h-7 w-7 text-white" />
            )}
          </button>

          {/* Progress bar */}
          <div className="h-1 w-48 overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-white"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-white/70">
            <span className="flex items-center gap-1">
              <Headphones className="h-3.5 w-3.5" /> {pitch.listen_count} listens
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {club.member_count} members
            </span>
          </div>
        </div>

        {/* Bottom: Join + Mute */}
        <div className="flex w-full flex-col items-center gap-3">
          {club.description && (
            <p className="line-clamp-2 text-center text-sm text-white/70">{club.description}</p>
          )}
          <Button
            onClick={() => onJoin(club.id)}
            disabled={isJoining}
            className="w-full rounded-xl border-2 border-white/30 bg-white py-6 font-mono text-lg font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] transition-all hover:scale-[1.02] hover:bg-white/90"
            id={`join-club-${club.slug}`}
          >
            {isJoining ? "Joining…" : "Join Club 🚀"}
          </Button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center gap-1 text-xs text-white/50 transition-colors hover:text-white/80"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClubAudioPitches() {
  const supabase = createClient();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Session
  const { data: session } = useQuery({
    queryKey: ["audio-pitches-session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id;

  // Fetch all active pitches
  const {
    data: pitches = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["club-audio-pitches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_audio_pitches")
        .select(
          `id, club_id, audio_url, duration_seconds, listen_count, created_at,
           clubs (id, name, slug, description, logo_url, banner_url, category, member_count)`,
        )
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ClubPitch[];
    },
  });

  // Fetch clubs the user manages (president/VP/admin)
  const { data: managedClubs = [] } = useQuery({
    queryKey: ["managed-clubs-for-pitch", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, role, clubs (id, name, slug, logo_url)")
        .eq("user_id", userId)
        .in("role", ["president", "vice_president", "admin"]);
      if (error) throw error;
      return (data || []) as unknown as ManagedClub[];
    },
    enabled: !!userId,
  });

  // Join club mutation
  const { mutate: joinClub, isPending: isJoining } = useMutation({
    mutationFn: async (clubId: string) => {
      if (!userId) throw new Error("Sign in to join a club");
      const { error } = await supabase.from("club_members").insert({
        club_id: clubId,
        user_id: userId,
        role: "member",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Welcome aboard! You've joined the club 🎉");
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.info("You're already a member of this club!");
      } else {
        toast.error(err.message || "Failed to join club.");
      }
    },
  });

  // Navigation handlers
  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, pitches.length - 1));
  }, [pitches.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") goNext();
      if (e.key === "ArrowUp" || e.key === "k") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch swipe support
  const touchStartY = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (diff > 60) goNext();
    else if (diff < -60) goPrev();
  };

  // Mouse wheel
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (wheelTimeoutRef.current) return;
      if (e.deltaY > 30) goNext();
      else if (e.deltaY < -30) goPrev();
      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
      }, 500);
    },
    [goNext, goPrev],
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          />
          <p className="font-mono text-sm text-white/60">Loading audio pitches…</p>
        </div>
      </div>
    );
  }

  if (pitches.length === 0) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-6 bg-gradient-to-br from-gray-900 to-black px-6 text-center">
        <div className="text-6xl">🎧</div>
        <h2 className="font-mono text-2xl font-black text-white">No Audio Pitches Yet</h2>
        <p className="max-w-md text-sm text-white/60">
          Club presidents can record a 60-second pitch to showcase their club's vibe. Be the first!
        </p>
        {managedClubs.length > 0 && (
          <Button
            onClick={() => setRecorderOpen(true)}
            className="border-2 border-white/30 bg-white/10 font-mono font-black uppercase text-white backdrop-blur-sm hover:bg-white/20"
          >
            <Mic className="mr-2 h-4 w-4" /> Record Your Pitch
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="absolute inset-0"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <PitchSlide
            pitch={pitches[currentIndex]}
            isActive={true}
            onJoin={(clubId) => joinClub(clubId)}
            isJoining={isJoining}
          />
        </motion.div>
      </AnimatePresence>

      {/* Navigation dots (right side) */}
      <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2">
        {pitches.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`h-2 w-2 rounded-full transition-all ${
              i === currentIndex ? "h-6 bg-white" : "bg-white/30 hover:bg-white/50"
            }`}
            aria-label={`Go to pitch ${i + 1}`}
          />
        ))}
      </div>

      {/* Up/Down arrows */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="rounded-full bg-white/10 p-1.5 text-white/60 backdrop-blur-sm hover:text-white"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
        )}
        <span className="font-mono text-[10px] text-white/40">
          {currentIndex + 1} / {pitches.length}
        </span>
        {currentIndex < pitches.length - 1 && (
          <button
            onClick={goNext}
            className="rounded-full bg-white/10 p-1.5 text-white/60 backdrop-blur-sm hover:text-white"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Record button (FAB for club leaders) */}
      {managedClubs.length > 0 && (
        <button
          onClick={() => setRecorderOpen(true)}
          className="absolute bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-red-500 text-white shadow-lg transition-all hover:scale-110 hover:bg-red-600"
          aria-label="Record audio pitch"
          id="audio-pitch-fab"
        >
          <Mic className="h-6 w-6" />
        </button>
      )}

      {/* Recorder Dialog */}
      {userId && (
        <AudioRecorderDialog
          open={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          managedClubs={managedClubs}
          userId={userId}
          onRecorded={() => refetch()}
        />
      )}
    </div>
  );
}
