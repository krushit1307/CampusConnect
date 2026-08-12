import { createWorker } from "tesseract.js";

export interface ExtractedFlyerData {
  title?: string;
  dateStr?: string;
  timeStr?: string;
  location?: string;
  rawText: string;
  confidence: number;
}

/**
 * Parses raw text extracted from a physical event flyer to detect
 * event title, dates, times, and venue locations (#2653).
 */
export function parseFlyerText(rawText: string): ExtractedFlyerData {
  if (!rawText || !rawText.trim()) {
    return {
      rawText: "",
      confidence: 0,
    };
  }

  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Title Extraction: First line longer than 3 chars that isn't purely numbers or date
  let title: string | undefined = lines.find(
    (line) =>
      line.length >= 4 &&
      !/^\d+$/.test(line) &&
      !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(line),
  );

  if (title) {
    // Strip common flyer header noise
    title = title.replace(/^(WELCOME TO|ANNUAL|CAMPUS|EVENT:?|PRESENTING:?)\s+/i, "");
  }

  // 2. Date Extraction
  const dateRegexes = [
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/i,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,
    /\b\d{4}-\d{2}-\d{2}\b/,
  ];

  let dateStr: string | undefined;
  for (const regex of dateRegexes) {
    const match = rawText.match(regex);
    if (match) {
      dateStr = match[0];
      break;
    }
  }

  // 3. Time Extraction
  const timeRegexes = [
    /\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b/,
    /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/,
  ];

  let timeStr: string | undefined;
  for (const regex of timeRegexes) {
    const match = rawText.match(regex);
    if (match) {
      timeStr = match[0];
      break;
    }
  }

  // 4. Location Extraction
  const locationRegex =
    /\b(?:Main|North|South|East|West|Central|Upper|Lower)?\s*(?:Room|Auditorium|Building|Center|Hall|Lab|Square|Plaza|Library|Gym|Field|Stage|Student Union)\b[^\n,.]*/i;
  const locMatch = rawText.match(locationRegex);
  const location = locMatch ? locMatch[0].trim() : undefined;

  // Calculate heuristic confidence based on extracted fields
  let score = 0;
  if (title) score += 40;
  if (dateStr) score += 30;
  if (timeStr) score += 15;
  if (location) score += 15;

  return {
    title,
    dateStr,
    timeStr,
    location,
    rawText,
    confidence: score,
  };
}

/**
 * Extracts text from an image file using Tesseract Web Worker with progress callbacks.
 */
export async function extractTextWithProgress(
  file: File,
  onProgress?: (progressPct: number) => void,
): Promise<ExtractedFlyerData> {
  const worker = await createWorker("eng", 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100));
      }
    },
  });

  const res = await worker.recognize(file);
  await worker.terminate();

  const parsed = parseFlyerText(res.data.text);
  return parsed;
}
