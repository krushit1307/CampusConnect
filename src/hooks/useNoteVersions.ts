import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface NoteVersion {
  id: string;
  note_id: string;
  version_number: number;
  title: string | null;
  content_text: string | null;
  yjs_state: string | null;
  summary: string | null;
  created_by: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export function useNoteVersions(noteId: string | null) {
  const supabase = createClient();
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // ── Fetch versions list ──
  const fetchVersions = useCallback(async () => {
    if (!noteId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("club_meeting_note_versions")
        .select(
          `
          id,
          note_id,
          version_number,
          title,
          content_text,
          yjs_state,
          summary,
          created_by,
          created_at,
          profiles (full_name, avatar_url)
        `,
        )
        .eq("note_id", noteId)
        .order("version_number", { ascending: false });

      if (error) throw error;
      setVersions((data as unknown as NoteVersion[]) ?? []);
    } catch (err) {
      console.error("[useNoteVersions] Error fetching versions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // ── Create a version snapshot ──
  const createSnapshot = useCallback(
    async (
      title: string,
      contentText: string,
      yjsState: string,
      summary?: string,
    ): Promise<NoteVersion | null> => {
      if (!noteId) return null;
      setIsSaving(true);
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes.user?.id ?? null;

        // Calculate next version number
        const nextVersionNum = versions.length > 0 ? versions[0].version_number + 1 : 1;

        const { data, error } = await supabase
          .from("club_meeting_note_versions")
          .insert({
            note_id: noteId,
            version_number: nextVersionNum,
            title,
            content_text: contentText,
            yjs_state: yjsState,
            summary: summary || `Snapshot v${nextVersionNum}`,
            created_by: userId,
          })
          .select(
            `
            id,
            note_id,
            version_number,
            title,
            content_text,
            yjs_state,
            summary,
            created_by,
            created_at,
            profiles (full_name, avatar_url)
          `,
          )
          .single();

        if (error) throw error;
        toast.success(`Snapshot v${nextVersionNum} saved`);
        await fetchVersions();
        return (data as unknown as NoteVersion) ?? null;
      } catch (err) {
        console.error("[useNoteVersions] Error creating snapshot:", err);
        toast.error("Failed to save version snapshot");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [noteId, versions, fetchVersions],
  );

  // ── Restore a historical version to the active note ──
  const restoreVersion = useCallback(
    async (version: NoteVersion): Promise<boolean> => {
      if (!noteId || !version.yjs_state) return false;
      setIsRestoring(true);
      try {
        const { error } = await supabase
          .from("club_meeting_notes")
          .update({
            yjs_state: version.yjs_state,
            content_text: version.content_text,
            updated_at: new Date().toISOString(),
          })
          .eq("id", noteId);

        if (error) throw error;
        toast.success(`Restored to Version ${version.version_number}`);
        return true;
      } catch (err) {
        console.error("[useNoteVersions] Error restoring version:", err);
        toast.error("Failed to restore version");
        return false;
      } finally {
        setIsRestoring(false);
      }
    },
    [noteId],
  );

  return {
    versions,
    isLoading,
    isSaving,
    isRestoring,
    fetchVersions,
    createSnapshot,
    restoreVersion,
  };
}
