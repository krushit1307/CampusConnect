export const calculateReadTime = (text: string): string => {
  const trimmedText = text.trim();
  if (!trimmedText) return "0 min read";

  const wordsPerMinute = 200;
  const wordCount = trimmedText.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
};
