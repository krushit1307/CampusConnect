import React, { useState, useEffect, useCallback } from "react";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useRealtimeComments } from "@/hooks/useRealtimeComments";
import { useSupabaseSubscription } from "@/hooks/useSupabaseSubscription";
import { supabase } from "@/lib/supabase/client";

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

interface CommentSectionProps {
  postId: string;
  currentUser?: {
    id: string;
    name: string;
  };
  onNewComment?: (comment: Comment) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  currentUser,
  onNewComment,
}) => {
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const username = currentUser?.name || "A user";

  const { typingUsers, broadcastTyping } = useTypingIndicator(
    `discussion-post:${postId}`,
    currentUser?.id ?? `anon-${postId}`,
    username,
  );

  useEffect(() => {
    supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setComments(data as Comment[]);
      });
  }, [postId]);

  useRealtimeComments({
    postId,
    enabled: !!postId,
    onNewComment: (newComment: unknown) => {
      const c = newComment as {
        id: string;
        post_id?: string;
        author_id?: string;
        content: string;
        created_at: string;
        profiles?: { id: string } | { id: string }[] | null;
      };
      const authorId =
        c.author_id || (Array.isArray(c.profiles) ? c.profiles[0]?.id : c.profiles?.id) || "";
      const comment: Comment = {
        id: c.id,
        post_id: c.post_id || postId,
        author_id: authorId,
        content: c.content,
        created_at: c.created_at,
      };
      setComments((prev) => [...prev, comment]);
      if (onNewComment) {
        onNewComment(comment);
      }
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    broadcastTyping();
  };

  const handleSubmit = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed || !currentUser) return;
    await supabase.from("comments").insert({
      post_id: postId,
      author_id: currentUser.id,
      content: trimmed,
    });
    setCommentText("");
  }, [commentText, postId, currentUser]);

  const renderTypingText = useCallback(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return "Several people are typing...";
  }, [typingUsers]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {comments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="text-sm p-2 rounded-md bg-muted">
              <span className="font-medium text-xs text-muted-foreground mr-2">{c.author_id}</span>
              {c.content}
            </li>
          ))}
        </ul>
      )}

      {typingUsers.length > 0 && (
        <div className="text-sm italic text-muted-foreground animate-pulse">
          💬 {renderTypingText()}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Write a comment..."
          className="w-full p-2 border rounded-md text-sm bg-background text-foreground"
        />
        {currentUser && (
          <button
            onClick={handleSubmit}
            disabled={!commentText.trim()}
            className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
