const mentionRegex = () => /@([a-zA-Z0-9_-]+)/g;

export function extractMentions(content: string): string[] {
  const mentions: string[] = [];
  let match;
  const re = mentionRegex();
  while ((match = re.exec(content)) !== null) {
    mentions.push(match[1]);
  }
  return mentions;
}

export function hasMentions(content: string): boolean {
  return mentionRegex().test(content);
}
