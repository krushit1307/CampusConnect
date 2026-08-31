import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { SupabaseYjsProvider } from "@/lib/supabase/yjsProvider";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Users from "lucide-react/dist/esm/icons/users";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import Eye from "lucide-react/dist/esm/icons/eye";
import { ColorBlindnessSimulationOverlay } from "@/components/events/ColorBlindnessSimulationOverlay";

interface CollaborativeDescriptionEditorProps {
  eventId: string;
  initialDescription: string;
  userId: string;
  userName: string;
  onChange: (value: string) => void;
}

export default function CollaborativeDescriptionEditor({
  eventId,
  initialDescription,
  userId,
  userName,
  onChange,
}: CollaborativeDescriptionEditorProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [showSimulator, setShowSimulator] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to convert Uint8Array to base64
  const uint8ArrayToBase64 = (arr: Uint8Array): string => {
    return btoa(String.fromCharCode.apply(null, arr as any));
  };

  // Helper to convert base64 to Uint8Array
  const base64ToUint8Array = (str: string): Uint8Array => {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  };

  // Save changes to database
  const saveToDatabase = async () => {
    if (!docRef.current || !eventId) return;

    try {
      const stateUpdate = Y.encodeStateAsUpdate(docRef.current);
      const base64State = uint8ArrayToBase64(stateUpdate);

      await supabase.from("event_crdt_states").upsert({
        event_id: eventId,
        state: base64State,
        updated_at: new Date().toISOString(),
      });
      console.log("[CollabEditor] Autosaved CRDT state to DB");
    } catch (err) {
      console.error("[CollabEditor] Error saving CRDT state:", err);
    }
  };

  // Debounced save helper
  const triggerDebouncedSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(saveToDatabase, 2000);
  };

  // Init Yjs Doc and Supabase Provider
  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;

    const init = async () => {
      try {
        // 1. Fetch initial state from event_crdt_states table
        const { data, error } = await supabase
          .from("event_crdt_states")
          .select("state")
          .eq("event_id", eventId)
          .maybeSingle();

        if (data?.state) {
          const binaryUpdate = base64ToUint8Array(data.state);
          Y.applyUpdate(doc, binaryUpdate);
        } else {
          // Fallback to initialDescription if no Yjs CRDT update is stored
          const text = doc.getText("default");
          if (text.toString() === "") {
            text.insert(0, initialDescription || "");
          }
        }
      } catch (err) {
        console.error("[CollabEditor] Init error:", err);
      } finally {
        // 2. Setup Realtime Channel & Provider
        const channel = supabase.channel(`event-collab-editor:${eventId}`);
        const provider = new SupabaseYjsProvider(doc, channel, userId, userName);
        providerRef.current = provider;

        // Monitor active collaborators via Presence
        provider.awareness.on("update", () => {
          const states = Array.from(provider.awareness.getStates().values());
          const users = states.map((s: any) => s.user?.name).filter(Boolean) as string[];
          setActiveUsers(Array.from(new Set(users)));
        });

        setLoading(false);
      }
    };

    init();

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Force immediate flush save on exit
      saveToDatabase();

      if (providerRef.current) {
        providerRef.current.destroy();
      }
      if (docRef.current) {
        docRef.current.destroy();
      }
    };
  }, [eventId, userId, userName]);

  // Setup TipTap Editor configuration
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false, // Collaboration handles history internally
        }),
        Collaboration.configure({
          document: docRef.current || undefined,
        }),
        CollaborationCursor.configure({
          provider: providerRef.current || undefined,
          user: {
            name: userName,
            color: providerRef.current?.awareness.getLocalStateField("user")?.color || "#000",
          },
        }),
      ],
      content: "",
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
        triggerDebouncedSave();
      },
    },
    [loading],
  );

  // Sync collaboration extend bindings once editor has loaded
  useEffect(() => {
    if (editor && docRef.current && providerRef.current) {
      editor.commands.setContent(editor.getHTML());
    }
  }, [editor, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border-2 border-black bg-cream/30 min-h-[160px]">
        <Loader2 className="h-6 w-6 animate-spin text-black mb-2" />
        <span className="font-mono text-xs font-bold text-gray-600">
          Connecting to collab board...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-2 border-black bg-white rounded-none shadow-[2px_2px_0_0_#000] overflow-hidden">
      {/* Editor top menu bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-cream border-b-2 border-black flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`px-2.5 py-1 border border-black font-mono text-xs font-bold transition-all ${
              editor?.isActive("bold") ? "bg-black text-white" : "bg-white hover:bg-gray-100"
            }`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`px-2.5 py-1 border border-black font-mono text-xs font-bold italic transition-all ${
              editor?.isActive("italic") ? "bg-black text-white" : "bg-white hover:bg-gray-100"
            }`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`px-2.5 py-1 border border-black font-mono text-xs font-bold transition-all ${
              editor?.isActive("bulletList") ? "bg-black text-white" : "bg-white hover:bg-gray-100"
            }`}
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className={`px-2.5 py-1 border-2 border-black font-mono text-xs font-bold uppercase transition-all shadow-[1px_1px_0_0_#000] flex items-center gap-1 ${
              showSimulator ? "bg-purple-400 text-black" : "bg-purple-100 hover:bg-purple-200 text-purple-950"
            }`}
            data-testid="editor-colorblind-simulator-toggle"
          >
            <Eye className="h-3.5 w-3.5" />
            {showSimulator ? "Close CVD Simulator" : "CVD Simulator 👁️"}
          </button>
        </div>

        {/* Active Collaborators count */}
        <div className="flex items-center gap-1.5 bg-lime neu-border px-2.5 py-1 font-mono text-[10px] font-bold uppercase shadow-[1px_1px_0_0_#000]">
          <Users className="h-3.5 w-3.5" />
          <span>{activeUsers.length} Editing</span>
        </div>
      </div>

      {/* Real-Time Color Blindness Simulation Overlay */}
      {showSimulator ? (
        <div className="p-3 bg-purple-50 border-t-2 border-black">
          <ColorBlindnessSimulationOverlay>
            <div className="p-3 min-h-[160px] font-mono text-sm leading-relaxed prose prose-sm max-w-none focus:outline-hidden bg-white border-2 border-black">
              <EditorContent editor={editor} />
            </div>
          </ColorBlindnessSimulationOverlay>
        </div>
      ) : (
        /* Editor Content Area */
        <div className="p-3 min-h-[160px] font-mono text-sm leading-relaxed prose prose-sm max-w-none focus:outline-hidden">
          <EditorContent editor={editor} />
        </div>
      )}

      {/* Connection notice */}
      <div className="px-3 py-1.5 bg-sky/10 border-t border-black/10 flex items-center gap-1.5 font-mono text-[10px] text-gray-500">
        <AlertCircle className="h-3 w-3" />
        <span>Syncing to Supabase Realtime channel</span>
      </div>


      {/* Inline styles for collaborative caret rendering */}
      <style>{`
        .ProseMirror {
          min-height: 140px;
          outline: none;
        }
        .collaboration-cursor__caret {
          position: relative;
          margin-left: -1px;
          margin-right: -1px;
          border-left: 2px solid;
          border-right: 2px solid;
          border-color: currentColor;
          word-break: normal;
          pointer-events: none;
        }
        .collaboration-cursor__label {
          position: absolute;
          top: -1.4em;
          left: -2px;
          font-size: 10px;
          font-family: monospace;
          font-weight: bold;
          line-height: normal;
          user-select: none;
          color: #fff;
          padding: 1px 4px;
          white-space: nowrap;
          border-radius: 3px 3px 3px 0;
          background: currentColor;
        }
      `}</style>
    </div>
  );
}
