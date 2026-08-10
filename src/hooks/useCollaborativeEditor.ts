import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CollaborationUser {
  id: string;
  name: string;
  color: string;
  avatar_url?: string;
}

interface AwarenessState {
  user: CollaborationUser;
  cursor?: unknown;
}

// ─── Colour palette for cursors ─────────────────────────────────────────────

const CURSOR_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#76D7C4",
];

export function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

// ─── Base64 helpers ──────────────────────────────────────────────────────────

export function uint8ToBase64(arr: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < arr.byteLength; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

export function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseCollaborativeEditorOptions {
  noteId: string;
  clubId: string;
  currentUser: CollaborationUser;
  onSaveStatus?: (status: "saved" | "saving" | "unsaved") => void;
}

export function useCollaborativeEditor({
  noteId,
  currentUser,
  onSaveStatus,
}: UseCollaborativeEditorOptions) {
  const supabase = createClient();
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([]);
  const [isReady, setIsReady] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const awarenessMapRef = useRef<Map<string, AwarenessState>>(new Map());
  const awarenessChangeHandlersRef = useRef<Set<() => void>>(new Set());

  // ── Load initial state from Supabase ──
  useEffect(() => {
    async function loadState() {
      const { data, error } = await supabase
        .from("club_meeting_notes")
        .select("yjs_state")
        .eq("id", noteId)
        .single();

      if (!error && data?.yjs_state) {
        try {
          Y.applyUpdate(ydocRef.current, base64ToUint8(data.yjs_state));
        } catch (err) {
          console.error("[CollabNotes] Failed to apply initial Yjs state:", err);
        }
      }
      setIsReady(true);
    }

    loadState();
  }, [noteId]);

  // ── Supabase Realtime channel for Yjs updates, awareness, and presence ──
  useEffect(() => {
    if (!isReady) return;

    const channelName = `collab-notes:${noteId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUser.id } },
    });
    channelRef.current = channel;

    // Presence: track active collaborators
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<CollaborationUser>();
        const users = Object.values(state)
          .flat()
          .filter((u) => u.id !== currentUser.id)
          .map((u) => ({
            id: u.id,
            name: u.name,
            color: u.color,
            avatar_url: u.avatar_url,
          }));
        setActiveUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        const p = newPresences[0] as unknown as CollaborationUser | undefined;
        toast.message(`${p?.name ?? "Someone"} joined`, {
          duration: 2000,
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const p = leftPresences[0] as unknown as CollaborationUser | undefined;
        toast.message(`${p?.name ?? "Someone"} left`, {
          duration: 2000,
        });
      });

    // Broadcast: receive Yjs delta updates from peers
    channel.on(
      "broadcast",
      { event: "yjs-update" },
      ({ payload }: { payload: { update: string; senderId: string } }) => {
        if (payload.senderId === currentUser.id) return;
        try {
          Y.applyUpdate(ydocRef.current, base64ToUint8(payload.update));
        } catch (err) {
          console.error("[CollabNotes] Failed to apply peer update:", err);
        }
      },
    );

    // Broadcast: receive awareness state from peers
    channel.on(
      "broadcast",
      { event: "yjs-awareness" },
      ({ payload }: { payload: { userStates: string } }) => {
        try {
          const parsed: Record<string, AwarenessState> = JSON.parse(payload.userStates);
          for (const [userId, state] of Object.entries(parsed)) {
            if (userId !== currentUser.id) {
              awarenessMapRef.current.set(userId, state);
            }
          }
          awarenessChangeHandlersRef.current.forEach((fn) => fn());
        } catch (err) {
          console.error("[CollabNotes] Failed to apply awareness update:", err);
        }
      },
    );

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          id: currentUser.id,
          name: currentUser.name,
          color: currentUser.color,
          avatar_url: currentUser.avatar_url,
        });
      }
    });

    // Broadcast Yjs doc changes to peers
    function onUpdate(update: Uint8Array) {
      channel.send({
        type: "broadcast",
        event: "yjs-update",
        payload: { update: uint8ToBase64(update), senderId: currentUser.id },
      });
    }

    ydocRef.current.on("update", onUpdate);

    return () => {
      ydocRef.current.off("update", onUpdate);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [isReady, noteId, currentUser]);

  const lastSnapshotTimeRef = useRef<number>(Date.now());

  // ── Auto-snapshot helper ──
  const maybeCreateAutoSnapshot = useCallback(
    async (state: string, text: string) => {
      const now = Date.now();
      // Auto-snapshot every 5 minutes if document text exists
      if (now - lastSnapshotTimeRef.current > 300_000 && text.trim().length > 0) {
        lastSnapshotTimeRef.current = now;
        try {
          const { data: note } = await supabase
            .from("club_meeting_notes")
            .select("title")
            .eq("id", noteId)
            .single();

          const { count } = await supabase
            .from("club_meeting_note_versions")
            .select("id", { count: "exact", head: true })
            .eq("note_id", noteId);

          const versionNum = (count || 0) + 1;

          await supabase.from("club_meeting_note_versions").insert({
            note_id: noteId,
            version_number: versionNum,
            title: note?.title || "Meeting Note",
            content_text: text,
            yjs_state: state,
            summary: `Auto-snapshot v${versionNum}`,
            created_by: currentUser.id,
          });
        } catch {
          // Ignore background auto-snapshot error
        }
      }
    },
    [noteId, currentUser.id],
  );

  // ── Persist to Supabase DB (debounced, 2s) ──
  const persistState = useCallback(async () => {
    onSaveStatus?.("saving");
    const state = uint8ToBase64(Y.encodeStateAsUpdate(ydocRef.current));
    const text = ydocRef.current.getText("prosemirror").toString();

    const { error } = await supabase
      .from("club_meeting_notes")
      .update({ yjs_state: state, content_text: text, updated_at: new Date().toISOString() })
      .eq("id", noteId);

    onSaveStatus?.(error ? "unsaved" : "saved");
    if (!error) {
      void maybeCreateAutoSnapshot(state, text);
    } else {
      console.error("[CollabNotes] Persist error:", error);
    }
  }, [noteId, onSaveStatus, maybeCreateAutoSnapshot]);

  // Schedule autosave whenever the Yjs doc changes
  useEffect(() => {
    if (!isReady) return;

    function onUpdate() {
      onSaveStatus?.("unsaved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(persistState, 2000);
    }

    ydocRef.current.on("update", onUpdate);
    return () => {
      ydocRef.current.off("update", onUpdate);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [isReady, persistState, onSaveStatus]);

  // ── Broadcast local awareness state ──
  const broadcastAwareness = useCallback(
    (awarenessState: AwarenessState) => {
      awarenessMapRef.current.set(currentUser.id, awarenessState);
      if (channelRef.current) {
        const payload: Record<string, AwarenessState> = {};
        for (const [uid, state] of awarenessMapRef.current) {
          if (uid !== currentUser.id) {
            payload[uid] = state;
          }
        }
        payload[currentUser.id] = awarenessState;
        channelRef.current.send({
          type: "broadcast",
          event: "yjs-awareness",
          payload: { userStates: JSON.stringify(payload) },
        });
      }
    },
    [currentUser],
  );

  return {
    ydoc: ydocRef.current,
    activeUsers,
    isReady,
    awarenessMapRef,
    awarenessChangeHandlersRef,
    broadcastAwareness,
  };
}
