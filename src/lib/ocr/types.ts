// =============================================================================
// Types: OCR Bounding-Box Contract
// Issue: #3664 - Implement 'Real-Time "Translation Overlay" for Posters'
// Description: Shared TypeScript contract for the normalized OCR payload that
// is stored on events.poster_ocr_data and consumed by the overlay renderer.
// =============================================================================

/** A normalized (0..1) bounding box relative to the poster dimensions. */
export interface NormalizedBox {
  x: number; // left   (0..1)
  y: number; // top    (0..1)
  w: number; // width  (0..1)
  h: number; // height (0..1)
}

/** A single detected line/block of text inside the poster. */
export interface OcrBlock {
  id: string;
  text: string;
  box: NormalizedBox;
  /** Approximate font height as a ratio of the poster height. */
  fontSizeRatio: number;
  confidence: number;
}

/** Root payload persisted on events.poster_ocr_data. */
export interface PosterOcrData {
  blocks: OcrBlock[];
  width?: number;
  height?: number;
}

/** Languages the overlay UI offers for on-the-fly translation. */
export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '中文' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
];

/** Detects the viewer's preferred language from storage or the browser. */
export function detectUserLanguage(): string {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem('campusconnect_lang');
  if (stored) return stored.slice(0, 2);
  return (navigator.language || 'en').slice(0, 2);
}
