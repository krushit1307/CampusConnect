import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Radio,
  RefreshCw,
  Video,
  Captions,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  shouldUseFallback,
  type BroadcastConnectionState,
  type BroadcastState,
} from "@/lib/broadcastFailover";
import { CaptionsOverlay } from "@/components/audio/CaptionsOverlay";
import { TranscriptionControls } from "@/components/audio/TranscriptionControls";
import { usePresenterPing } from "@/hooks/usePresenterPing";
import { PresenterPingModal } from "@/components/events/PresenterPingModal";
import { GreenRoomPresenterPingDashboard } from "@/components/events/GreenRoomPresenterPingDashboard";
import { PresenterState } from "@/lib/presenterPing";

type ConnectionState = BroadcastConnectionState;

type BroadcastSession = {
  id: string;
  event_id: string;
  presenter_user_id: string | null;
  primary_stream_url: string | null;
  fallback_slate_url: string;
  active_source: "primary" | "fallback";
  state: BroadcastState;
  connection_state: ConnectionState;
  failure_reason: string | null;
  last_heartbeat_at: string | null;
  fallback_activated_at: string | null;
  recovered_at: string | null;
};

export function EventBroadcastFallbackPanel({
  eventId,
  isOrganizer = false,
  presenterUserId,
}: {
  eventId: string;
  isOrganizer?: boolean;
  presenterUserId?: string | null;
}) {
  const [supabase] = useState(() => createClient());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [session, setSession] = useState<BroadcastSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, [supabase]);

  const initialPresenters: PresenterState[] = useMemo(() => {
    const list: PresenterState[] = [];
    const pId = presenterUserId || session?.presenter_user_id;
    if (pId) {
      list.push({
        id: pId,
        name: "Primary Presenter",
        connectionState: session?.connection_state || "connected",
        pingStatus: "idle",
      });
    }
    return list;
  }, [presenterUserId, session?.presenter_user_id, session?.connection_state]);

  const { presenters, activePing, pingPresenter, pingAllPresenters, confirmReady, resetPresenter } =
    usePresenterPing({
      eventId,
      currentUserId,
      initialPresenters,
      isOrganizer,
      onAwolTriggered: async (awolPresenter) => {
        if (isOrganizer) {
          await reportState(
            "failed",
            false,
            `Presenter ${awolPresenter.name} did not confirm readiness within 15 seconds (AWOL).`,
          );
        }
      },
    });

  const loadSession = async () => {
    const { data, error } = await supabase
      .from("event_broadcast_sessions")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) toast.error("Could not load live broadcast status.");
    setSession((data as BroadcastSession | null) ?? null);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadSession();
    const channel = supabase
      .channel(`event-broadcast:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_broadcast_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        () => void loadSession(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, supabase]);

  const startSession = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setIsWorking(true);
    const { data, error } = await supabase.rpc("start_event_broadcast_session", {
      p_event_id: eventId,
      p_presenter_user_id: presenterUserId || user.id,
      p_primary_stream_url: null,
      p_fallback_slate_url: "/technical-difficulties.mp4",
    });
    setIsWorking(false);
    if (error) {
      toast.error(error.message || "Could not start the broadcast session.");
      return;
    }
    setSession(data as BroadcastSession);
    toast.success("Broadcast failover protection is active.");
  };

  const reportState = async (
    connectionState: ConnectionState,
    avCheckPassed: boolean,
    failureReason?: string,
  ) => {
    setIsWorking(true);
    const { error } = await supabase.functions.invoke("broadcast-failover", {
      body: { eventId, connectionState, avCheckPassed, failureReason },
    });
    setIsWorking(false);
    if (error) {
      toast.error(error.message || "Could not update broadcast state.");
      return;
    }
    await loadSession();
  };

  // ─── GREEN ROOM DIAGNOSTIC STATE & REFS ─────────────────────────────────────
  const [isGreenRoomOpen, setIsGreenRoomOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [audioVolume, setAudioVolume] = useState<number>(0);
  const [speakingTime, setSpeakingTime] = useState<number>(0);
  const [isVideoConfirmed, setIsVideoConfirmed] = useState(false);
  const [isAudioPassed, setIsAudioPassed] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startAudioAnalysis = (stream: MediaStream) => {
    cleanupAudioAnalysis();

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastTime = performance.now();

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const vol = Math.min((average / 128) * 100, 100);
        setAudioVolume(vol);

        const now = performance.now();
        const delta = now - lastTime;
        lastTime = now;

        if (vol > 20) {
          setSpeakingTime((prev) => {
            const next = prev + delta;
            if (next >= 3000) {
              setIsAudioPassed(true);
              return 3000;
            }
            return next;
          });
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animationFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (err) {
      console.error("Failed to setup audio context:", err);
    }
  };

  const cleanupAudioAnalysis = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const initGreenRoomStream = async (deviceId?: string) => {
    setPermissionError(null);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setLocalStream(null);

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      setLocalStream(stream);

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      startAudioAnalysis(stream);

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoIn);

      if (!deviceId && videoIn.length > 0) {
        const currentVideoTrack = stream.getVideoTracks()[0];
        const currentSettings = currentVideoTrack?.getSettings();
        if (currentSettings?.deviceId) {
          setSelectedCameraId(currentSettings.deviceId);
        } else {
          setSelectedCameraId(videoIn[0].deviceId);
        }
      }
    } catch (err: any) {
      console.error("Green Room getUserMedia error:", err);
      setPermissionError(err.message || "Failed to access camera or microphone.");
      toast.error("Camera or Microphone access was denied.");
    }
  };

  const openGreenRoom = () => {
    setIsGreenRoomOpen(true);
    setSpeakingTime(0);
    setIsAudioPassed(false);
    setIsVideoConfirmed(false);
    setAudioVolume(0);
    void initGreenRoomStream();
  };

  const closeGreenRoom = () => {
    setIsGreenRoomOpen(false);
    cleanupAudioAnalysis();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setLocalStream(null);
  };

  const handleGoLive = async () => {
    if (!isAudioPassed || !isVideoConfirmed) return;
    setIsWorking(true);
    try {
      await reportState("connected", true);
      toast.success("Green Room diagnostic passed! You are now live.");
      closeGreenRoom();
    } catch {
      toast.error("Failed to complete pre-flight check.");
    } finally {
      setIsWorking(false);
    }
  };

  useEffect(() => {
    if (isGreenRoomOpen && localStream && videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [isGreenRoomOpen, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioAnalysis();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="mt-6 flex items-center gap-2 font-mono text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading broadcast status…
      </div>
    );
  }

  if (!session) {
    return isOrganizer ? (
      <section
        className="neu-border mt-6 bg-sky-100 p-5"
        aria-labelledby="broadcast-fallback-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase">
              <Radio className="h-4 w-4" /> Broadcast resilience
            </p>
            <h2
              id="broadcast-fallback-title"
              className="mt-1 font-display text-2xl font-black uppercase"
            >
              Protect the live feed
            </h2>
            <p className="mt-2 font-mono text-xs text-black/65">
              Create a durable session so attendees see a technical-difficulties slate if the
              presenter connection drops.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void startSession()}
            disabled={isWorking}
            className="neu-border font-mono text-xs font-bold uppercase"
          >
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable fallback"}
          </Button>
        </div>
      </section>
    ) : null;
  }

  const isFallback = shouldUseFallback(session.state, session.active_source);
  return (
    <section
      className="neu-border mt-6 overflow-hidden bg-black text-white"
      aria-labelledby="broadcast-fallback-title"
    >
      <div className="flex flex-col gap-3 border-b-2 border-white/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-lime-300">
            <Radio className="h-4 w-4" /> Live broadcast
          </p>
          <h2
            id="broadcast-fallback-title"
            className="mt-1 font-display text-2xl font-black uppercase"
          >
            {isFallback ? "Technical difficulties" : "Primary feed active"}
          </h2>
          <p className="mt-1 font-mono text-xs text-white/65">
            Connection: {session.connection_state} · source: {session.active_source}
          </p>
        </div>
        <span
          className={`border-2 border-white px-2 py-1 font-mono text-[10px] font-bold uppercase ${isFallback ? "bg-red-500" : "bg-lime-400 text-black"}`}
        >
          {session.state}
        </span>
      </div>

      {isFallback ? (
        <div className="relative aspect-video bg-slate-900">
          <video
            src={session.fallback_slate_url}
            loop
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
            aria-label="Technical difficulties. Please stand by."
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-6 text-center pointer-events-none">
            <div>
              <AlertTriangle className="mx-auto mb-2 h-10 w-10 text-yellow-300" />
              <p className="font-display text-2xl font-black uppercase">Please stand by</p>
              <p className="mt-1 font-mono text-xs text-white/80">
                We are checking the presenter’s audio and video connection.
              </p>
            </div>
          </div>
        </div>
      ) : session.primary_stream_url ? (
        <div className="relative group aspect-video w-full bg-slate-900">
          <video
            src={session.primary_stream_url}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-cover"
            aria-label="Live event broadcast"
          />
          <CaptionsOverlay eventId={eventId} enabled={captionsEnabled} />

          <div className="absolute bottom-4 right-16 z-10 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => setCaptionsEnabled((p) => !p)}
              className={`flex items-center gap-2 rounded-lg p-2 text-white shadow-lg backdrop-blur-md transition ${
                captionsEnabled
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-black/60 hover:bg-black/80"
              }`}
              title="Toggle Captions"
            >
              <Captions className="h-5 w-5" />
              <span className="text-xs font-bold uppercase">
                {captionsEnabled ? "CC On" : "CC Off"}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center bg-slate-900 p-6 text-center font-mono text-sm text-white/65">
          <Video className="mr-2 h-5 w-5" /> Primary stream is connecting.
        </div>
      )}

      {isOrganizer && (
        <div className="flex flex-col gap-4 border-t-2 border-white/30 p-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={openGreenRoom}
              disabled={isWorking}
              className="neu-border border-white bg-white text-black font-mono text-xs font-bold uppercase"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Run A/V check
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void reportState(
                  "disconnected",
                  false,
                  "Presenter reported a lost media connection.",
                )
              }
              disabled={isWorking}
              className="neu-border border-white bg-transparent text-white font-mono text-xs font-bold uppercase"
            >
              <AlertTriangle className="mr-2 h-4 w-4" /> Report feed problem
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadSession()}
              disabled={isWorking}
              className="neu-border border-white bg-transparent text-white font-mono text-xs font-bold uppercase"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
          <div className="w-full">
            <TranscriptionControls eventId={eventId} />
          </div>
        </div>
      )}

      {/* Organizer Green Room Presenter Ping Dashboard */}
      {isOrganizer && (
        <div className="border-t-2 border-white/30 p-4 bg-gray-900">
          <GreenRoomPresenterPingDashboard
            presenters={presenters}
            onPingPresenter={pingPresenter}
            onPingAll={pingAllPresenters}
            onActivateFallback={(reason) => reportState("failed", false, reason)}
            onResetPresenter={resetPresenter}
          />
        </div>
      )}

      {/* Presenter Urgent Behavioral Readiness Modal */}
      <PresenterPingModal ping={activePing} onConfirm={confirmReady} />
    </section>
  );
}
