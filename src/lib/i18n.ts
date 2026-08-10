export const supportedLanguages = ["en", "es", "zh"] as const;

export type Language = (typeof supportedLanguages)[number];

export function localizedPath(language: string, path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `/${language}${cleanPath}`;
}
