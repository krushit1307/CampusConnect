import React, { useState } from "react";
import { Globe, Languages, RotateCcw, Loader2 } from "lucide-react";
import {
  eventTranslationService,
  shouldShowTranslateButton,
  detectLanguage,
  normalizeLocale,
} from "@/services/eventTranslationService";
import { toast } from "sonner";

interface TranslatableEventDescriptionProps {
  eventId: string;
  originalDescription: string;
  sourceLanguage?: string;
  eventTitle?: string;
}

export const TranslatableEventDescription: React.FC<TranslatableEventDescriptionProps> = ({
  eventId,
  originalDescription,
  sourceLanguage,
  eventTitle,
}) => {
  const userLocale = typeof navigator !== "undefined" ? navigator.language : "en-US";
  const effectiveSource = sourceLanguage || detectLanguage(originalDescription);
  const userLangCode = normalizeLocale(userLocale);

  const [isTranslated, setIsTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showTranslateAction = shouldShowTranslateButton(effectiveSource, userLocale);

  const handleTranslate = async () => {
    if (isTranslated) {
      setIsTranslated(false);
      return;
    }

    if (translatedText) {
      setIsTranslated(true);
      return;
    }

    try {
      setLoading(true);
      const res = await eventTranslationService.getOrTranslateEvent({
        eventId,
        description: originalDescription,
        title: eventTitle,
        targetLanguage: userLangCode,
      });

      setTranslatedText(res.translatedDescription);
      setIsTranslated(true);
      if (res.fromCache) {
        toast.info("Translation loaded from cache");
      } else {
        toast.success(`Translated to ${userLangCode.toUpperCase()}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to translate event description");
    } finally {
      setLoading(false);
    }
  };

  const getLanguageLabel = (code: string) => {
    const map: Record<string, string> = {
      en: "English",
      zh: "Chinese",
      es: "Spanish",
      fr: "French",
      ja: "Japanese",
      ko: "Korean",
      de: "German",
      hi: "Hindi",
      ar: "Arabic",
    };
    return map[code] || code.toUpperCase();
  };

  return (
    <div className="space-y-3">
      {showTranslateAction && (
        <div className="flex items-center justify-between gap-2 py-1 px-2.5 bg-muted/40 rounded-lg border border-border/50 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span>
              Detected in <strong>{getLanguageLabel(effectiveSource)}</strong>
            </span>
          </div>

          <button
            onClick={handleTranslate}
            disabled={loading}
            className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Translating...
              </>
            ) : isTranslated ? (
              <>
                <RotateCcw className="w-3 h-3" />
                Show Original
              </>
            ) : (
              <>
                <Languages className="w-3 h-3" />
                Translate to {getLanguageLabel(userLangCode)}
              </>
            )}
          </button>
        </div>
      )}

      {/* Description display with seamless text swap without layout jitter */}
      <div className="relative text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
        {isTranslated && translatedText ? translatedText : originalDescription}
      </div>
    </div>
  );
};
