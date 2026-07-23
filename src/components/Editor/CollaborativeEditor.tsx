import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { createClient } from "@/lib/supabase/client";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Wifi,
  WifiOff,
  RefreshCw,
  Users,
} from "lucide-react";
import type { User, RealtimeChannel } from "@supabase/supabase-js";

// Safe base64 conversion for Uint8Array
function uint8ArrayToBase64(arr: Uint8Array): string {
  let bin = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = bin.charCodeAt(i);
  }
  return arr;
}

// Curated palette of vibrant user presence colors
const COLLABORATOR_COLORS = [
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#8b5cf6", // Violet
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
];

interface Collaborator {
  clientId: number;
  name: string;
  color: string;
  avatarUrl?: string;
  initials: string;
}

interface CollaborativeEditorProps {
  eventId: string;
  user: User | null;
  onSave?: (text: string) => void;
}

export function CollaborativeEditor({ eventId, user, onSave }: CollaborativeEditorProps) {
  const supabase = createClient();

  // States
  const [doc] = useState(() => new Y.Doc());
  const [awareness] = useState(() => new Awareness(doc));
  const [syncStatus, setSyncStatus] = useState<"connecting" | "syncing" | "synced" | "offline">(
    "connecting",
  );
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    color: string;
    avatarUrl?: string;
  } | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 1. Load user profile for cursors
  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setUserProfile({
          name: "Anonymous Admin",
          color: COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)],
        });
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      const name =
        error || !data
          ? user.email?.split("@")[0] || "Club Admin"
          : `${data.first_name} ${data.last_name}`;

      const color = COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];

      setUserProfile({
        name,
        color,
        avatarUrl: data?.avatar_url || undefined,
      });
    }

    loadProfile();
  }, [user]);

  // 2. Fetch initial document state from DB Edge Function
  useEffect(() => {
    async function fetchInitialState() {
      try {
        setSyncStatus("syncing");
        const { data: session } = await supabase.auth.getSession();

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crdt-sync?eventId=${eventId}`,
          {
            headers: {
              Authorization: `Bearer ${session?.session?.access_token || ""}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
            },
          },
        );

        if (!response.ok) {
          throw new Error("Failed to load document state");
        }

        const data = await response.json();
        if (data.state) {
          const update = base64ToUint8Array(data.state);
          Y.applyUpdate(doc, update, "initial");
        }
      } catch (err) {
        console.error("Error fetching initial editor state:", err);
      } finally {
        setIsLoaded(true);
        setSyncStatus("synced");
      }
    }

    fetchInitialState();
  }, [eventId, doc]);

  // 3. Set up Supabase Realtime channel and bind events to Yjs
  useEffect(() => {
    if (!isLoaded || !userProfile) return;

    setSyncStatus("connecting");
    const channelName = `event_crdt:${eventId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    // A. Bind incoming broadcast events
    channel
      .on("broadcast", { event: "sync-step-1" }, ({ payload }) => {
        // Step 1: Received client's state vector. Respond with our missing changes.
        try {
          const remoteVector = base64ToUint8Array(payload.vector);
          const updateBytes = Y.encodeStateAsUpdate(doc, remoteVector);

          channel.send({
            type: "broadcast",
            event: "sync-step-2",
            payload: { update: uint8ArrayToBase64(updateBytes) },
          });
        } catch (e) {
          console.error("Error handling sync-step-1:", e);
        }
      })
      .on("broadcast", { event: "sync-step-2" }, ({ payload }) => {
        // Step 2: Received update delta from remote. Apply locally.
        try {
          const updateBytes = base64ToUint8Array(payload.update);
          Y.applyUpdate(doc, updateBytes, "remote");
        } catch (e) {
          console.error("Error handling sync-step-2:", e);
        }
      })
      .on("broadcast", { event: "yjs-update" }, ({ payload }) => {
        // Received normal live keystroke/edit delta. Apply locally.
        try {
          const updateBytes = base64ToUint8Array(payload.update);
          Y.applyUpdate(doc, updateBytes, "remote");
        } catch (e) {
          console.error("Error handling yjs-update:", e);
        }
      })
      .on("broadcast", { event: "awareness-update" }, () => {
        // Received cursor/presence updates
        // Handled automatically via Presence tracking for robustness and low-latency
      });

    // B. Handle subscription status
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncStatus("synced");

        // Broadcast our state vector so others sync with us
        const stateVector = Y.encodeStateVector(doc);
        channel.send({
          type: "broadcast",
          event: "sync-step-1",
          payload: { vector: uint8ArrayToBase64(stateVector) },
        });

        // Broadcast local awareness state
        const localAwarenessState = {
          clientId: doc.clientID,
          name: userProfile.name,
          color: userProfile.color,
          avatarUrl: userProfile.avatarUrl,
          initials: userProfile.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase(),
        };

        channel.track({ user: localAwarenessState });
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        setSyncStatus("offline");
      }
    });

    // C. Handle presence tracking via Supabase's built-in presence
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineCollaborators: Collaborator[] = [];

      Object.keys(state).forEach((key) => {
        const presences = state[key] as { user?: Collaborator }[];
        presences.forEach((p) => {
          if (p.user && p.user.clientId !== doc.clientID) {
            onlineCollaborators.push(p.user);
          }
        });
      });

      setCollaborators(onlineCollaborators);
    });

    channel.on("presence", { event: "join" }, ({ newPresences }) => {
      // Trigger a sync request when a new member joins to ensure they get the absolute latest state
      const stateVector = Y.encodeStateVector(doc);
      channel.send({
        type: "broadcast",
        event: "sync-step-1",
        payload: { vector: uint8ArrayToBase64(stateVector) },
      });
    });

    // D. Bind local Y.Doc updates to broadcast and save to database
    const handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== "remote" && origin !== "initial") {
        setSyncStatus("syncing");

        // 1. Broadcast delta update to other users
        channel.send({
          type: "broadcast",
          event: "yjs-update",
          payload: { update: uint8ArrayToBase64(update) },
        });

        // 2. Debounce database persist API calls
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(async () => {
          try {
            const { data: session } = await supabase.auth.getSession();
            const fullDocState = Y.encodeStateAsUpdate(doc);

            // Get editor text content safely (fallback if editor isn't ready)
            const textContent = doc.getText("default").toString();

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crdt-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session?.session?.access_token || ""}`,
                apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
              },
              body: JSON.stringify({
                eventId,
                update: uint8ArrayToBase64(fullDocState),
                textDescription: textContent,
              }),
            });

            if (res.ok) {
              setSyncStatus("synced");
              if (onSave) {
                onSave(textContent);
              }
            } else {
              setSyncStatus("offline");
            }
          } catch (err) {
            console.error("Error debouncing save state:", err);
            setSyncStatus("offline");
          }
        }, 2500); // 2.5s debounce to batch typing updates
      }
    };

    doc.on("update", handleDocUpdate);

    // E. Setup Yjs Awareness configuration
    awareness.setLocalStateField("user", {
      name: userProfile.name,
      color: userProfile.color,
    });

    return () => {
      doc.off("update", handleDocUpdate);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [isLoaded, userProfile, eventId, doc, awareness]);

  // 4. Setup Tiptap Editor
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false, // Collaboration extension handles undo/redo history itself
        }),
        Collaboration.configure({
          document: doc,
          field: "default",
        }),
        CollaborationCursor.configure({
          provider: {
            awareness: awareness,
          } as unknown as { awareness: Awareness },
          user: userProfile
            ? {
                name: userProfile.name,
                color: userProfile.color,
              }
            : undefined,
        }),
      ],
      editorProps: {
        attributes: {
          class:
            "prose max-w-none text-black focus:outline-none min-h-[180px] p-4 text-sm font-sans leading-relaxed bg-white rounded-b border-x-2 border-b-2 border-black",
        },
      },
    },
    [isLoaded, userProfile],
  );

  if (!isLoaded || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[220px] bg-violet-400 border-2 border-black rounded p-8 animate-pulse">
        <RefreshCw className="h-8 w-8 text-black animate-spin mb-2" />
        <span className="font-mono text-xs font-bold text-black uppercase">
          Loading collaborative document...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col rounded border-2 border-black bg-cream shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
      {/* Editor CSS styles for collaboration cursor overlay */}
      <style>{`
        .ProseMirror .collaboration-cursor__caret {
          border-left: 2px solid;
          border-right: 2px solid;
          margin-left: -1px;
          margin-right: -1px;
          pointer-events: none;
          position: relative;
          word-break: normal;
        }
        .ProseMirror .collaboration-cursor__label {
          border-radius: 3px 3px 3px 0;
          color: #fff;
          font-family: monospace;
          font-size: 10px;
          font-weight: bold;
          left: -1px;
          line-height: normal;
          padding: 2px 4px;
          position: absolute;
          top: -1.4em;
          user-select: none;
          white-space: nowrap;
        }
      `}</style>

      {/* Connection Header & Collaborators List */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black bg-violet-500 p-3">
        <div className="flex items-center gap-2">
          {syncStatus === "synced" && (
            <span className="flex items-center gap-1 bg-emerald-300 text-black border border-black font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              <Wifi size={10} className="text-emerald-700" />
              Connected
            </span>
          )}
          {syncStatus === "syncing" && (
            <span className="flex items-center gap-1 bg-amber-300 text-black border border-black font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              <RefreshCw size={10} className="text-amber-700 animate-spin" />
              Syncing
            </span>
          )}
          {syncStatus === "connecting" && (
            <span className="flex items-center gap-1 bg-blue-300 text-black border border-black font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              <RefreshCw size={10} className="text-blue-700 animate-spin" />
              Connecting
            </span>
          )}
          {syncStatus === "offline" && (
            <span className="flex items-center gap-1 bg-rose-300 text-black border border-black font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-[1px_1px_0px_rgba(0,0,0,1)] animate-pulse">
              <WifiOff size={10} className="text-rose-700" />
              Offline
            </span>
          )}
          <span className="font-mono text-xs font-bold text-black uppercase hidden sm:inline">
            Event Description
          </span>
        </div>

        {/* Collaborators */}
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-2">
            {/* Local User */}
            <div
              className="h-7 w-7 rounded-full border border-black flex items-center justify-center text-[10px] font-mono font-bold text-white relative group"
              style={{ backgroundColor: userProfile.color }}
              title={`${userProfile.name} (You)`}
            >
              {userProfile.avatarUrl ? (
                <img
                  src={userProfile.avatarUrl}
                  alt="Avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                userProfile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()
              )}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 border border-black"></span>
            </div>

            {/* Remote Collaborators */}
            {collaborators.map((col) => (
              <div
                key={col.clientId}
                className="h-7 w-7 rounded-full border border-black flex items-center justify-center text-[10px] font-mono font-bold text-white transition-transform hover:scale-105 group relative"
                style={{ backgroundColor: col.color }}
                title={col.name}
              >
                {col.avatarUrl ? (
                  <img
                    src={col.avatarUrl}
                    alt="Avatar"
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  col.initials
                )}
              </div>
            ))}
          </div>

          {collaborators.length > 0 && (
            <span className="flex items-center gap-1 text-xs font-mono font-bold bg-white text-black border border-black rounded px-1.5 py-0.5 shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              <Users size={12} />
              {collaborators.length + 1}
            </span>
          )}
        </div>
      </div>

      {/* Editor Menu Bar */}
      {editor && (
        <div className="flex flex-wrap items-center gap-1 border-b-2 border-black bg-cream p-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded border border-black text-black transition-all hover:bg-teal-200 hover:scale-105 ${editor.isActive("bold") ? "bg-teal-400 font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]" : "bg-white"}`}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded border border-black text-black transition-all hover:bg-teal-200 hover:scale-105 ${editor.isActive("italic") ? "bg-teal-400 font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]" : "bg-white"}`}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <div className="h-6 w-[1px] bg-black/30 mx-1"></div>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded border border-black text-black transition-all hover:bg-teal-200 hover:scale-105 ${editor.isActive("bulletList") ? "bg-teal-400 font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]" : "bg-white"}`}
            title="Bullet List"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded border border-black text-black transition-all hover:bg-teal-200 hover:scale-105 ${editor.isActive("orderedList") ? "bg-teal-400 font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]" : "bg-white"}`}
            title="Ordered List"
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded border border-black text-black transition-all hover:bg-teal-200 hover:scale-105 ${editor.isActive("blockquote") ? "bg-teal-400 font-bold shadow-[1px_1px_0px_rgba(0,0,0,1)]" : "bg-white"}`}
            title="Blockquote"
          >
            <Quote size={16} />
          </button>
          <div className="h-6 w-[1px] bg-black/30 mx-1"></div>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded border border-black bg-white text-black transition-all hover:bg-teal-200 hover:scale-105 disabled:opacity-50 disabled:pointer-events-none"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded border border-black bg-white text-black transition-all hover:bg-teal-200 hover:scale-105 disabled:opacity-50 disabled:pointer-events-none"
            title="Redo"
          >
            <Redo size={16} />
          </button>
        </div>
      )}

      {/* Editor Content Area */}
      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
