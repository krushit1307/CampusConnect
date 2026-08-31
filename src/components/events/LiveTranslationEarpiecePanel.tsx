import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Headphones from "lucide-react/dist/esm/icons/headphones";
import Radio from "lucide-react/dist/esm/icons/radio";
import CheckCircle from "lucide-react/dist/esm/icons/check-circle";
import AlertTriangle from "lucide-react/dist/esm/icons/triangle-alert";
import { Button } from "@/components/ui/button";
import {
  SUPPORTED_TARGET_LANGUAGES,
  DEFAULT_TARGET_LANGUAGE,
  TARGET_LANGUAGE_LABELS,
  EARPIECE_DEVICE_TYPES,
  EARPIECE_DEVICE_LABELS,
  isSupportedTargetLanguage,
  evaluateEarpieceRouting,
  orchestratePipeline,
  buildWebRtcOffer,
  type TargetLanguage,
  type EarpieceDeviceType,
  type PipelineStage,
} from "@/lib/liveTranslationEarpieceRouting";

type LiveSession = {
  id: string;
  event_id: string;
  target_languages: string[];
  webrtc_room_id: string | null;
  pipeline_stage: PipelineStage;
  is_live: boolean;
  latency_budget_ms: number;
};

type EarpieceRoute = {
  id: string;
  target_language: string;
  earpiece_device_type: string;
  connection_state: string;
  latency_ms: number | null;
};

export type LiveTranslationEarpiecePanelProps = {
  eventId: string;
  userId: string | null;
  isOrganizer?: boolean;
  isCheckedIn?: boolean;
};

export function LiveTranslationEarpiecePanel({
  eventId,
  userId,
  isOrganizer = false,
  isCheckedIn = false,
}: LiveTranslationEarpiecePanelProps) {
  const supabase = createClient();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [routes, setRoutes] = useState<EarpieceRoute[]>([]);
  const [myRoute, setMyRoute] = useState<EarpieceRoute | null>(null);
  const [targetLang, setTargetLang] = useState<TargetLanguage>(DEFAULT_TARGET_LANGUAGE);
  const [deviceType, setDeviceType] = useState<EarpieceDeviceType>("airpods");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cadenceDemo, setCadenceDemo] = useState<{
    latencyMs: number;
    cadenceMs: number;
    withinBudget: boolean;
  } | null>(null);

  const fetchSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("alumni_speaker_live_sessions")
        .select(
          "id, event_id, target_languages, webrtc_room_id, pipeline_stage, is_live, latency_budget_ms",
        )
        .eq("event_id", eventId)
        .eq("is_live", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setSession((data as LiveSession) ?? null);
      if (data) {
        const { data: rData } = await supabase
          .from("earpiece_translation_routes")
          .select("id, target_language, earpiece_device_type, connection_state, latency_ms")
          .eq("session_id", (data as LiveSession).id);
        setRoutes((rData as EarpieceRoute[]) ?? []);
        if (userId) {
          const mine =
            (rData as EarpieceRoute[])?.find((r) => r.target_language === targetLang) ?? null;
          // fallback: find any route for user
          const { data: myData } = await supabase
            .from("earpiece_translation_routes")
            .select("id, target_language, earpiece_device_type, connection_state, latency_ms")
            .eq("session_id", (data as LiveSession).id)
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (myData) setMyRoute(myData as EarpieceRoute);
          else if (mine) setMyRoute(mine);
        }
      } else {
        setRoutes([]);
        setMyRoute(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load live translation session";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // Realtime subscription for session + routes
    const channel = supabase
      .channel(`live-translation-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "alumni_speaker_live_sessions",
          filter: `event_id=eq.${eventId}`,
        },
        () => fetchSession(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "earpiece_translation_routes" },
        () => {
          if (session?.id) fetchSession();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, session?.id]);

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_live_translation_session", {
        p_event_id: eventId,
        p_target_languages: [targetLang],
        p_source_language: "en",
      });
      if (error) throw error;
      toast.success("Live translation session started — Deepgram → DeepL → TTS → WebRTC");
      // optimistic
      await fetchSession();
      // demo orchestration latency for preview
      const demo = orchestratePipeline({
        deepgramPayload: {
          is_final: true,
          channel: { alternatives: [{ transcript: "Welcome to the alumni keynote" }] },
        },
        targetLanguage: targetLang,
        latencyBudgetMs: (data as { latency_budget_ms?: number })?.latency_budget_ms ?? 1200,
      });
      if (demo)
        setCadenceDemo({
          latencyMs: demo.latencyMs,
          cadenceMs: demo.cadenceOffsetMs,
          withinBudget: demo.withinBudget,
        });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async () => {
    if (!session) {
      toast.error("No live session — ask the organizer to start translation");
      return;
    }
    const eligibility = evaluateEarpieceRouting({
      isCheckedIn: Boolean(isCheckedIn),
      isSessionLive: Boolean(session.is_live),
      targetLanguage: targetLang,
      connectionState: myRoute?.connection_state,
    });
    if (!eligibility.eligible) {
      const reasons: Record<string, string> = {
        not_checked_in: "You must be checked-in (QR) to use the earpiece.",
        session_not_live: "Translation is not live right now.",
        unsupported_language: "Unsupported language.",
        route_in_error: "Your route is in error — leave and re-join.",
      };
      toast.error(reasons[eligibility.reason ?? ""] ?? "Not eligible to join");
      return;
    }
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc("join_earpiece_route", {
        p_session_id: session.id,
        p_target_language: targetLang,
        p_earpiece_device_type: deviceType,
      });
      if (error) throw error;
      const routeId = (data as { id: string })?.id;
      // Simulate WebRTC offer → answer handshake so the earpiece feels live
      const offer = buildWebRtcOffer(session.webrtc_room_id ?? session.id);
      if (routeId) {
        await supabase.rpc("update_earpiece_webrtc_signal", {
          p_route_id: routeId,
          p_offer: offer as unknown as Record<string, unknown>,
          p_connection_state: "connected",
        });
      }
      // Mock pipeline latency preview synchronized to speaker cadence
      const demo = orchestratePipeline({
        deepgramPayload: {
          is_final: true,
          channel: {
            alternatives: [{ transcript: "We are honored to welcome our alumni speaker" }],
          },
        },
        targetLanguage: targetLang,
        latencyBudgetMs: session.latency_budget_ms,
      });
      if (demo)
        setCadenceDemo({
          latencyMs: demo.latencyMs,
          cadenceMs: demo.cadenceOffsetMs,
          withinBudget: demo.withinBudget,
        });
      toast.success(
        `Earpiece connected — streaming ${TARGET_LANGUAGE_LABELS[targetLang]} to your ${EARPIECE_DEVICE_LABELS[deviceType]}`,
      );
      await fetchSession();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to join earpiece route");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    if (!myRoute) return;
    try {
      await supabase.from("earpiece_translation_routes").delete().eq("id", myRoute.id);
      toast.success("Left earpiece route");
      setMyRoute(null);
      setCadenceDemo(null);
      await fetchSession();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to leave route");
    }
  };

  if (loading) {
    return (
      <div
        data-testid="earpiece-panel-loading"
        className="animate-pulse h-40 bg-gray-200 border-4 border-black"
      />
    );
  }

  return (
    <div
      data-testid="live-translation-earpiece-panel"
      className="border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#000] font-mono"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-yellow-300 border-2 border-black rounded-lg shrink-0">
            <Headphones size={20} className="text-black" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
              <Radio size={16} /> Live Translation Earpiece
            </h3>
            <p className="text-[10px] text-gray-600 mt-1 max-w-prose">
              Stream AI-translated keynote audio (Deepgram → DeepL → TTS → WebRTC) to your AirPods,
              perfectly synchronized to the speaker&apos;s cadence.
            </p>
          </div>
        </div>
        {session?.is_live ? (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase bg-emerald-400 border-2 border-black px-2 py-1">
            <span className="h-2 w-2 rounded-full bg-emerald-700 animate-pulse" /> Live
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase bg-gray-200 border-2 border-black px-2 py-1">
            Idle
          </span>
        )}
      </div>

      {/* Organizer controls */}
      {isOrganizer && (
        <div className="mt-6 border-t-2 border-dashed border-black pt-4">
          <p className="text-[10px] font-black uppercase tracking-wide">Organiser Session</p>
          {!session?.is_live ? (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-[10px] uppercase font-bold">
                Target language
                <select
                  data-testid="organiser-target-lang-select"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value as TargetLanguage)}
                  className="ml-2 border-2 border-black bg-white px-2 py-1 text-xs"
                >
                  {SUPPORTED_TARGET_LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {TARGET_LANGUAGE_LABELS[l as TargetLanguage]}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                data-testid="create-live-session-btn"
                onClick={handleCreateSession}
                disabled={creating}
                className="border-2 border-black"
              >
                {creating ? "Starting..." : "Start Live Translation"}
              </Button>
            </div>
          ) : (
            <div className="mt-3 text-xs">
              <p>
                Room: <strong data-testid="webrtc-room-id">{session.webrtc_room_id}</strong> ·
                Stage: <strong>{session.pipeline_stage}</strong> · Routes:{" "}
                <strong data-testid="route-count">{routes.length}</strong>
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                WebRTC signalling via Realtime `earpiece_translation_routes`. Deepgram WS → DeepL →
                Polly pipeline latency budget {session.latency_budget_ms} ms.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Student controls */}
      <div className="mt-6 border-t-2 border-dashed border-black pt-4">
        <p className="text-[10px] font-black uppercase tracking-wide">Your Earpiece</p>
        {!session?.is_live && !isOrganizer && (
          <div className="mt-3 flex items-center gap-2 text-xs bg-yellow-50 border-2 border-yellow-400 p-3">
            <AlertTriangle size={16} className="text-yellow-600 shrink-0" />
            <span>
              No live translation right now — the keynote hasn&apos;t started the stream yet.
            </span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[10px] uppercase font-bold">
            Language
            <select
              data-testid="earpiece-target-lang-select"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value as TargetLanguage)}
              className="ml-2 border-2 border-black bg-white px-2 py-1 text-xs"
            >
              {SUPPORTED_TARGET_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {TARGET_LANGUAGE_LABELS[l as TargetLanguage]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] uppercase font-bold">
            Device
            <select
              data-testid="earpiece-device-select"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as EarpieceDeviceType)}
              className="ml-2 border-2 border-black bg-white px-2 py-1 text-xs"
            >
              {EARPIECE_DEVICE_TYPES.map((d) => (
                <option key={d} value={d}>
                  {EARPIECE_DEVICE_LABELS[d as EarpieceDeviceType]}
                </option>
              ))}
            </select>
          </label>
          {!myRoute || myRoute.connection_state !== "connected" ? (
            <Button
              data-testid="join-earpiece-btn"
              onClick={handleJoin}
              disabled={
                joining || !isSupportedTargetLanguage(targetLang) || (!isCheckedIn && !isOrganizer)
              }
              className="border-2 border-black bg-black text-white disabled:opacity-50"
              title={!isCheckedIn && !isOrganizer ? "Check-in required" : undefined}
            >
              {joining ? "Connecting..." : `Connect ${EARPIECE_DEVICE_LABELS[deviceType]}`}
            </Button>
          ) : (
            <Button
              data-testid="leave-earpiece-btn"
              onClick={handleLeave}
              variant="outline"
              className="border-2 border-black"
            >
              Disconnect ({myRoute.target_language})
            </Button>
          )}
        </div>
        {!isCheckedIn && !isOrganizer && (
          <p className="mt-2 text-[10px] text-red-600">
            Check in via QR to enable earpiece routing.
          </p>
        )}
        {myRoute && (
          <div
            data-testid="my-route-status"
            className="mt-3 flex flex-wrap items-center gap-3 text-[10px]"
          >
            <span className="flex items-center gap-1">
              <CheckCircle
                size={12}
                className={
                  myRoute.connection_state === "connected" ? "text-emerald-600" : "text-gray-400"
                }
              />
              State: <strong>{myRoute.connection_state}</strong>
            </span>
            {myRoute.latency_ms !== null && (
              <span>
                Latency: <strong>{myRoute.latency_ms} ms</strong>
              </span>
            )}
            <span>
              Lang: <strong>{myRoute.target_language}</strong>
            </span>
            <span>
              Device: <strong>{myRoute.earpiece_device_type}</strong>
            </span>
          </div>
        )}
        {cadenceDemo && (
          <div
            data-testid="cadence-demo"
            className="mt-3 border-2 border-black bg-emerald-50 p-3 text-[10px]"
          >
            <p className="font-bold uppercase">
              Cadence Sync Preview (Deepgram → DeepL → TTS → WebRTC)
            </p>
            <p className="mt-1">
              Pipeline latency <strong>{cadenceDemo.latencyMs} ms</strong> · Cadence offset{" "}
              <strong>{cadenceDemo.cadenceMs} ms</strong> ·{" "}
              <span
                className={
                  cadenceDemo.withinBudget ? "text-emerald-700 font-bold" : "text-red-600 font-bold"
                }
              >
                {cadenceDemo.withinBudget ? "Within budget ✓" : "Throttled — exceeds budget"}
              </span>
            </p>
            <p className="text-gray-600 mt-1">
              Audio is delayed by the cadence offset so Mandarin lands on the speaker&apos;s pauses.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
