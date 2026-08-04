export const calculateReadTime = (richTextHtml: string): string => {
  const content = richTextHtml || "";

  // 1. Strip all HTML tags using regex
  const rawText = content.replace(/(<([^>]+)>)/gi, "").trim();

  if (!rawText && !content.includes("<img")) {
    return "1 min read";
  }

  // 2. Count words
  const words = rawText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // 3. Count <img> tags
  // Match all img tags: <img ... >
  const imgMatches = content.match(/<img[^>]*>/gi);
  const imgCount = imgMatches ? imgMatches.length : 0;

  // 4. Calculate image buffer in seconds
  // 12s for 1st image, 11s for 2nd, etc. down to 3s.
  let imageSeconds = 0;
  for (let i = 1; i <= imgCount; i++) {
    if (i <= 10) {
      imageSeconds += 13 - i;
    } else {
      imageSeconds += 3;
    }
  }

  // 5. Total seconds: 225 words per minute
  const totalSeconds = (wordCount / 225) * 60 + imageSeconds;

  // 6. Round up to nearest minute
  const minutes = Math.ceil(totalSeconds / 60);

  return `${minutes} min read`;
};
