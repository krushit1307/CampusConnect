import React, { useState, useCallback } from "react";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";

interface CommentSectionProps {
  postId: string;
  currentUser?: {
    id: string;
    name: string;
  };
}

export const CommentSection: React.FC<CommentSectionProps> = ({ postId, currentUser }) => {
  const [commentText, setCommentText] = useState("");
  const username = currentUser?.name || "A user";

  const { typingUsers, broadcastTyping } = useTypingIndicator(
    `discussion-post:${postId}`,
    currentUser?.id ?? `anon-${postId}`,
    username,
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCommentText(e.target.value);
    broadcastTyping();
  };

  // Helper to render typing text
  const renderTypingText = useCallback(() => {
    if (typingUsers.length === 0) return null;
    if (typingUsers.length === 1) return `${typingUsers[0]} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    return "Several people are typing...";
  }, [typingUsers]);

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Dynamic Typing Indicator Banner */}
      {typingUsers.length > 0 && (
        <div className="text-sm italic text-muted-foreground animate-pulse">
          💬 {renderTypingText()}
        </div>
      )}

      {/* Input Box for comments */}
      <div className="flex gap-2">
        <input
          type="text"
          value={commentText}
          onChange={handleInputChange}
          placeholder="Write a comment..."
          className="w-full p-2 border rounded-md text-sm bg-background text-foreground"
        />
      </div>
    </div>
  );
};

export default CommentSection;
