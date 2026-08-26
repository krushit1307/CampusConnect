import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  handle?: string | null;
}

export interface Comment {
  id: string;
  post_id?: string;
  content: string;
  created_at: string;
  deleted_at: string | null;
  parent_id?: string | null;
  parent_comment_id?: string | null;
  depth?: number;
  profiles: Profile[] | Profile | null;
}

interface RealtimeCommentPayload {
  id: string;
  post_id: string;
  author_id?: string;
  content: string;
  created_at: string;
  deleted_at?: string | null;
  parent_id?: string | null;
  parent_comment_id?: string | null;
}

interface UseRealtimeCommentsOptions {
  postId: string | null;
  enabled?: boolean;
  onNewComment: (comment: Comment) => void;
}

/**
 * Hook to subscribe to Supabase Realtime changes for comments on a specific post.
 * Filters updates by `comments:post_id=eq.<postId>` and merges incoming payloads
 * directly into local state without requiring full-page or full-feed re-fetches.
 */
export function useRealtimeComments({
  postId,
  enabled = true,
  onNewComment,
}: UseRealtimeCommentsOptions) {
  const supabase = createClient();

  useEffect(() => {
    if (!postId || !enabled) return;

    const channelName = `comments:post_id=eq.${postId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const newRow = payload.new as RealtimeCommentPayload;
          if (!newRow || !newRow.id) return;

          let authorProfile: Profile | null = null;
          if (newRow.author_id) {
            const { data } = await supabase
              .from("profiles")
              .select("id, full_name, handle")
              .eq("id", newRow.author_id)
              .maybeSingle();

            if (data) {
              authorProfile = data;
            }
          }

          const formattedComment: Comment = {
            id: newRow.id,
            post_id: newRow.post_id || postId,
            content: newRow.content,
            created_at: newRow.created_at,
            deleted_at: newRow.deleted_at || null,
            parent_id: newRow.parent_id || newRow.parent_comment_id || null,
            parent_comment_id: newRow.parent_comment_id || newRow.parent_id || null,
            profiles: authorProfile,
          };

          onNewComment(formattedComment);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId, enabled, onNewComment, supabase]);
}
