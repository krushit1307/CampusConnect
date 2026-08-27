import { createClient } from "../lib/supabase/client";

const supabase = createClient();

export interface EventTranslation {
  id?: string;
  event_id: string;
  target_language: string;
  translated_title?: string;
  translated_description: string;
}

/**
 * Detects the probable language of text based on Unicode blocks and common scripts.
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) return "en";

  // Check for Japanese (Hiragana / Katakana) first because Japanese also includes Kanji (CJK)
  if (/[\u3040-\u30ff]/.test(text)) {
    return "ja";
  }
  // Check for Korean (Hangul)
  if (/[\uac00-\ud7af]/.test(text)) {
    return "ko";
  }
  // Check for CJK (Chinese)
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return "zh";
  }
  // Check for Cyrillic (Russian/Ukrainian)
  if (/[\u0400-\u04ff]/.test(text)) {
    return "ru";
  }
  // Check for Arabic
  if (/[\u0600-\u06ff]/.test(text)) {
    return "ar";
  }
  // Check for Devanagari (Hindi)
  if (/[\u0900-\u097f]/.test(text)) {
    return "hi";
  }
  // Check for Spanish / Latin accented keywords
  if (/[áéíóúñ¿¡]/i.test(text)) {
    return "es";
  }
  // Check for French accented keywords
  if (/[àâçèéêëîïôûùüÿœ]/i.test(text)) {
    return "fr";
  }

  return "en";
}

/**
 * Normalizes user browser locale string (e.g. 'en-US', 'zh-CN') to 2-letter ISO code.
 */
export function normalizeLocale(locale: string): string {
  if (!locale) return "en";
  return locale.split("-")[0].toLowerCase();
}

/**
 * Checks if translation is necessary between post language and user language.
 */
export function shouldShowTranslateButton(sourceLanguage: string, userLocale: string): boolean {
  const normalizedUserLang = normalizeLocale(userLocale);
  const normalizedSource = normalizeLocale(sourceLanguage || "en");
  return normalizedSource !== normalizedUserLang;
}

export const eventTranslationService = {
  /**
   * Fetches cached translation or executes and caches translation for an event.
   */
  async getOrTranslateEvent(params: {
    eventId: string;
    description: string;
    title?: string;
    targetLanguage: string;
  }): Promise<{ translatedDescription: string; translatedTitle?: string; fromCache: boolean }> {
    const targetLang = normalizeLocale(params.targetLanguage);

    // 1. Check Supabase cache
    const { data: cached } = await supabase
      .from("event_translations")
      .select("*")
      .eq("event_id", params.eventId)
      .eq("target_language", targetLang)
      .maybeSingle();

    if (cached) {
      return {
        translatedDescription: cached.translated_description,
        translatedTitle: cached.translated_title || undefined,
        fromCache: true,
      };
    }

    // 2. Invoke translation edge function or fallback translator
    let translatedDescription = params.description;
    let translatedTitle = params.title;

    try {
      const { data: edgeResult, error } = await supabase.functions.invoke("chat-translator", {
        body: {
          text: params.description,
          targetLanguage: targetLang,
        },
      });

      if (!error && edgeResult?.translatedText) {
        translatedDescription = edgeResult.translatedText;
      } else {
        // Fallback placeholder/simulated translation for offline or demo mode
        translatedDescription = `[Translated to ${targetLang.toUpperCase()}]: ${params.description}`;
      }
    } catch {
      translatedDescription = `[Translated to ${targetLang.toUpperCase()}]: ${params.description}`;
    }

    // 3. Cache result in Supabase
    await supabase.from("event_translations").insert({
      event_id: params.eventId,
      target_language: targetLang,
      translated_description: translatedDescription,
      translated_title: translatedTitle,
    });

    return {
      translatedDescription,
      translatedTitle,
      fromCache: false,
    };
  },
};
