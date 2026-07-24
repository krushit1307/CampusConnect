import { Link } from "react-router-dom";

interface MentionRendererProps {
  content: string;
}

/**
 * Renders text content with @mentions converted to clickable profile links
 */
export function MentionRenderer({ content }: MentionRendererProps) {
  // Regular expression to match @mentions (username format)
  // Matches @username where username can contain letters, numbers, underscores, and hyphens
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  // Find all @mentions in the content
  while ((match = mentionRegex.exec(content)) !== null) {
    const [fullMatch, username] = match;
    const matchIndex = match.index;

    // Add text before the mention
    if (matchIndex > lastIndex) {
      parts.push(content.slice(lastIndex, matchIndex));
    }

    // Add the mention as a link
    parts.push(
      <Link
        key={`mention-${matchIndex}-${username}`}
        to={`/profile/${username}`}
        className="font-bold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {fullMatch}
      </Link>,
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  // Add remaining text after the last mention
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts.length > 0 ? parts : content}</>;
}

/**
 * Utility function to extract all mentioned usernames from content
 */
export function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

/**
 * Utility function to check if content contains mentions
 */
export function hasMentions(content: string): boolean {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  return mentionRegex.test(content);
}
