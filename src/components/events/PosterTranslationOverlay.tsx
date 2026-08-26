// =============================================================================
// Component: PosterTranslationOverlay
// Issue: #3664 - Implement 'Real-Time "Translation Overlay" for Posters'
// Description: Renders the original poster image and paints absolute-positioned
// <span> elements over every detected text block using the normalized bounding
// boxes. When a translation exists for the viewer's language, the translated
// string replaces the baked-in text with a matching footprint and font scale.
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { usePosterTranslation } from '../../hooks/usePosterTranslation';
import { SUPPORTED_LANGUAGES } from '../../lib/ocr/types';

interface PosterTranslationOverlayProps {
  eventId: string;
  alt: string;
}

export const PosterTranslationOverlay: React.FC<PosterTranslationOverlayProps> = ({ eventId, alt }) => {
  const {
    posterUrl, blocks, translatedTexts, needsTranslation,
    isTranslating, isLoading, showOverlay, setShowOverlay, userLanguage,
  } = usePosterTranslation(eventId);

  // Track the rendered width so normalized boxes map to exact pixels
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderWidth, setRenderWidth] = useState(0);
  const [renderHeight, setRenderHeight] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      setRenderWidth(rect.width);
      setRenderHeight(rect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (isLoading) {
    return <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />;
  }

  if (!posterUrl) return null;

  const hasOverlay = showOverlay && blocks.length > 0;
  const hasTranslations = Object.keys(translatedTexts).length > 0;

  return (
    <div className="space-y-3">
      {/* Controls row: overlay toggle + language indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
          <span>
            {needsTranslation
              ? `Viewing in ${SUPPORTED_LANGUAGES.find(l => l.code === userLanguage)?.label || userLanguage}`
              : 'Original language'}
          </span>
          {isTranslating && <span className="animate-pulse">…translating</span>}
        </div>

        {needsTranslation && (
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              showOverlay
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {showOverlay ? 'Overlay: ON' : 'Overlay: OFF'}
          </button>
        )}
      </div>

      {/* Poster + overlay */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-md select-none"
      >
        <img src={posterUrl} alt={alt} className="w-full h-auto block" />

        {/* Translated text spans painted over the original baked-in text */}
        {hasOverlay && renderWidth > 0 && blocks.map(block => {
          const translated = hasTranslations ? (translatedTexts[block.id] ?? block.text) : null;
          const left = block.box.x * renderWidth;
          const top = block.box.y * renderHeight;
          const width = block.box.w * renderWidth;
          const height = block.box.h * renderHeight;
          // Font size approximated from the detected line height ratio
          const fontSize = Math.max(10, block.fontSizeRatio * renderHeight * 0.9);

          return (
            <span
              key={block.id}
              className="absolute flex items-center justify-center text-center leading-tight font-semibold"
              style={{
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`,
                fontSize: `${fontSize}px`,
                // Opaque backdrop hides the original English text underneath
                backgroundColor: 'rgba(255,255,255,0.94)',
                color: '#111827',
                borderRadius: '2px',
                padding: '0 2px',
                overflow: 'hidden',
              }}
            >
              {translated ?? '\u00A0'}
            </span>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Text detected via OCR is re-rendered in your language directly on top of the poster layout.
      </p>
    </div>
  );
};
