import { useEffect, useState, useMemo } from "react";
import * as Y from "yjs";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { SupabaseProvider } from "@supabase-labs/y-supabase";
import { createClient } from "@/lib/supabase/client";
import { fetchNoteSnapshot, saveNoteSnapshot } from "@/services/collaborativeNotes";
import { PresenceList } from "./PresenceList";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import "./CollaborativeEditor.css"; // We'll need some minimal CSS for cursors

interface CollaborativeEditorProps {
  groupId: string;
  user: {
    id: string;
    name: string;
    color?: string;
  };
}

// Generate a random color if not provided
const colors = ["#958DF1", "#F98181", "#FBCE41", "#FF79C6", "#8BE9FD", "#50FA7B"];
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

export function CollaborativeEditor({ groupId, user }: CollaborativeEditorProps) {
  const [provider, setProvider] = useState<SupabaseProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const ydoc = useMemo(() => new Y.Doc(), []);

  const userColor = user.color || getRandomColor();

  useEffect(() => {
    let active = true;

    async function initEditor() {
      // 1. Fetch the latest snapshot from DB
      const snapshot = await fetchNoteSnapshot(groupId);
      if (!active) return;

      // 2. Apply snapshot to ydoc if it exists
      if (snapshot) {
        try {
          Y.applyUpdate(ydoc, snapshot);
        } catch (error) {
          console.error("Failed to apply yjs snapshot:", error);
        }
      }

      // 3. Connect to Supabase Realtime Provider
      const supabase = createClient();
      const supaProvider = new SupabaseProvider(`group_notes:${groupId}`, ydoc, supabase, {
        awareness: true,
      });

      // 4. Set our presence awareness
      const awareness = supaProvider.getAwareness();
      if (awareness) {
        awareness.setLocalStateField("user", {
          name: user.name,
          color: userColor,
        });
      }

      setProvider(supaProvider);
      setIsLoading(false);

      // 5. Set up our manual debounce save for persistence
      let timeoutId: ReturnType<typeof setTimeout>;
      const onUpdate = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          saveNoteSnapshot(groupId, ydoc);
        }, 3000); // Debounce save every 3 seconds of inactivity
      };

      ydoc.on("update", onUpdate);

      return () => {
        ydoc.off("update", onUpdate);
        supaProvider.destroy();
      };
    }

    initEditor();

    return () => {
      active = false;
    };
  }, [groupId, ydoc, user.name, userColor]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider: provider,
          user: {
            name: user.name,
            color: userColor,
          },
        }),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-sm sm:prose-base focus:outline-none min-h-[300px]",
        },
      },
    },
    [provider],
  );

  if (isLoading || !provider) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="neu-border bg-white overflow-hidden">
      {/* Editor Toolbar (minimal) */}
      <div className="flex flex-wrap items-center justify-between border-b-2 border-black bg-peach px-4 py-2">
        <div className="flex gap-2 font-mono text-xs font-bold uppercase">Collaborative Notes</div>
        <PresenceList provider={provider} />
      </div>

      {/* The Editor itself */}
      <div className="p-4 md:p-6 bg-cream">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
