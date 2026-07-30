import { useState, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { useCollaborativeEditor, type CollaborationUser } from "@/hooks/useCollaborativeEditor";

// ─── Toolbar ──────────────────────────────────────────────────────────────────

interface ToolbarProps {
  editor: ReturnType<typeof useEditor>;
}

function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const btnBase =
    "px-2 py-1 font-mono text-xs font-bold border-2 border-black uppercase transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_#000] active:translate-x-0 active:translate-y-0 active:shadow-none";
  const btnActive = "bg-black text-white";
  const btnInactive = "bg-white text-black";

  return (
    <div className="flex flex-wrap items-center gap-1 border-b-2 border-black px-3 py-2 bg-cream">
      {(
        [
          {
            label: "B",
            action: () => editor.chain().focus().toggleBold().run(),
            active: editor.isActive("bold"),
            title: "Bold",
          },
          {
            label: "I",
            action: () => editor.chain().focus().toggleItalic().run(),
            active: editor.isActive("italic"),
            title: "Italic",
          },
          {
            label: "S",
            action: () => editor.chain().focus().toggleStrike().run(),
            active: editor.isActive("strike"),
            title: "Strikethrough",
          },
          {
            label: "Code",
            action: () => editor.chain().focus().toggleCode().run(),
            active: editor.isActive("code"),
            title: "Inline Code",
          },
        ] as const
      ).map(({ label, action, active, title }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          title={title}
          className={`${btnBase} ${active ? btnActive : btnInactive}`}
        >
          {label}
        </button>
      ))}

      <div className="h-5 w-px bg-black/30 mx-1" />

      {(
        [
          {
            label: "H1",
            action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
            active: editor.isActive("heading", { level: 1 }),
          },
          {
            label: "H2",
            action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            active: editor.isActive("heading", { level: 2 }),
          },
          {
            label: "H3",
            action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            active: editor.isActive("heading", { level: 3 }),
          },
        ] as const
      ).map(({ label, action, active }) => (
        <button
          key={label}
          type="button"
          onClick={action}
          className={`${btnBase} ${active ? btnActive : btnInactive}`}
        >
          {label}
        </button>
      ))}

      <div className="h-5 w-px bg-black/30 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`${btnBase} ${editor.isActive("bulletList") ? btnActive : btnInactive}`}
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`${btnBase} ${editor.isActive("orderedList") ? btnActive : btnInactive}`}
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`${btnBase} ${editor.isActive("blockquote") ? btnActive : btnInactive}`}
      >
        Quote
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={`${btnBase} ${btnInactive}`}
      >
        ───
      </button>

      <div className="h-5 w-px bg-black/30 mx-1" />

      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className={`${btnBase} ${btnInactive} disabled:opacity-40`}
      >
        ↩ Undo
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className={`${btnBase} ${btnInactive} disabled:opacity-40`}
      >
        Redo ↪
      </button>
    </div>
  );
}

// ─── Presence Avatars ────────────────────────────────────────────────────────

function PresenceAvatars({
  users,
  currentUser,
}: {
  users: CollaborationUser[];
  currentUser: CollaborationUser;
}) {
  const allUsers = [currentUser, ...users];
  return (
    <div className="flex items-center gap-1" title="Active collaborators">
      {allUsers.slice(0, 6).map((u) => (
        <div
          key={u.id}
          className="relative flex-shrink-0"
          title={u.id === currentUser.id ? `${u.name} (you)` : u.name}
        >
          {u.avatar_url ? (
            <img
              src={u.avatar_url}
              alt={u.name}
              className="h-7 w-7 rounded-full border-2 object-cover"
              style={{ borderColor: u.color }}
            />
          ) : (
            <div
              className="h-7 w-7 rounded-full border-2 flex items-center justify-center font-mono text-[10px] font-bold text-white"
              style={{ backgroundColor: u.color, borderColor: u.color }}
            >
              {u.name.charAt(0).toUpperCase()}
            </div>
          )}
          {u.id === currentUser.id && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-lime border-2 border-white" />
          )}
        </div>
      ))}
      {allUsers.length > 6 && (
        <span className="font-mono text-xs text-gray-500">+{allUsers.length - 6}</span>
      )}
    </div>
  );
}

// ─── Save Status Indicator ───────────────────────────────────────────────────

function SaveIndicator({ status }: { status: "saved" | "saving" | "unsaved" }) {
  const map = {
    saved: { label: "Saved", color: "text-green-700", icon: "✓" },
    saving: { label: "Saving…", color: "text-yellow-700", icon: "⟳" },
    unsaved: { label: "Unsaved", color: "text-red-700", icon: "●" },
  };
  const { label, color, icon } = map[status];
  return (
    <span className={`font-mono text-xs font-bold flex items-center gap-1 ${color}`}>
      <span className={status === "saving" ? "animate-spin inline-block" : ""}>{icon}</span>
      {label}
    </span>
  );
}

// ─── Main Collaborative Editor ────────────────────────────────────────────────

interface CollaborativeEditorProps {
  noteId: string;
  clubId: string;
  noteTitle: string;
  currentUser: CollaborationUser;
  readOnly?: boolean;
}

export function CollaborativeEditor({
  noteId,
  clubId,
  noteTitle,
  currentUser,
  readOnly = false,
}: CollaborativeEditorProps) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const awarenessHandlersRef = useRef<Set<() => void>>(new Set());
  const [, forceRender] = useState(0);

  const {
    ydoc,
    activeUsers,
    isReady,
    awarenessMapRef,
    awarenessChangeHandlersRef,
    broadcastAwareness,
  } = useCollaborativeEditor({
    noteId,
    clubId,
    currentUser,
    onSaveStatus: setSaveStatus,
  });

  // Register/unregister awareness change handler
  useEffect(() => {
    const handler = () => {
      forceRender((n) => n + 1);
    };
    awarenessChangeHandlersRef.current.add(handler);
    return () => {
      awarenessChangeHandlersRef.current.delete(handler);
    };
  }, [awarenessChangeHandlersRef]);

  const awareness = {
    getLocalState: () => ({
      user: {
        name: currentUser.name,
        color: currentUser.color,
        avatar: currentUser.avatar_url,
      },
    }),
    setLocalStateField: (_field: string, value: Record<string, unknown>) => {
      broadcastAwareness({
        user: currentUser,
        cursor: value,
      });
    },
    getStates: () => {
      const states = new Map<
        number,
        { user: { name: string; color: string; avatar?: string }; cursor?: unknown }
      >();
      let idx = 0;
      for (const [uid, state] of awarenessMapRef.current) {
        if (uid !== currentUser.id) {
          states.set(idx++, {
            user: {
              name: state.user.name,
              color: state.user.color,
              avatar: state.user.avatar_url,
            },
            cursor: state.cursor,
          });
        }
      }
      return states;
    },
    on: (_event: string, handler: () => void) => {
      awarenessHandlersRef.current.add(handler);
    },
    off: (_event: string, handler: () => void) => {
      awarenessHandlersRef.current.delete(handler);
    },
  };

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider: { awareness },
          user: { name: currentUser.name, color: currentUser.color },
          render(user: { name?: string; color?: string }) {
            const cursor = document.createElement("span");
            cursor.classList.add("collaboration-cursor__caret");
            cursor.style.setProperty("--color", user.color ?? "#000");

            const label = document.createElement("span");
            label.classList.add("collaboration-cursor__label");
            label.style.setProperty("--color", user.color ?? "#000");
            label.textContent = user.name ?? "Anonymous";
            cursor.appendChild(label);
            return cursor;
          },
        }),
      ],
      editable: !readOnly,
      editorProps: {
        attributes: {
          class:
            "prose prose-sm max-w-none min-h-[50vh] p-4 focus:outline-none font-mono dark:prose-invert",
        },
      },
    },
    [ydoc, isReady],
  );

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-black border-t-transparent animate-spin" />
          <p className="font-mono text-sm font-bold text-gray-500">Loading document…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0_0_#000]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black px-4 py-2 bg-lime">
        <h2 className="font-display font-black text-sm uppercase tracking-wide truncate max-w-xs">
          {noteTitle}
        </h2>
        <div className="flex items-center gap-3">
          <PresenceAvatars users={activeUsers} currentUser={currentUser} />
          <SaveIndicator status={saveStatus} />
        </div>
      </div>

      {/* Toolbar */}
      {!readOnly && <Toolbar editor={editor} />}

      {/* Editor Canvas */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
