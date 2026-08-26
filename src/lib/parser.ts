export interface ParsedFlyer {
  title: string;
  date: string;
  description: string;
}

export function parseFlyer(text: string): ParsedFlyer {
  // Look for dates like 12/05/2026, 12-05-26, etc.
  const dateRegex = /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g;

  const dates = text.match(dateRegex);

  // Exclude empty lines to find a valid title
  const lines = text.split("\n").filter((line) => line.trim().length > 0);

  return {
    title: lines.length > 0 ? lines[0].trim() : "",
    date: dates?.[0] ?? "",
    description: text.trim(),
  };
}
