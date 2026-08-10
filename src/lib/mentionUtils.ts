export function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
}

export function hasMentions(content: string): boolean {
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  return mentionRegex.test(content);
}
