import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { CollaborativeEditor } from "@/components/CollaborativeEditor";
import { pickColor } from "@/hooks/useCollaborativeEditor";
import type { CollaborationUser } from "@/hooks/useCollaborativeEditor";
import { toast } from "sonner";
import Plus from "lucide-react/dist/esm/icons/plus";
import FileText from "lucide-react/dist/esm/icons/file-text";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Clock from "lucide-react/dist/esm/icons/clock";
import Users from "lucide-react/dist/esm/icons/users";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { User } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingNote {
  id: string;
  club_id: string;
  title: string;
  content_text: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

// ─── Main Route ───────────────────────────────────────────────────────────────

export default function CollaborativeNotesRoute() {
  const { slug = "" } = useParams<{ slug: string }>();
  const supabase = createClient();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
  }, []);

  // ── Fetch club ──
  const { data: club } = useQuery<{ id: string; name: string; slug: string } | null>({
    queryKey: ["club-basic", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, slug")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // ── Fetch membership/role ──
  useEffect(() => {
    if (!club || !currentUser) return;
    supabase
      .from("club_members")
      .select("role_id, club_roles (permissions_level)")
      .eq("club_id", club.id)
      .eq("user_id", currentUser.id)
      .eq("status", "approved")
      .single()
      .then(({ data }) => {
        const level = Array.isArray(data?.club_roles)
          ? data?.club_roles[0]?.permissions_level
          : (data?.club_roles as unknown as { permissions_level: number } | null)
              ?.permissions_level;
        setIsAdmin((level ?? 0) >= 100);
      });
  }, [club, currentUser]);

  // ── Fetch notes list ──
  const {
    data: notes = [],
    refetch: refetchNotes,
    isLoading: isNotesLoading,
  } = useQuery<MeetingNote[]>({
    queryKey: ["club-meeting-notes", club?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_meeting_notes")
        .select(
          "id, club_id, title, content_text, created_at, updated_at, created_by, profiles(full_name, avatar_url)",
        )
        .eq("club_id", club!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as MeetingNote[]) ?? [];
    },
    enabled: !!club?.id,
  });

  // ── Create note mutation ──
  const createNote = useMutation({
    mutationFn: async (title: string) => {
      if (!club || !currentUser) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("club_meeting_notes")
        .insert({ club_id: club.id, title, created_by: currentUser.id })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Note created");
      refetchNotes();
      setActiveNoteId(data.id);
    },
    onError: () => toast.error("Failed to create note"),
  });

  // ── Delete note mutation ──
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("club_meeting_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note deleted");
      setActiveNoteId(null);
      refetchNotes();
    },
    onError: () => toast.error("Failed to delete note"),
  });

  // ── Active note ──
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  // ── Current user as collaboration user ──
  const collabUser: CollaborationUser | null = currentUser
    ? {
        id: currentUser.id,
        name:
          (currentUser.user_metadata?.full_name as string) ||
          currentUser.email?.split("@")[0] ||
          "Anonymous",
        color: pickColor(currentUser.id),
        avatar_url: currentUser.user_metadata?.avatar_url as string | undefined,
      }
    : null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream dark:bg-zinc-900">
        {/* ─── Page Header ─── */}
        <header className="sticky top-0 z-10 bg-lime border-b-2 border-black px-4 py-3 flex items-center gap-4">
          <Link
            to={`/clubs/${slug}`}
            className="flex items-center gap-1 font-mono text-xs font-bold uppercase hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Club
          </Link>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="font-display font-black text-sm uppercase">
              {club?.name} — Meeting Notes
            </span>
          </div>
          <div className="flex-1" />
          {isAdmin && (
            <Button
              size="sm"
              className="neu-border neu-press bg-black text-white font-mono text-xs font-bold uppercase gap-1"
              onClick={() => {
                const title = prompt("Note title:", `Meeting ${new Date().toLocaleDateString()}`);
                if (title?.trim()) createNote.mutate(title.trim());
              }}
            >
              <Plus className="h-3 w-3" />
              New Note
            </Button>
          )}
        </header>

        <div className="flex h-[calc(100vh-56px)]">
          {/* ─── Sidebar: Notes List ─── */}
          <aside className="w-72 flex-shrink-0 border-r-2 border-black overflow-y-auto bg-white dark:bg-zinc-800">
            <div className="p-3 border-b-2 border-black">
              <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
                Documents
              </h2>
            </div>

            {isNotesLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 w-full bg-gray-100 dark:bg-zinc-700 animate-pulse" />
                ))}
              </div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center">
                <FileText className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="font-mono text-xs text-gray-500">
                  {isAdmin ? "Create the first meeting note." : "No meeting notes yet."}
                </p>
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setActiveNoteId(note.id)}
                      className={`w-full text-left p-3 border-2 transition-all group
                        ${
                          activeNoteId === note.id
                            ? "border-black bg-lime shadow-[3px_3px_0_0_#000]"
                            : "border-transparent hover:border-black hover:shadow-[2px_2px_0_0_#000]"
                        }`}
                    >
                      <p className="font-mono text-xs font-bold uppercase truncate">{note.title}</p>
                      {note.content_text && (
                        <p className="font-mono text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                          {note.content_text}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-gray-400">
                        <Clock className="h-2.5 w-2.5" />
                        <span className="font-mono text-[9px]">{formatDate(note.updated_at)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* ─── Main: Editor ─── */}
          <main className="flex-1 overflow-y-auto p-4">
            {activeNote && collabUser ? (
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Note meta + delete */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-500" />
                    <span className="font-mono text-xs text-gray-500">
                      Real-time collaboration active
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold bg-lime border-2 border-black uppercase">
                      Live
                    </span>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this note permanently?")) {
                          deleteNote.mutate(activeNote.id);
                        }
                      }}
                      className="flex items-center gap-1 font-mono text-xs font-bold text-red-600 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  )}
                </div>

                <ErrorBoundary>
                  <CollaborativeEditor
                    noteId={activeNote.id}
                    clubId={activeNote.club_id}
                    noteTitle={activeNote.title}
                    currentUser={collabUser}
                    readOnly={!isAdmin}
                  />
                </ErrorBoundary>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="border-4 border-black bg-white p-8 shadow-[6px_6px_0_0_#000] max-w-sm">
                  <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="font-display font-black text-xl uppercase mb-2">
                    No Note Selected
                  </h3>
                  <p className="font-mono text-sm text-gray-500">
                    {notes.length > 0
                      ? "Choose a note from the sidebar to start collaborating."
                      : isAdmin
                        ? "Create your first meeting note using the button above."
                        : "No meeting notes are available for this club yet."}
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </SiteShell>
  );
}
