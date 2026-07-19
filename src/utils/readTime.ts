export const calculateReadTime = (text: string): string => {
  const trimmedText = text.trim();

  if (!trimmedText) return "< 1 min read";

  const wordsPerMinute = 200;
  const wordCount = trimmedText.split(/\s+/).length;
  const minutes = wordCount / wordsPerMinute;

  return minutes < 1 ? "< 1 min read" : `${Math.ceil(minutes)} min read`;
};
