import React from "react";

interface TypingBubbleProps {
  typingUsers: string[];
  className?: string;
}

export function TypingBubble({ typingUsers, className = "" }: TypingBubbleProps) {
  if (!typingUsers || typingUsers.length === 0) {
    return (
      <div
        className={`min-h-[1.5rem] ${className}`}
        aria-live="polite"
        aria-atomic="true"
        data-testid="typing-bubble-empty"
      />
    );
  }

  const labelText =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing`
        : "Several people are typing";

  return (
    <div
      className={`min-h-[1.5rem] flex items-center gap-2 py-1 px-1 text-xs font-mono text-gray-600 dark:text-gray-300 ${className}`}
      aria-live="polite"
      aria-atomic="true"
      data-testid="typing-bubble"
    >
      {/* Animated Jumping Dots */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 px-2 py-1 rounded-full shadow-sm">
        <span
          className="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-300 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "1s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-300 animate-bounce"
          style={{ animationDelay: "150ms", animationDuration: "1s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-gray-500 dark:bg-gray-300 animate-bounce"
          style={{ animationDelay: "300ms", animationDuration: "1s" }}
        />
      </div>

      <span className="italic font-medium">{labelText}…</span>
    </div>
  );
}
